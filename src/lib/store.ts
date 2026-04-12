import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashSync } from "bcryptjs";
import { UserRole } from "@prisma/client";
import { Pool } from "pg";
import {
  isLegacyStudioBrandName,
  studioBrandLogoPath,
  studioBrandName,
  studioCollectionName,
} from "@/lib/branding";
import { ownerEmail } from "@/lib/constants";
import type { DbBackupSnapshot, PrintFlowDb } from "@/lib/db-types";
import { createInitialData } from "@/lib/seed-data";
import { syncFilesystemShowcaseCatalog } from "@/lib/showcase-filesystem";

const dataDirectory = path.join(process.cwd(), "storage");
const dataPath = path.join(dataDirectory, "printflow-db.json");
const backupDirectory = path.join(dataDirectory, "backups");
const maxBackupFiles = 30;
const postgresStateKey = "default";
const postgresStateTable = "printflow_app_state";
const postgresBackupTable = "printflow_backups";

type PgStateRow = {
  payload: Partial<PrintFlowDb>;
};

type PgBackupRow = {
  file_name: string;
  payload: Partial<PrintFlowDb>;
  size_bytes: number;
  created_at: Date | string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortByDateDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getPostgresConnectionString() {
  return process.env.PRINTFLOW_POSTGRES_URL?.trim() || process.env.POSTGRES_DATABASE_URL?.trim() || "";
}

function shouldUsePostgresBackend() {
  return Boolean(getPostgresConnectionString());
}

function resolvePostgresSsl() {
  const sslMode = (process.env.PRINTFLOW_POSTGRES_SSL?.trim() || "require").toLowerCase();

  if (sslMode === "disable" || sslMode === "off" || sslMode === "false" || sslMode === "0") {
    return undefined;
  }

  return { rejectUnauthorized: false };
}

let postgresPool: Pool | null = null;
let postgresSchemaPromise: Promise<void> | null = null;

function getPostgresPool() {
  const connectionString = getPostgresConnectionString();

  if (!connectionString) {
    throw new Error("Configure PRINTFLOW_POSTGRES_URL para usar o banco PostgreSQL.");
  }

  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString,
      ssl: resolvePostgresSsl(),
    });
  }

  return postgresPool;
}

