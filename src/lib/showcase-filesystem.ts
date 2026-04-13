import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import type {
  DbShowcaseItemSyncSource,
  DbShowcaseLibrarySyncSource,
  PrintFlowDb,
} from "@/lib/db-types";
import { getUploadContentType } from "@/lib/upload-storage";

const configuredSyncRoot = process.env.PRINTFLOW_SHOWCASE_SYNC_DIR?.trim();
const defaultSyncRoot = "D:\\Impressoes 3D";
const showcaseFilesystemRoot = configuredSyncRoot || defaultSyncRoot;
const showcaseFilesystemCacheDirectory = path.join(
  process.cwd(),
  "public",
  "showcase-sync-cache",
);

const ignoredDirectoryNames = new Set(["__MACOSX", ".git", ".svn", ".idea", "node_modules"]);
const ignoredFileNames = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const modelExtensions = new Set([".stl", ".obj", ".3mf"]);

type IndexedFile = {
  absolutePath: string;
  relativePath: string;
  relativeSegments: string[];
  name: string;
  extension: string;
  sizeBytes: number;
  depth: number;
};

type DiscoveredLibrary = {
  key: string;
  relativePath: string;
  name: string;
  description: string;
  coverImageUrl?: string;
};

type DiscoveredItem = {
  key: string;
  relativePath: string;
  name: string;
  category: string;
  description: string;
  tagline: string;
  libraryKey: string;
  imageUrl?: string;
  galleryImageUrls: string[];
  sourceFileUrl?: string;
  sourceFileName?: string;
  sourceFileFormat?: string;
  fileCount: number;
  imageCount: number;
  imageRelativePaths: string[];
};

type DiscoveredShowcase = {
  reachable: boolean;
  libraries: Map<string, DiscoveredLibrary>;
  items: Map<string, DiscoveredItem>;
};

function toSyncPath(relativePath: string) {
  return relativePath.replace(/[\\/]+/g, "/").trim();
}

