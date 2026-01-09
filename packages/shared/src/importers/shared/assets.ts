import { extname, basename } from "node:path";

export type ImportedAsset = { zipPath: string; bytes: Buffer; mime: string; suggestedName: string };

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

export function guessMimeFromPath(path: string): string {
  return MIME_BY_EXT[extname(path).toLowerCase()] ?? "application/octet-stream";
}

export function mapFilebaseSrcToZipPath(src: string): string | null {
  const marker = "$IMS-CC-FILEBASE$/";
  const idx = src.indexOf(marker);
  if (idx === -1) return null;
  const rest = src.slice(idx + marker.length).replace(/^\/+/, "");
  if (!rest) return null;
  const decoded = decodeURIComponent(rest);
  return `web_resources/${decoded}`;
}

export function ensureAssetFromZip(
  zipEntries: Map<string, Buffer>,
  zipPath: string,
  collected: Map<string, ImportedAsset>,
  warnings: string[]
): ImportedAsset | undefined {
  const existing = collected.get(zipPath);
  if (existing) return existing;
  const bytes = zipEntries.get(zipPath);
  if (!bytes) {
    warnings.push(`Missing asset referenced in content: ${zipPath}`);
    return undefined;
  }
  const asset: ImportedAsset = {
    zipPath,
    bytes,
    mime: guessMimeFromPath(zipPath),
    suggestedName: basename(zipPath)
  };
  collected.set(zipPath, asset);
  return asset;
}

export function buildAssetNameLookup(assets: ImportedAsset[]): Map<string, ImportedAsset> {
  const map = new Map<string, ImportedAsset>();
  for (const asset of assets) {
    if (!map.has(asset.suggestedName)) {
      map.set(asset.suggestedName, asset);
    }
  }
  return map;
}

export function encodeFilebasePath(zipPath: string): string {
  const rest = zipPath.replace(/^web_resources\//, "");
  return rest
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}