async function ensurePostgresSchema() {
  if (!shouldUsePostgresBackend()) {
    return;
  }

  if (!postgresSchemaPromise) {
    postgresSchemaPromise = (async () => {
      const pool = getPostgresPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${postgresStateTable} (
          state_key TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${postgresBackupTable} (
          id TEXT PRIMARY KEY,
          file_name TEXT NOT NULL UNIQUE,
          payload JSONB NOT NULL,
          size_bytes INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${postgresBackupTable}_created_at_idx
        ON ${postgresBackupTable} (created_at DESC)
      `);
    })().catch((error) => {
      postgresSchemaPromise = null;
      throw error;
    });
  }

  await postgresSchemaPromise;
}

async function ensureLocalDataFile() {
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(backupDirectory, { recursive: true });

  try {
    await readFile(dataPath, "utf8");
  } catch {
    const initialData = createInitialData();
    await writeFile(dataPath, JSON.stringify(initialData, null, 2), "utf8");
  }
}

async function readLocalStateSource(): Promise<Partial<PrintFlowDb>> {
  try {
    const contents = await readFile(dataPath, "utf8");
    return JSON.parse(contents) as Partial<PrintFlowDb>;
  } catch {
    return createInitialData();
  }
}

async function findOwnerFromLocalBackups(ownerAccountEmail: string) {
  await mkdir(backupDirectory, { recursive: true });

  const backupFiles = (await readdir(backupDirectory))
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => right.localeCompare(left));

  for (const fileName of backupFiles) {
    try {
      const backupContents = await readFile(path.join(backupDirectory, fileName), "utf8");
      const parsedBackup = JSON.parse(backupContents) as Partial<PrintFlowDb>;
      const backupUser = parsedBackup.users?.find(
        (user) => user.email?.toLowerCase() === ownerAccountEmail,
      );

      if (backupUser?.passwordHash) {
        return backupUser;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function findOwnerFromPostgresBackups(ownerAccountEmail: string) {
  await ensurePostgresSchema();
  const pool = getPostgresPool();
  const { rows } = await pool.query<PgBackupRow>(
    `
      SELECT file_name, payload, size_bytes, created_at
      FROM ${postgresBackupTable}
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [maxBackupFiles],
  );

  for (const row of rows) {
    const backupUser = row.payload.users?.find(
      (user) => user.email?.toLowerCase() === ownerAccountEmail,
    );

    if (backupUser?.passwordHash) {
      return backupUser;
    }
  }

  return null;
}

async function findOwnerFromBackups(ownerAccountEmail: string) {
  if (shouldUsePostgresBackend()) {
    return findOwnerFromPostgresBackups(ownerAccountEmail);
  }

  return findOwnerFromLocalBackups(ownerAccountEmail);
}

async function ensureOwnerBootstrap(data: PrintFlowDb) {
  const bootstrapEmail = (process.env.OWNER_BOOTSTRAP_EMAIL?.trim() || ownerEmail).toLowerCase();
  const bootstrapName = process.env.OWNER_BOOTSTRAP_NAME?.trim() || "Guto";
  const bootstrapPhone = process.env.OWNER_BOOTSTRAP_PHONE?.trim() || "64996435078";
  const now = new Date().toISOString();

  const existingUser = data.users.find(
    (user) => user.email.toLowerCase() === bootstrapEmail,
  );

  if (existingUser) {
    if (existingUser.role !== UserRole.ADMIN) {
      existingUser.role = UserRole.ADMIN;
      existingUser.updatedAt = now;
      await writeDb(data);
    }

    return data;
  }

  const restoredOwner = await findOwnerFromBackups(bootstrapEmail);

  if (restoredOwner) {
    data.users.unshift({
      ...restoredOwner,
      email: bootstrapEmail,
      role: UserRole.ADMIN,
      phone: restoredOwner.phone || bootstrapPhone,
      company:
        !restoredOwner.company || isLegacyStudioBrandName(restoredOwner.company)
          ? studioBrandName
          : restoredOwner.company,
      address: restoredOwner.address || "A configurar",
      projectType: restoredOwner.projectType || "Vitrine e vendas",
      avatarColor: restoredOwner.avatarColor || "#ffc857",
      passwordChangedAt: restoredOwner.passwordChangedAt ?? now,
      createdAt: restoredOwner.createdAt ?? now,
      updatedAt: now,
    });

    await writeDb(data);
    return data;
  }

  const bootstrapPassword = process.env.OWNER_BOOTSTRAP_PASSWORD?.trim();

  if (!bootstrapPassword) {
    return data;
  }

  data.users.unshift({
    id: createId("usr"),
    name: bootstrapName,
    email: bootstrapEmail,
    passwordHash: hashSync(bootstrapPassword, 10),
    role: UserRole.ADMIN,
    phone: bootstrapPhone,
    company: studioBrandName,
    address: "A configurar",
    projectType: "Vitrine e vendas",
    avatarColor: "#ffc857",
    createdAt: now,
    updatedAt: now,
  });

  await writeDb(data);
  return data;
}

function normalizeDb(data: Partial<PrintFlowDb>): PrintFlowDb {
  const initial = createInitialData();
  const sourceStorefrontSettings: Partial<PrintFlowDb["storefrontSettings"]> =
    data.storefrontSettings ?? {};
  const normalizedStorefrontBrandName =
    !sourceStorefrontSettings.brandName || isLegacyStudioBrandName(sourceStorefrontSettings.brandName)
      ? initial.storefrontSettings.brandName
      : sourceStorefrontSettings.brandName.trim();
  const normalizedAboutBody =
    !sourceStorefrontSettings.aboutBody ||
    sourceStorefrontSettings.aboutBody.includes("PrintFlow 3D")
      ? initial.storefrontSettings.aboutBody
      : sourceStorefrontSettings.aboutBody;
  const normalizedAnnouncementText =
    !sourceStorefrontSettings.announcementText ||
    sourceStorefrontSettings.announcementText.includes("PrintFlow")
      ? initial.storefrontSettings.announcementText
      : sourceStorefrontSettings.announcementText;
  const normalizedSeoTitle =
    !sourceStorefrontSettings.seoTitle ||
    sourceStorefrontSettings.seoTitle.includes("PrintFlow 3D")
      ? initial.storefrontSettings.seoTitle
      : sourceStorefrontSettings.seoTitle;
  const normalizedShareImageUrl =
    sourceStorefrontSettings.shareImageUrl?.trim() || studioBrandLogoPath;

  return {
    users: (data.users ?? initial.users).map((user) => ({
      ...user,
      company:
        !user.company || isLegacyStudioBrandName(user.company)
          ? user.role === UserRole.ADMIN
            ? studioBrandName
            : user.company
          : user.company,
    })),
    sessions: data.sessions ?? initial.sessions,
    materials: (data.materials ?? initial.materials).map((material) => {
      const normalizedMaterial = material as Partial<PrintFlowDb["materials"][number]>;
      return {
        ...material,
        purchasePrice: normalizedMaterial.purchasePrice ?? 0,
        spoolWeightGrams: normalizedMaterial.spoolWeightGrams ?? material.stockAmount ?? 0,
        spoolLengthMeters: normalizedMaterial.spoolLengthMeters ?? 0,
        filamentDiameterMm: normalizedMaterial.filamentDiameterMm ?? 1.75,
        costPerUnit: normalizedMaterial.costPerUnit ?? 0,
        costPerMeter: normalizedMaterial.costPerMeter ?? 0,
      };
    }),
    machines: (data.machines ?? initial.machines).map((machine) => {
      const normalizedMachine = machine as Partial<PrintFlowDb["machines"][number]>;
      return {
        ...machine,
        purchasePrice: normalizedMachine.purchasePrice ?? 0,
        amountPaid: normalizedMachine.amountPaid ?? 0,
        purchasedAt: normalizedMachine.purchasedAt ?? machine.createdAt,
      };
    }),
    expenses: (data.expenses ?? initial.expenses).map((expense) => ({
      ...expense,
      notes: expense.notes ?? undefined,
    })),
    payables: (data.payables ?? initial.payables).map((payable) => ({
      ...payable,
      status:
        payable.status === "PAID"
          ? "PAID"
          : new Date(payable.dueDate).getTime() < Date.now()
            ? "OVERDUE"
            : "PENDING",
      paidAt: payable.paidAt ?? undefined,
      vendor: payable.vendor ?? undefined,
      notes: payable.notes ?? undefined,
    })),
    orders: (data.orders ?? initial.orders).map((order) => {
      const normalizedOrder = order as Partial<PrintFlowDb["orders"][number]>;
      return {
        ...order,
        orderNumber:
          normalizedOrder.orderNumber?.startsWith("PF-")
            ? normalizedOrder.orderNumber.replace(/^PF-/, "GV-")
            : order.orderNumber,
        estimatedMetersUsed: normalizedOrder.estimatedMetersUsed ?? 0,
        printingStartedAt: normalizedOrder.printingStartedAt ?? undefined,
        printingCompletedAt: normalizedOrder.printingCompletedAt ?? undefined,
        plannedPrintMinutes:
          normalizedOrder.plannedPrintMinutes ??
          Math.max(Math.round((normalizedOrder.estimatedHours ?? order.estimatedHours ?? 0) * 60), 0),
        materialConsumedAt: normalizedOrder.materialConsumedAt ?? undefined,
        materialConsumptionGrams: normalizedOrder.materialConsumptionGrams ?? 0,
        materialConsumptionValue: normalizedOrder.materialConsumptionValue ?? 0,
      };
    }),
    storefrontSettings: {
      ...initial.storefrontSettings,
      ...sourceStorefrontSettings,
      brandName: normalizedStorefrontBrandName,
      aboutBody: normalizedAboutBody,
      announcementText: normalizedAnnouncementText,
      seoTitle: normalizedSeoTitle,
      shareImageUrl: normalizedShareImageUrl,
      campaignBanners:
        sourceStorefrontSettings.campaignBanners?.map((campaign, index) => ({
          id: campaign.id ?? `campaign-${index + 1}`,
          badge: campaign.badge?.trim() || undefined,
          title: campaign.title?.trim() || `Campanha ${index + 1}`,
          subtitle: campaign.subtitle?.trim() || "",
          startsAt: campaign.startsAt ?? undefined,
          endsAt: campaign.endsAt ?? undefined,
          ctaLabel: campaign.ctaLabel?.trim() || undefined,
          ctaHref: campaign.ctaHref?.trim() || undefined,
        })).filter((campaign) => campaign.title && campaign.subtitle) ??
        initial.storefrontSettings.campaignBanners,
      instagramButtonLabel:
        sourceStorefrontSettings.instagramButtonLabel?.trim() ||
        initial.storefrontSettings.instagramButtonLabel,
      instagramSectionTitle:
        sourceStorefrontSettings.instagramSectionTitle?.trim() ||
        initial.storefrontSettings.instagramSectionTitle,
      instagramSectionBody:
        sourceStorefrontSettings.instagramSectionBody?.trim() ||
        initial.storefrontSettings.instagramSectionBody,
      instagramGallery:
        sourceStorefrontSettings.instagramGallery?.map((entry, index) => ({
          id: entry.id ?? `gallery-${index + 1}`,
          title: entry.title?.trim() || `Galeria ${index + 1}`,
          imageUrl: entry.imageUrl?.trim() || "",
          linkUrl: entry.linkUrl?.trim() || undefined,
        })).filter((entry) => entry.imageUrl) ??
        initial.storefrontSettings.instagramGallery,
      instagramReels:
        sourceStorefrontSettings.instagramReels?.map((entry, index) => ({
          id: entry.id ?? `reel-${index + 1}`,
          title: entry.title?.trim() || `Reel ${index + 1}`,
          reelUrl: entry.reelUrl?.trim() || "",
          thumbnailUrl: entry.thumbnailUrl?.trim() || undefined,
          caption: entry.caption?.trim() || undefined,
        })).filter((entry) => entry.reelUrl) ??
        initial.storefrontSettings.instagramReels,
      instagramBehindScenes:
        sourceStorefrontSettings.instagramBehindScenes?.map((entry) => entry.trim()).filter(Boolean) ??
        initial.storefrontSettings.instagramBehindScenes,
      heroHighlights:
        sourceStorefrontSettings.heroHighlights?.map((entry) => entry.trim()).filter(Boolean) ??
        initial.storefrontSettings.heroHighlights,
      seoKeywords:
        sourceStorefrontSettings.seoKeywords?.map((entry) => entry.trim()).filter(Boolean) ??
        initial.storefrontSettings.seoKeywords,
      updatedAt:
        sourceStorefrontSettings.updatedAt ?? initial.storefrontSettings.updatedAt,
    },
    showcaseLibraries: (data.showcaseLibraries ?? initial.showcaseLibraries).map((library, index) => ({
      ...library,
      name: library.name?.trim() || `Biblioteca ${index + 1}`,
      description: library.description?.trim() || undefined,
      coverImageUrl: library.coverImageUrl?.trim() || undefined,
      sortOrder: library.sortOrder ?? index,
      active: library.active ?? true,
      syncSource:
        library.syncSource?.mode === "FILESYSTEM"
          ? {
              mode: "FILESYSTEM",
              key: library.syncSource.key,
              relativePath: library.syncSource.relativePath,
              generatedName: library.syncSource.generatedName?.trim() || library.name?.trim() || `Biblioteca ${index + 1}`,
              generatedDescription: library.syncSource.generatedDescription?.trim() || undefined,
              missing: library.syncSource.missing ?? false,
            }
          : undefined,
      createdAt: library.createdAt ?? new Date().toISOString(),
      updatedAt: library.updatedAt ?? library.createdAt ?? new Date().toISOString(),
    })),
    showcaseItems: (data.showcaseItems ?? initial.showcaseItems).map((item) => {
      const normalizedItem = item as Partial<PrintFlowDb["showcaseItems"][number]>;
      return {
        ...item,
        category:
          !normalizedItem.category?.trim() || normalizedItem.category.trim() === "Colecao PrintFlow"
            ? studioCollectionName
            : normalizedItem.category.trim(),
        libraryId: normalizedItem.libraryId?.trim() || undefined,
        tagline: normalizedItem.tagline?.trim() || undefined,
        productionChecklist: normalizedItem.productionChecklist?.trim() || undefined,
        imageUrl: normalizedItem.imageUrl ?? undefined,
        materialLabel: normalizedItem.materialLabel?.trim() || undefined,
        materialId: normalizedItem.materialId ?? undefined,
        colorOptions:
          normalizedItem.colorOptions?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        sizeOptions:
          normalizedItem.sizeOptions?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        finishOptions:
          normalizedItem.finishOptions?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        badges:
          normalizedItem.badges?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        deliveryModes:
          normalizedItem.deliveryModes?.filter(Boolean) ?? ["PICKUP", "SHIPPING"],
        dimensionSummary: normalizedItem.dimensionSummary?.trim() || undefined,
        shippingSummary: normalizedItem.shippingSummary?.trim() || undefined,
        promotionLabel: normalizedItem.promotionLabel?.trim() || undefined,
        compareAtPrice: normalizedItem.compareAtPrice ?? undefined,
        couponCode: normalizedItem.couponCode?.trim() || undefined,
        couponDiscountPercent: normalizedItem.couponDiscountPercent ?? undefined,
        seoTitle: normalizedItem.seoTitle?.trim() || undefined,
        seoDescription: normalizedItem.seoDescription?.trim() || undefined,
        seoKeywords:
          normalizedItem.seoKeywords?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        leadTimeDays:
          normalizedItem.leadTimeDays ??
          (normalizedItem.fulfillmentType === "MADE_TO_ORDER" ? 5 : 0),
        videoUrl: normalizedItem.videoUrl ?? undefined,
        galleryImageUrls:
          normalizedItem.galleryImageUrls?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        variants:
          normalizedItem.variants?.map((variant) => ({
            ...variant,
            label: variant.label?.trim() || "Variacao",
            color: variant.color?.trim() || undefined,
            size: variant.size?.trim() || undefined,
            finish: variant.finish?.trim() || undefined,
            priceAdjustment: variant.priceAdjustment ?? 0,
            stockQuantity: variant.stockQuantity ?? undefined,
            galleryImageUrls:
              variant.galleryImageUrls?.map((entry) => entry.trim()).filter(Boolean) ?? [],
            active: variant.active ?? true,
          })) ?? [],
        fulfillmentType: normalizedItem.fulfillmentType ?? "STOCK",
        stockQuantity: normalizedItem.stockQuantity ?? 0,
        estimatedPrintHours: normalizedItem.estimatedPrintHours ?? 1,
        estimatedMaterialGrams: normalizedItem.estimatedMaterialGrams ?? 0,
        viewCount: normalizedItem.viewCount ?? 0,
        whatsappClickCount: normalizedItem.whatsappClickCount ?? 0,
        featured: normalizedItem.featured ?? false,
        active: normalizedItem.active ?? true,
        syncSource:
          normalizedItem.syncSource?.mode === "FILESYSTEM"
            ? {
                mode: "FILESYSTEM",
                key: normalizedItem.syncSource.key,
                relativePath: normalizedItem.syncSource.relativePath,
                generatedName: normalizedItem.syncSource.generatedName?.trim() || item.name,
                generatedCategory: normalizedItem.syncSource.generatedCategory?.trim() || undefined,
                generatedDescription: normalizedItem.syncSource.generatedDescription?.trim() || undefined,
                generatedTagline: normalizedItem.syncSource.generatedTagline?.trim() || undefined,
                fileUrl: normalizedItem.syncSource.fileUrl ?? undefined,
                fileName: normalizedItem.syncSource.fileName?.trim() || undefined,
                fileFormat: normalizedItem.syncSource.fileFormat?.trim() || undefined,
                fileCount: normalizedItem.syncSource.fileCount ?? 0,
                imageCount: normalizedItem.syncSource.imageCount ?? 0,
                missing: normalizedItem.syncSource.missing ?? false,
              }
            : undefined,
      };
    }),
    showcaseTestimonials: (data.showcaseTestimonials ?? initial.showcaseTestimonials).map(
      (testimonial) => ({
        ...testimonial,
        city: testimonial.city?.trim() || undefined,
        role: testimonial.role?.trim() || undefined,
        instagramHandle: testimonial.instagramHandle?.trim() || undefined,
        productName: testimonial.productName?.trim() || undefined,
        imageUrl: testimonial.imageUrl?.trim() || undefined,
        featured: testimonial.featured ?? true,
        sortOrder: testimonial.sortOrder ?? 0,
      }),
    ),
    showcaseInquiries: (data.showcaseInquiries ?? initial.showcaseInquiries).map((inquiry) => {
      const normalizedInquiry = inquiry as Partial<PrintFlowDb["showcaseInquiries"][number]>;
      return {
        ...inquiry,
        orderNumber:
          normalizedInquiry.orderNumber?.startsWith("PF-")
            ? normalizedInquiry.orderNumber.replace(/^PF-/, "GV-")
            : normalizedInquiry.orderNumber ?? undefined,
        customerEmail: normalizedInquiry.customerEmail ?? "",
        customerPhone: normalizedInquiry.customerPhone ?? undefined,
        estimatedTotal: normalizedInquiry.estimatedTotal ?? undefined,
        selectedVariantLabel: normalizedInquiry.selectedVariantLabel?.trim() || undefined,
        desiredColor: normalizedInquiry.desiredColor?.trim() || undefined,
        desiredSize: normalizedInquiry.desiredSize?.trim() || undefined,
        desiredFinish: normalizedInquiry.desiredFinish?.trim() || undefined,
        couponCode: normalizedInquiry.couponCode?.trim() || undefined,
        source: normalizedInquiry.source ?? "CATALOG",
        notes: normalizedInquiry.notes ?? undefined,
        status: normalizedInquiry.status ?? "PENDING",
        tags: normalizedInquiry.tags?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        leadTemperature: normalizedInquiry.leadTemperature ?? "WARM",
        followUpAt: normalizedInquiry.followUpAt ?? undefined,
        lastContactAt: normalizedInquiry.lastContactAt ?? undefined,
        nextAction: normalizedInquiry.nextAction?.trim() || undefined,
        lastOutcome: normalizedInquiry.lastOutcome?.trim() || undefined,
        lostReason: normalizedInquiry.lostReason?.trim() || undefined,
        orderStage:
          normalizedInquiry.status === "CLOSED"
            ? normalizedInquiry.orderStage ?? "RECEIVED"
            : undefined,
        assignedMachineId: normalizedInquiry.assignedMachineId ?? undefined,
        printingStartedAt: normalizedInquiry.printingStartedAt ?? undefined,
        printingCompletedAt: normalizedInquiry.printingCompletedAt ?? undefined,
        plannedPrintMinutes: normalizedInquiry.plannedPrintMinutes ?? 0,
        materialConsumedAt: normalizedInquiry.materialConsumedAt ?? undefined,
        materialConsumptionGrams: normalizedInquiry.materialConsumptionGrams ?? 0,
        materialConsumptionValue: normalizedInquiry.materialConsumptionValue ?? 0,
        deliveryMode: normalizedInquiry.deliveryMode ?? undefined,
        freightEstimate: normalizedInquiry.freightEstimate ?? undefined,
        deliveryPostalCode: normalizedInquiry.deliveryPostalCode?.trim() || undefined,
        deliveryAddress: normalizedInquiry.deliveryAddress?.trim() || undefined,
        deliveryNeighborhood: normalizedInquiry.deliveryNeighborhood?.trim() || undefined,
        deliveryCity: normalizedInquiry.deliveryCity?.trim() || undefined,
        deliveryState: normalizedInquiry.deliveryState?.trim() || undefined,
        shippingCarrier: normalizedInquiry.shippingCarrier?.trim() || undefined,
        trackingCode: normalizedInquiry.trackingCode?.trim() || undefined,
        shippedAt: normalizedInquiry.shippedAt ?? undefined,
        deliveredAt: normalizedInquiry.deliveredAt ?? undefined,
        deliveryRecipient: normalizedInquiry.deliveryRecipient?.trim() || undefined,
        proofOfDeliveryNotes: normalizedInquiry.proofOfDeliveryNotes?.trim() || undefined,
        dueDate: normalizedInquiry.dueDate ?? undefined,
      };
    }),
    auditLogs: (data.auditLogs ?? initial.auditLogs).map((entry) => ({
      ...entry,
      actorId: entry.actorId ?? undefined,
      entityType: entry.entityType ?? undefined,
      entityId: entry.entityId ?? undefined,
      details: entry.details ?? undefined,
    })),
  };
}

async function readPostgresState() {
  await ensurePostgresSchema();
  const pool = getPostgresPool();
  const { rows } = await pool.query<PgStateRow>(
    `SELECT payload FROM ${postgresStateTable} WHERE state_key = $1 LIMIT 1`,
    [postgresStateKey],
  );

  if (rows.length === 0) {
    const localData = normalizeDb(await readLocalStateSource());
    await writePostgresState(localData);
    return localData;
  }

  return normalizeDb(rows[0].payload ?? {});
}

async function writePostgresState(data: PrintFlowDb) {
  await ensurePostgresSchema();
  const pool = getPostgresPool();
  const serialized = JSON.stringify(data, null, 2);
  const fileName = `printflow-backup-${new Date().toISOString().replace(/[:.]/g, "-")}-${createId("snap")}.json`;
  const sizeBytes = Buffer.byteLength(serialized, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO ${postgresStateTable} (state_key, payload, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (state_key)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [postgresStateKey, serialized],
    );
    await client.query(
      `
        INSERT INTO ${postgresBackupTable} (id, file_name, payload, size_bytes, created_at)
        VALUES ($1, $2, $3::jsonb, $4, NOW())
      `,
      [createId("bkp"), fileName, serialized, sizeBytes],
    );
    await client.query(
      `
        DELETE FROM ${postgresBackupTable}
        WHERE id IN (
          SELECT id
          FROM ${postgresBackupTable}
          ORDER BY created_at DESC
          OFFSET $1
        )
      `,
      [maxBackupFiles],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveLocalBackupSnapshot(serialized: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `printflow-backup-${stamp}.json`;
  const backupPath = path.join(backupDirectory, fileName);
  await writeFile(backupPath, serialized, "utf8");

  const backupFiles = (await readdir(backupDirectory))
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => right.localeCompare(left));

  const staleFiles = backupFiles.slice(maxBackupFiles);

  await Promise.all(
    staleFiles.map((entry) => rm(path.join(backupDirectory, entry), { force: true })),
  );
}

export async function readDb() {
  let normalizedData: PrintFlowDb;

  if (shouldUsePostgresBackend()) {
    normalizedData = await readPostgresState();
  } else {
    await ensureLocalDataFile();
    normalizedData = normalizeDb(await readLocalStateSource());
  }

  normalizedData = await ensureOwnerBootstrap(normalizedData);

  const syncChanged = await syncFilesystemShowcaseCatalog(normalizedData);
  if (syncChanged) {
    await writeDb(normalizedData);
  }

  return normalizedData;
}

export async function writeDb(data: PrintFlowDb) {
  if (shouldUsePostgresBackend()) {
    await writePostgresState(data);
    return;
  }

  await ensureLocalDataFile();
  const serialized = JSON.stringify(data, null, 2);
  await writeFile(dataPath, serialized, "utf8");
  await saveLocalBackupSnapshot(serialized);
}

export async function listBackupSnapshots(): Promise<DbBackupSnapshot[]> {
  if (shouldUsePostgresBackend()) {
    await ensurePostgresSchema();
    const pool = getPostgresPool();
    const { rows } = await pool.query<PgBackupRow>(
      `
        SELECT file_name, payload, size_bytes, created_at
        FROM ${postgresBackupTable}
        ORDER BY created_at DESC
      `,
    );

    return rows.map((row) => ({
      fileName: row.file_name,
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
      sizeBytes: row.size_bytes,
    }));
  }

  await ensureLocalDataFile();
  const entries = await readdir(backupDirectory);
  const jsonFiles = entries.filter((entry) => entry.endsWith(".json"));
  const snapshots = await Promise.all(
    jsonFiles.map(async (fileName) => {
      const filePath = path.join(backupDirectory, fileName);
      const fileStat = await stat(filePath);
      return {
        fileName,
        createdAt: fileStat.birthtime.toISOString(),
        sizeBytes: fileStat.size,
      };
    }),
  );

  return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getBackupSnapshotContent(fileName: string) {
  const safeFileName = path.basename(fileName);

  if (!safeFileName || safeFileName !== fileName) {
    return null;
  }

  if (shouldUsePostgresBackend()) {
    await ensurePostgresSchema();
    const pool = getPostgresPool();
    const { rows } = await pool.query<PgBackupRow>(
      `
        SELECT file_name, payload, size_bytes, created_at
        FROM ${postgresBackupTable}
        WHERE file_name = $1
        LIMIT 1
      `,
      [safeFileName],
    );

    if (!rows.length) {
      return null;
    }

    return {
      fileName: safeFileName,
      content: JSON.stringify(rows[0].payload ?? {}, null, 2),
    };
  }

  const filePath = path.join(backupDirectory, safeFileName);

  try {
    const content = await readFile(filePath, "utf8");
    return {
      fileName: safeFileName,
      content,
    };
  } catch {
    return null;
  }
}

export async function restoreBackupSnapshot(fileName: string) {
  const snapshot = await getBackupSnapshotContent(fileName);

  if (!snapshot) {
    return false;
  }

  let parsed: Partial<PrintFlowDb>;

  try {
    parsed = JSON.parse(snapshot.content) as Partial<PrintFlowDb>;
  } catch {
    throw new Error("O snapshot selecionado está corrompido e não pode ser restaurado.");
  }

  const normalized = normalizeDb(parsed);
  await writeDb(normalized);
  return true;
}

export async function deleteBackupSnapshot(fileName: string) {
  const safeFileName = path.basename(fileName);

  if (!safeFileName || safeFileName !== fileName) {
    return false;
  }

  if (shouldUsePostgresBackend()) {
    await ensurePostgresSchema();
    const pool = getPostgresPool();
    const result = await pool.query(
      `
        DELETE FROM ${postgresBackupTable}
        WHERE file_name = $1
      `,
      [safeFileName],
    );

    return (result.rowCount ?? 0) > 0;
  }

  await mkdir(backupDirectory, { recursive: true });
  const filePath = path.join(backupDirectory, safeFileName);

  try {
    await stat(filePath);
    await rm(filePath);
    return true;
  } catch {
    return false;
  }
}

let updateQueue = Promise.resolve();

export async function updateDb<T>(updater: (data: PrintFlowDb) => Promise<T> | T) {
  let release: (() => void) | undefined;
  const nextQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  const previousQueue = updateQueue;
  updateQueue = nextQueue;

  await previousQueue;

  try {
    const data = await readDb();
    const result = await updater(data);
    await writeDb(data);
    return result;
  } finally {
    release?.();
  }
}

export async function getSnapshot() {
  const db = await readDb();

  return {
    users: clone(db.users),
    materials: clone(db.materials),
    machines: clone(db.machines),
    expenses: clone(db.expenses),
    payables: clone(db.payables),
    orders: sortByDateDesc(db.orders),
    showcaseLibraries: [...db.showcaseLibraries].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt),
    ),
    showcaseItems: sortByDateDesc(db.showcaseItems),
    showcaseInquiries: sortByDateDesc(db.showcaseInquiries),
    auditLogs: sortByDateDesc(db.auditLogs),
  };
}

export function createId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}