function splitSyncPath(relativePath: string) {
  return toSyncPath(relativePath)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function createStableSyncId(prefix: string, key: string) {
  return `${prefix}_${createHash("sha1").update(key).digest("hex").slice(0, 12)}`;
}

function createAssetUrl(relativePath: string) {
  const encodedPath = splitSyncPath(relativePath)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/biblioteca-arquivos/${encodedPath}`;
}

function createCachedAssetFileName(relativePath: string) {
  const extension = path.extname(relativePath).toLowerCase();
  const hash = createHash("sha1").update(toSyncPath(relativePath)).digest("hex");

  return `${hash}${extension}`;
}

function getCachedAssetAbsolutePath(relativePath: string) {
  return path.join(showcaseFilesystemCacheDirectory, createCachedAssetFileName(relativePath));
}

function hasAllowedExtension(filePath: string, allowedExtensions: Set<string>) {
  return allowedExtensions.has(path.extname(filePath).toLowerCase());
}

function isImageFile(filePath: string) {
  return hasAllowedExtension(filePath, imageExtensions);
}

function isModelFile(filePath: string) {
  return hasAllowedExtension(filePath, modelExtensions);
}

function trimToUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function applyGeneratedText(
  currentValue: string | undefined,
  generatedValue: string | undefined,
  previousGeneratedValue: string | undefined,
) {
  const nextValue = trimToUndefined(generatedValue);
  const currentTrimmed = trimToUndefined(currentValue);
  const previousTrimmed = trimToUndefined(previousGeneratedValue);

  if (!currentTrimmed) {
    return nextValue;
  }

  if (!previousTrimmed) {
    return currentTrimmed;
  }

  return currentTrimmed === previousTrimmed ? nextValue : currentTrimmed;
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function sortFilesForGallery(files: IndexedFile[]) {
  return [...files].sort((left, right) => {
    if (left.depth !== right.depth) {
      return left.depth - right.depth;
    }

    return left.name.localeCompare(right.name, "pt-BR", { numeric: true, sensitivity: "base" });
  });
}

function choosePrimaryModelFile(files: IndexedFile[]) {
  return [...files].sort((left, right) => {
    if (left.sizeBytes !== right.sizeBytes) {
      return right.sizeBytes - left.sizeBytes;
    }

    if (left.depth !== right.depth) {
      return left.depth - right.depth;
    }

    return left.name.localeCompare(right.name, "pt-BR", { numeric: true, sensitivity: "base" });
  })[0];
}

function buildGeneratedTagline(category: string) {
  return `Preview sincronizado automaticamente da biblioteca ${category}.`;
}

function buildGeneratedDescription(relativePath: string, fileCount: number, imageCount: number) {
  return [
    "Preview importado automaticamente da biblioteca local da loja.",
    `Origem: ${toSyncPath(relativePath)}.`,
    `${fileCount} arquivo${fileCount === 1 ? "" : "s"} 3D e ${imageCount} imagem${imageCount === 1 ? "" : "ns"} encontrados.`,
  ].join(" ");
}

function buildGeneratedLibraryDescription(libraryName: string) {
  return `Biblioteca sincronizada automaticamente da pasta ${libraryName}.`;
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readUsefulDirectories(directoryPath: string) {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !ignoredDirectoryNames.has(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { numeric: true, sensitivity: "base" }));
  } catch {
    return [];
  }
}

async function readImmediateFiles(directoryPath: string, relativeSegments: string[]) {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && !ignoredFileNames.has(entry.name))
        .map(async (entry) => {
          const absolutePath = path.join(directoryPath, entry.name);
          const fileStats = await stat(absolutePath);
          const relativePath = toSyncPath(path.join(...relativeSegments, entry.name));

          return {
            absolutePath,
            relativePath,
            relativeSegments: splitSyncPath(relativePath),
            name: entry.name,
            extension: path.extname(entry.name).toLowerCase(),
            sizeBytes: fileStats.size,
            depth: relativeSegments.length - 1,
          } satisfies IndexedFile;
        }),
    );

    return files.sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
  } catch {
    return [];
  }
}

async function collectDescendantFiles(directoryPath: string, relativeSegments: string[]): Promise<IndexedFile[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const nestedResults = await Promise.all(
      entries.flatMap((entry) => {
        if (entry.isDirectory()) {
          if (ignoredDirectoryNames.has(entry.name)) {
            return [];
          }

          return [
            collectDescendantFiles(path.join(directoryPath, entry.name), [...relativeSegments, entry.name]),
          ];
        }

        if (!entry.isFile() || ignoredFileNames.has(entry.name)) {
          return [];
        }

        const absolutePath = path.join(directoryPath, entry.name);
        return [
          stat(absolutePath).then((fileStats) => [
            {
              absolutePath,
              relativePath: toSyncPath(path.join(...relativeSegments, entry.name)),
              relativeSegments: [...relativeSegments, entry.name],
              name: entry.name,
              extension: path.extname(entry.name).toLowerCase(),
              sizeBytes: fileStats.size,
              depth: relativeSegments.length - 1,
            } satisfies IndexedFile,
          ]),
        ];
      }),
    );

    return nestedResults.flat();
  } catch {
    return [];
  }
}

function createDiscoveredItemFromFiles(input: {
  libraryKey: string;
  relativePath: string;
  name: string;
  category: string;
  modelFiles: IndexedFile[];
  imageFiles: IndexedFile[];
}) {
  const sortedImages = sortFilesForGallery(input.imageFiles);
  const galleryImageUrls = sortedImages.map((file) => createAssetUrl(file.relativePath));
  const primaryModelFile = choosePrimaryModelFile(input.modelFiles);

  return {
    key: toSyncPath(input.relativePath),
    relativePath: toSyncPath(input.relativePath),
    name: input.name.trim(),
    category: input.category.trim(),
    description: buildGeneratedDescription(input.relativePath, input.modelFiles.length, input.imageFiles.length),
    tagline: buildGeneratedTagline(input.category),
    libraryKey: input.libraryKey,
    imageUrl: galleryImageUrls[0],
    galleryImageUrls,
    sourceFileUrl: primaryModelFile ? createAssetUrl(primaryModelFile.relativePath) : undefined,
    sourceFileName: primaryModelFile?.name,
    sourceFileFormat: primaryModelFile?.extension.replace(/^\./, ""),
    fileCount: input.modelFiles.length,
    imageCount: input.imageFiles.length,
    imageRelativePaths: sortedImages.map((file) => file.relativePath),
  } satisfies DiscoveredItem;
}

async function discoverItemFromFolder(
  directoryPath: string,
  libraryKey: string,
  category: string,
  relativePath: string,
) {
  const files = await collectDescendantFiles(directoryPath, splitSyncPath(relativePath));
  const modelFiles = files.filter((file) => isModelFile(file.absolutePath));

  if (!modelFiles.length) {
    return null;
  }

  const imageFiles = files.filter((file) => isImageFile(file.absolutePath));

  return createDiscoveredItemFromFiles({
    libraryKey,
    relativePath,
    name: path.basename(directoryPath),
    category,
    modelFiles,
    imageFiles,
  });
}

function discoverItemFromLooseModelFile(
  file: IndexedFile,
  siblingFiles: IndexedFile[],
  libraryKey: string,
  category: string,
) {
  const baseName = path.parse(file.name).name;
  const matchingImages = siblingFiles.filter(
    (candidate) =>
      candidate.absolutePath !== file.absolutePath &&
      isImageFile(candidate.absolutePath) &&
      path.parse(candidate.name).name.localeCompare(baseName, "pt-BR", {
        sensitivity: "base",
      }) === 0,
  );

  return createDiscoveredItemFromFiles({
    libraryKey,
    relativePath: file.relativePath,
    name: baseName,
    category,
    modelFiles: [file],
    imageFiles: matchingImages,
  });
}

async function discoverLibraryItems(libraryDirectoryPath: string, libraryName: string) {
  const libraryKey = toSyncPath(libraryName);
  const items: DiscoveredItem[] = [];

  const rootFiles = await readImmediateFiles(libraryDirectoryPath, [libraryName]);
  for (const modelFile of rootFiles.filter((file) => isModelFile(file.absolutePath))) {
    items.push(discoverItemFromLooseModelFile(modelFile, rootFiles, libraryKey, libraryName));
  }

  const sectionDirectories = await readUsefulDirectories(libraryDirectoryPath);

  for (const sectionDirectory of sectionDirectories) {
    const sectionPath = path.join(libraryDirectoryPath, sectionDirectory.name);
    const sectionRelativePath = toSyncPath(path.join(libraryName, sectionDirectory.name));
    const sectionFiles = await readImmediateFiles(sectionPath, splitSyncPath(sectionRelativePath));
    const childDirectories = await readUsefulDirectories(sectionPath);

    if (childDirectories.length > 0) {
      for (const childDirectory of childDirectories) {
        const itemRelativePath = toSyncPath(path.join(sectionRelativePath, childDirectory.name));
        const discoveredItem = await discoverItemFromFolder(
          path.join(sectionPath, childDirectory.name),
          libraryKey,
          sectionDirectory.name,
          itemRelativePath,
        );

        if (discoveredItem) {
          items.push(discoveredItem);
        }
      }

      for (const modelFile of sectionFiles.filter((file) => isModelFile(file.absolutePath))) {
        items.push(discoverItemFromLooseModelFile(modelFile, sectionFiles, libraryKey, sectionDirectory.name));
      }

      continue;
    }

    const looseModelFiles = sectionFiles.filter((file) => isModelFile(file.absolutePath));
    if (looseModelFiles.length > 1) {
      for (const modelFile of looseModelFiles) {
        items.push(discoverItemFromLooseModelFile(modelFile, sectionFiles, libraryKey, sectionDirectory.name));
      }

      continue;
    }

    const discoveredItem = await discoverItemFromFolder(
      sectionPath,
      libraryKey,
      libraryName,
      sectionRelativePath,
    );

    if (discoveredItem) {
      items.push({
        ...discoveredItem,
        name: sectionDirectory.name,
      });
    }
  }

  return items;
}

async function discoverFilesystemShowcase(): Promise<DiscoveredShowcase> {
  const discoveredLibraries = new Map<string, DiscoveredLibrary>();
  const discoveredItems = new Map<string, DiscoveredItem>();

  if (!showcaseFilesystemRoot || !(await pathExists(showcaseFilesystemRoot))) {
    return {
      reachable: false,
      libraries: discoveredLibraries,
      items: discoveredItems,
    };
  }

  const libraryDirectories = await readUsefulDirectories(showcaseFilesystemRoot);

  for (const libraryDirectory of libraryDirectories) {
    const libraryDirectoryPath = path.join(showcaseFilesystemRoot, libraryDirectory.name);
    const items = await discoverLibraryItems(libraryDirectoryPath, libraryDirectory.name);

    for (const item of items) {
      discoveredItems.set(item.key, item);
    }

    const firstCoverImage = items.find((item) => item.imageUrl)?.imageUrl;
    discoveredLibraries.set(toSyncPath(libraryDirectory.name), {
      key: toSyncPath(libraryDirectory.name),
      relativePath: toSyncPath(libraryDirectory.name),
      name: libraryDirectory.name,
      description: buildGeneratedLibraryDescription(libraryDirectory.name),
      coverImageUrl: firstCoverImage,
    });
  }

  return {
    reachable: true,
    libraries: discoveredLibraries,
    items: discoveredItems,
  };
}

async function syncShowcaseImageCache(discovered: DiscoveredShowcase) {
  if (!discovered.reachable || !showcaseFilesystemRoot) {
    return;
  }

  const desiredRelativePaths = new Set<string>();
  for (const item of discovered.items.values()) {
    for (const imageRelativePath of item.imageRelativePaths) {
      desiredRelativePaths.add(imageRelativePath);
    }
  }

  await mkdir(showcaseFilesystemCacheDirectory, { recursive: true });

  await Promise.all(
    [...desiredRelativePaths].map(async (relativePath) => {
      const sourcePath = path.join(showcaseFilesystemRoot, ...splitSyncPath(relativePath));
      const targetPath = getCachedAssetAbsolutePath(relativePath);

      try {
        const sourceStats = await stat(sourcePath);
        if (!sourceStats.isFile()) {
          return;
        }

        let shouldCopy = true;

        try {
          const targetStats = await stat(targetPath);
          shouldCopy = targetStats.size !== sourceStats.size;
        } catch {
          shouldCopy = true;
        }

        if (shouldCopy) {
          await copyFile(sourcePath, targetPath);
        }
      } catch {
        return;
      }
    }),
  );

  const desiredFileNames = new Set(
    [...desiredRelativePaths].map((relativePath) => createCachedAssetFileName(relativePath)),
  );
  const existingEntries = await readdir(showcaseFilesystemCacheDirectory, {
    withFileTypes: true,
  }).catch(() => []);

  await Promise.all(
    existingEntries
      .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && !desiredFileNames.has(entry.name))
      .map((entry) => rm(path.join(showcaseFilesystemCacheDirectory, entry.name), { force: true })),
  );
}

function updateLibrarySyncSource(
  currentSource: DbShowcaseLibrarySyncSource | undefined,
  discoveredLibrary: DiscoveredLibrary,
) {
  const nextSource: DbShowcaseLibrarySyncSource = {
    mode: "FILESYSTEM",
    key: discoveredLibrary.key,
    relativePath: discoveredLibrary.relativePath,
    generatedName: discoveredLibrary.name,
    generatedDescription: discoveredLibrary.description,
    missing: false,
  };

  if (!currentSource) {
    return {
      source: nextSource,
      changed: true,
    };
  }

  const changed =
    currentSource.key !== nextSource.key ||
    currentSource.relativePath !== nextSource.relativePath ||
    currentSource.generatedName !== nextSource.generatedName ||
    currentSource.generatedDescription !== nextSource.generatedDescription ||
    currentSource.missing !== nextSource.missing;

  return {
    source: changed ? nextSource : currentSource,
    changed,
  };
}

function updateItemSyncSource(
  currentSource: DbShowcaseItemSyncSource | undefined,
  discoveredItem: DiscoveredItem,
) {
  const nextSource: DbShowcaseItemSyncSource = {
    mode: "FILESYSTEM",
    key: discoveredItem.key,
    relativePath: discoveredItem.relativePath,
    generatedName: discoveredItem.name,
    generatedCategory: discoveredItem.category,
    generatedDescription: discoveredItem.description,
    generatedTagline: discoveredItem.tagline,
    fileUrl: discoveredItem.sourceFileUrl,
    fileName: discoveredItem.sourceFileName,
    fileFormat: discoveredItem.sourceFileFormat,
    fileCount: discoveredItem.fileCount,
    imageCount: discoveredItem.imageCount,
    missing: false,
  };

  if (!currentSource) {
    return {
      source: nextSource,
      changed: true,
    };
  }

  const changed =
    currentSource.key !== nextSource.key ||
    currentSource.relativePath !== nextSource.relativePath ||
    currentSource.generatedName !== nextSource.generatedName ||
    currentSource.generatedCategory !== nextSource.generatedCategory ||
    currentSource.generatedDescription !== nextSource.generatedDescription ||
    currentSource.generatedTagline !== nextSource.generatedTagline ||
    currentSource.fileUrl !== nextSource.fileUrl ||
    currentSource.fileName !== nextSource.fileName ||
    currentSource.fileFormat !== nextSource.fileFormat ||
    currentSource.fileCount !== nextSource.fileCount ||
    currentSource.imageCount !== nextSource.imageCount ||
    currentSource.missing !== nextSource.missing;

  return {
    source: changed ? nextSource : currentSource,
    changed,
  };
}

function markMissingLibrarySource(currentSource: DbShowcaseLibrarySyncSource | undefined) {
  if (!currentSource || currentSource.missing) {
    return {
      source: currentSource,
      changed: false,
    };
  }

  return {
    source: {
      ...currentSource,
      missing: true,
    },
    changed: true,
  };
}

function markMissingItemSource(currentSource: DbShowcaseItemSyncSource | undefined) {
  if (!currentSource || currentSource.missing) {
    return {
      source: currentSource,
      changed: false,
    };
  }

  return {
    source: {
      ...currentSource,
      missing: true,
    },
    changed: true,
  };
}

export async function syncFilesystemShowcaseCatalog(db: PrintFlowDb) {
  const discovered = await discoverFilesystemShowcase();

  if (!discovered.reachable) {
    return false;
  }

  await syncShowcaseImageCache(discovered);
  const now = new Date().toISOString();
  let changed = false;

  const existingLibrariesByKey = new Map(
    db.showcaseLibraries
      .filter((library) => library.syncSource?.mode === "FILESYSTEM")
      .map((library) => [library.syncSource?.key ?? "", library] as const),
  );
  const existingItemsByKey = new Map(
    db.showcaseItems
      .filter((item) => item.syncSource?.mode === "FILESYSTEM")
      .map((item) => [item.syncSource?.key ?? "", item] as const),
  );

  let newLibraryOffset = 0;
  for (const discoveredLibrary of discovered.libraries.values()) {
    const existingLibrary = existingLibrariesByKey.get(discoveredLibrary.key);

    if (!existingLibrary) {
      db.showcaseLibraries.push({
        id: createStableSyncId("libfs", discoveredLibrary.key),
        name: discoveredLibrary.name,
        description: discoveredLibrary.description,
        coverImageUrl: discoveredLibrary.coverImageUrl,
        sortOrder: db.showcaseLibraries.length + newLibraryOffset,
        active: true,
        syncSource: {
          mode: "FILESYSTEM",
          key: discoveredLibrary.key,
          relativePath: discoveredLibrary.relativePath,
          generatedName: discoveredLibrary.name,
          generatedDescription: discoveredLibrary.description,
          missing: false,
        },
        createdAt: now,
        updatedAt: now,
      });
      newLibraryOffset += 1;
      changed = true;
      continue;
    }

    let libraryChanged = false;
    const nextName = applyGeneratedText(
      existingLibrary.name,
      discoveredLibrary.name,
      existingLibrary.syncSource?.generatedName,
    );
    const nextDescription = applyGeneratedText(
      existingLibrary.description,
      discoveredLibrary.description,
      existingLibrary.syncSource?.generatedDescription,
    );
    const nextCoverImageUrl = discoveredLibrary.coverImageUrl;
    const syncSourceUpdate = updateLibrarySyncSource(existingLibrary.syncSource, discoveredLibrary);

    if (existingLibrary.name !== nextName) {
      existingLibrary.name = nextName ?? existingLibrary.name;
      libraryChanged = true;
    }

    if (existingLibrary.description !== nextDescription) {
      existingLibrary.description = nextDescription;
      libraryChanged = true;
    }

    if (existingLibrary.coverImageUrl !== nextCoverImageUrl) {
      existingLibrary.coverImageUrl = nextCoverImageUrl;
      libraryChanged = true;
    }

    if (syncSourceUpdate.changed) {
      existingLibrary.syncSource = syncSourceUpdate.source;
      libraryChanged = true;
    }

    if (libraryChanged) {
      existingLibrary.updatedAt = now;
      changed = true;
    }
  }

  for (const discoveredItem of discovered.items.values()) {
    const existingItem = existingItemsByKey.get(discoveredItem.key);
    const linkedLibrary =
      existingLibrariesByKey.get(discoveredItem.libraryKey) ??
      db.showcaseLibraries.find((library) => library.syncSource?.key === discoveredItem.libraryKey);

    if (!linkedLibrary) {
      continue;
    }

    if (!existingItem) {
      db.showcaseItems.unshift({
        id: createStableSyncId("vitfs", discoveredItem.key),
        name: discoveredItem.name,
        category: discoveredItem.category,
        libraryId: linkedLibrary.id,
        tagline: discoveredItem.tagline,
        description: discoveredItem.description,
        price: 0,
        productionChecklist: undefined,
        materialLabel: undefined,
        materialId: undefined,
        colorOptions: [],
        sizeOptions: [],
        finishOptions: [],
        badges: ["Biblioteca local"],
        deliveryModes: ["PICKUP", "SHIPPING"],
        dimensionSummary: undefined,
        shippingSummary: "Retirada, entrega local ou envio sob consulta.",
        promotionLabel: undefined,
        compareAtPrice: undefined,
        couponCode: undefined,
        couponDiscountPercent: undefined,
        seoTitle: undefined,
        seoDescription: undefined,
        seoKeywords: [],
        leadTimeDays: 0,
        imageUrl: discoveredItem.imageUrl,
        videoUrl: undefined,
        galleryImageUrls: discoveredItem.galleryImageUrls,
        variants: [],
        fulfillmentType: "MADE_TO_ORDER",
        stockQuantity: 0,
        estimatedPrintHours: 0,
        estimatedMaterialGrams: 0,
        viewCount: 0,
        whatsappClickCount: 0,
        featured: false,
        active: true,
        syncSource: {
          mode: "FILESYSTEM",
          key: discoveredItem.key,
          relativePath: discoveredItem.relativePath,
          generatedName: discoveredItem.name,
          generatedCategory: discoveredItem.category,
          generatedDescription: discoveredItem.description,
          generatedTagline: discoveredItem.tagline,
          fileUrl: discoveredItem.sourceFileUrl,
          fileName: discoveredItem.sourceFileName,
          fileFormat: discoveredItem.sourceFileFormat,
          fileCount: discoveredItem.fileCount,
          imageCount: discoveredItem.imageCount,
          missing: false,
        },
        createdAt: now,
        updatedAt: now,
      });
      changed = true;
      continue;
    }

    let itemChanged = false;
    const nextName = applyGeneratedText(
      existingItem.name,
      discoveredItem.name,
      existingItem.syncSource?.generatedName,
    );
    const nextCategory = applyGeneratedText(
      existingItem.category,
      discoveredItem.category,
      existingItem.syncSource?.generatedCategory,
    );
    const nextDescription = applyGeneratedText(
      existingItem.description,
      discoveredItem.description,
      existingItem.syncSource?.generatedDescription,
    );
    const nextTagline = applyGeneratedText(
      existingItem.tagline,
      discoveredItem.tagline,
      existingItem.syncSource?.generatedTagline,
    );
    const syncSourceUpdate = updateItemSyncSource(existingItem.syncSource, discoveredItem);

    if (existingItem.name !== nextName) {
      existingItem.name = nextName ?? existingItem.name;
      itemChanged = true;
    }

    if (existingItem.category !== nextCategory) {
      existingItem.category = nextCategory ?? existingItem.category;
      itemChanged = true;
    }

    if (existingItem.description !== nextDescription) {
      existingItem.description = nextDescription ?? existingItem.description;
      itemChanged = true;
    }

    if (existingItem.tagline !== nextTagline) {
      existingItem.tagline = nextTagline;
      itemChanged = true;
    }

    if (existingItem.leadTimeDays !== 0) {
      existingItem.leadTimeDays = 0;
      itemChanged = true;
    }

    if (existingItem.estimatedPrintHours !== 0) {
      existingItem.estimatedPrintHours = 0;
      itemChanged = true;
    }

    if (existingItem.libraryId !== linkedLibrary.id) {
      existingItem.libraryId = linkedLibrary.id;
      itemChanged = true;
    }

    if (existingItem.imageUrl !== discoveredItem.imageUrl) {
      existingItem.imageUrl = discoveredItem.imageUrl;
      itemChanged = true;
    }

    if (!arraysEqual(existingItem.galleryImageUrls, discoveredItem.galleryImageUrls)) {
      existingItem.galleryImageUrls = discoveredItem.galleryImageUrls;
      itemChanged = true;
    }

    if (syncSourceUpdate.changed) {
      existingItem.syncSource = syncSourceUpdate.source;
      itemChanged = true;
    }

    if (itemChanged) {
      existingItem.updatedAt = now;
      changed = true;
    }
  }

  for (const library of db.showcaseLibraries.filter((entry) => entry.syncSource?.mode === "FILESYSTEM")) {
    if (!library.syncSource || discovered.libraries.has(library.syncSource.key)) {
      continue;
    }

    const missingUpdate = markMissingLibrarySource(library.syncSource);
    if (missingUpdate.changed) {
      library.syncSource = missingUpdate.source;
      library.updatedAt = now;
      changed = true;
    }
  }

  for (const item of db.showcaseItems.filter((entry) => entry.syncSource?.mode === "FILESYSTEM")) {
    if (!item.syncSource || discovered.items.has(item.syncSource.key)) {
      continue;
    }

    const missingUpdate = markMissingItemSource(item.syncSource);
    if (missingUpdate.changed) {
      item.syncSource = missingUpdate.source;
      item.updatedAt = now;
      changed = true;
    }
  }

  return changed;
}

export function isShowcaseFilesystemSyncEnabled() {
  return Boolean(showcaseFilesystemRoot);
}

export function getShowcaseFilesystemRoot() {
  return showcaseFilesystemRoot;
}

export async function isShowcaseFilesystemRootReachable() {
  return Boolean(showcaseFilesystemRoot && (await pathExists(showcaseFilesystemRoot)));
}

export async function resolveShowcaseFilesystemAsset(relativeSegments: string[]) {
  if (!relativeSegments.length) {
    return null;
  }

  const relativePath = toSyncPath(path.join(...relativeSegments));

  if (showcaseFilesystemRoot) {
    const resolvedRoot = path.resolve(showcaseFilesystemRoot);
    const absolutePath = path.resolve(resolvedRoot, ...relativeSegments);
    const normalizedRoot = `${resolvedRoot}${path.sep}`.toLowerCase();
    const normalizedCandidate = absolutePath.toLowerCase();

    if (normalizedCandidate !== resolvedRoot.toLowerCase() && !normalizedCandidate.startsWith(normalizedRoot)) {
      return null;
    }

    try {
      const fileStats = await stat(absolutePath);
      if (fileStats.isFile()) {
        return {
          absolutePath,
          contentType: getUploadContentType(path.basename(absolutePath)),
        };
      }
    } catch {
      // Fallback to committed cache for environments like Render.
    }
  }

  const cachedAssetPath = getCachedAssetAbsolutePath(relativePath);

  try {
    const cachedStats = await stat(cachedAssetPath);
    if (!cachedStats.isFile()) {
      return null;
    }

    return {
      absolutePath: cachedAssetPath,
      contentType: getUploadContentType(path.basename(cachedAssetPath)),
    };
  } catch {
    return null;
  }
}
