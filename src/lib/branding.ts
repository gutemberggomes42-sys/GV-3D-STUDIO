export const studioBrandName = "GV 3D Studio";
export const studioBrandLogoPath = "/branding/gv-3d-studio-logo.png";
export const studioCollectionName = "Colecao GV 3D Studio";

export const legacyStudioBrandNames = ["PrintFlow 3D"];

export function isLegacyStudioBrandName(value?: string | null) {
  const normalizedValue = value?.trim().toLowerCase();
  return Boolean(
    normalizedValue &&
      legacyStudioBrandNames.some((brandName) => brandName.toLowerCase() === normalizedValue),
  );
}
