import { execFileSync } from "node:child_process";
import { watch } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { getShowcaseFilesystemRoot, isShowcaseFilesystemRootReachable } from "../src/lib/showcase-filesystem";
import type { PrintFlowDb } from "../src/lib/db-types";
import { readDb } from "../src/lib/store";

const snapshotPath = path.join(process.cwd(), "src", "lib", "showcase-sync-snapshot.json");
const syncPathspecs = ["src/lib/showcase-sync-snapshot.json", "public/showcase-sync-cache"];
const watchMode = process.argv.includes("--watch");
const pushMode = process.argv.includes("--push");

type ShowcaseSnapshotPayload = Pick<PrintFlowDb, "showcaseLibraries" | "showcaseItems">;

function getTimestampLabel() {
  return new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}

function buildSnapshotPayload(db: PrintFlowDb): ShowcaseSnapshotPayload {
  return {
    showcaseLibraries: db.showcaseLibraries.filter(
      (library) => library.syncSource?.mode === "FILESYSTEM" && !library.syncSource.missing,
    ),
    showcaseItems: db.showcaseItems.filter(
      (item) => item.syncSource?.mode === "FILESYSTEM" && !item.syncSource.missing,
    ),
  };
}

async function writeSnapshotFile(payload: ShowcaseSnapshotPayload) {
  const nextContents = `${JSON.stringify(payload, null, 2)}\n`;
  const currentContents = await readFile(snapshotPath, "utf8").catch(() => "");

  if (currentContents === nextContents) {
    return false;
  }

  await writeFile(snapshotPath, nextContents, "utf8");
  return true;
}

function runGitCommand(args: string[]) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function listChangedSyncArtifacts() {
  const output = runGitCommand(["status", "--short", "--", ...syncPathspecs]);
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function commitAndPushSyncArtifacts() {
  const changedArtifacts = listChangedSyncArtifacts();

  if (!changedArtifacts.length) {
    return false;
  }

  runGitCommand(["add", "--", ...syncPathspecs]);
  runGitCommand([
    "commit",
    "-m",
    `Sync showcase snapshot ${new Date().toISOString().replace(/[:.]/g, "-")}`,
    "--only",
    "--",
    ...syncPathspecs,
  ]);

  const branchName = runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"]);
  runGitCommand(["push", "origin", branchName]);
  return true;
}

async function syncShowcase(reason: string) {
  const syncRoot = getShowcaseFilesystemRoot();
  const reachable = await isShowcaseFilesystemRootReachable();

  if (!syncRoot || !reachable) {
    console.error(`[showcase-sync] Pasta de sincronizacao indisponivel: ${syncRoot ?? "(nao configurada)"}`);
    return false;
  }

  const db = await readDb();
  const snapshotPayload = buildSnapshotPayload(db);
  const snapshotChanged = await writeSnapshotFile(snapshotPayload);
  const changedArtifacts = listChangedSyncArtifacts();

  console.log(
    `[showcase-sync] ${reason} em ${getTimestampLabel()} | ${snapshotPayload.showcaseLibraries.length} bibliotecas | ${snapshotPayload.showcaseItems.length} itens`,
  );

  if (!changedArtifacts.length) {
    console.log("[showcase-sync] Nenhuma alteracao nova para publicar.");
    return snapshotChanged;
  }

  console.log(`[showcase-sync] Alteracoes detectadas em ${changedArtifacts.length} artefato(s).`);

  if (!pushMode) {
    console.log("[showcase-sync] Snapshot e cache atualizados localmente.");
    return true;
  }

  commitAndPushSyncArtifacts();
  console.log("[showcase-sync] Alteracoes enviadas para o GitHub. O Render vai redeployar automaticamente.");
  return true;
}

async function runWatchMode() {
  const syncRoot = getShowcaseFilesystemRoot();
  const reachable = await isShowcaseFilesystemRootReachable();

  if (!syncRoot || !reachable) {
    throw new Error(`Pasta de sincronizacao indisponivel: ${syncRoot ?? "(nao configurada)"}`);
  }

  await syncShowcase("Sincronizacao inicial");

  let debounceTimer: NodeJS.Timeout | null = null;
  let isSyncRunning = false;
  let rerunRequested = false;

  const scheduleSync = (reason: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      if (isSyncRunning) {
        rerunRequested = true;
        return;
      }

      isSyncRunning = true;

      try {
        await syncShowcase(reason);
      } finally {
        isSyncRunning = false;

        if (rerunRequested) {
          rerunRequested = false;
          scheduleSync("Mudancas acumuladas na biblioteca");
        }
      }
    }, 3000);
  };

  const watcher = watch(syncRoot, { recursive: true }, (_eventType, fileName) => {
    const label = fileName ? `Mudanca detectada em ${fileName}` : "Mudanca detectada na biblioteca";
    scheduleSync(label);
  });

  console.log(`[showcase-sync] Observando ${syncRoot}`);
  console.log(
    pushMode
      ? "[showcase-sync] Auto-publish ativo: cada alteracao valida vai gerar commit e push para o Render."
      : "[showcase-sync] Watch ativo: alteracoes vao atualizar o snapshot local automaticamente.",
  );

  const closeWatcher = () => {
    watcher.close();

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  process.on("SIGINT", () => {
    closeWatcher();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    closeWatcher();
    process.exit(0);
  });
}

async function main() {
  if (watchMode) {
    await runWatchMode();
    return;
  }

  await syncShowcase("Sincronizacao manual");
}

main().catch((error) => {
  console.error("[showcase-sync] Falha:", error instanceof Error ? error.message : error);
  process.exit(1);
});
