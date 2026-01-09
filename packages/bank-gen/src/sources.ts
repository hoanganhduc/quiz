import fg from "fast-glob";
import { readdirSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import AdmZip from "adm-zip";
import type {
  CanvasSourceDefV1,
  GitHubSourceDefV1,
  GoogleDriveFolderSourceDefV1,
  SourcesConfigV1,
  ZipSourceDefV1
} from "@app/shared";

type ResolvedGitHubAuth = { authorizationBearer: string };
type ResolvedZipAuth = { headerLine: string };

export type ResolvedSourcesConfigV1 = SourcesConfigV1 & {
  sources: (
    | (GitHubSourceDefV1 & { type: "github"; resolvedAuth?: ResolvedGitHubAuth })
    | (ZipSourceDefV1 & { type: "zip"; resolvedAuth?: ResolvedZipAuth })
    | (CanvasSourceDefV1 & { type: "canvas"; resolvedAuth?: ResolvedZipAuth })
    | (GoogleDriveFolderSourceDefV1 & { type: "gdrive"; resolvedAuth?: ResolvedZipAuth })
  )[];
};

export type ExportedSourcesConfigV1 = { generatedAt: string; config: ResolvedSourcesConfigV1 };

export function githubZipUrl(repo: string, branch: string) {
  return `https://api.github.com/repos/${repo}/zipball/${branch}`;
}

export function buildGitHubHeaders(resolvedAuth?: ResolvedGitHubAuth): Headers {
  const headers = new Headers();
  headers.set("Accept", "application/vnd.github+json");
  headers.set("User-Agent", "quiz-bank-gen");
  if (resolvedAuth?.authorizationBearer) {
    headers.set("Authorization", resolvedAuth.authorizationBearer);
  }
  return headers;
}

export function buildZipHeaders(resolvedAuth?: ResolvedZipAuth): Headers {
  const headers = new Headers();
  if (!resolvedAuth?.headerLine) return headers;

  const parts = resolvedAuth.headerLine.split(":");
  const name = parts.shift()?.trim();
  const value = parts.join(":").trim();
  if (!name || !value) {
    throw new Error("Invalid headerLine");
  }
  headers.set(name, value);
  return headers;
}

export async function loadSourcesConfigFile(filePath: string): Promise<ResolvedSourcesConfigV1> {
  const raw = await readFile(filePath, "utf8");
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in sources config file: ${filePath}`);
  }

  // Support export format: { config, generatedAt }
  if (json && typeof json === "object" && json.config && typeof json.generatedAt === "string") {
    return json.config as ResolvedSourcesConfigV1;
  }

  // Support raw config
  return json as ResolvedSourcesConfigV1;
}

async function writeResponseToFile(res: Response, filePath: string): Promise<void> {
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(filePath, buf);
}

function findSingleTopLevelDir(extractRoot: string): string {
  // GitHub zipball extracts into a single directory at the root.
  const entries = readdirSync(extractRoot, { withFileTypes: true });
  const dir = entries.find((e) => e.isDirectory())?.name;
  return dir ? join(extractRoot, dir) : extractRoot;
}

async function listDriveFiles(
  folderId: string,
  headers: Headers,
  extension: string
): Promise<{ id: string; name: string }[]> {
  const files: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  const normalizedExt = extension.toLowerCase();

  while (true) {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType)");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { method: "GET", headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to list gdrive folder (${res.status}): ${body || "Fetch failed"}`);
    }

    const json = (await res.json()) as any;
    const batch = Array.isArray(json?.files) ? json.files : [];
    for (const f of batch) {
      const name = typeof f?.name === "string" ? f.name : "";
      const id = typeof f?.id === "string" ? f.id : "";
      if (name.toLowerCase().endsWith(normalizedExt) && id) {
        files.push({ id, name });
      }
    }

    pageToken = typeof json?.nextPageToken === "string" ? json.nextPageToken : undefined;
    if (!pageToken) break;
  }

  return files;
}

async function downloadDriveFile(fileId: string, headers: Headers): Promise<Buffer> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const res = await fetch(url.toString(), { method: "GET", headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to download gdrive file ${fileId} (${res.status}): ${body || "Fetch failed"}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function downloadSourcesToTemp(config: ResolvedSourcesConfigV1): Promise<{
  tempDir: string;
  texFiles: string[];
  canvasZipFiles: string[];
}> {
  const tempDir = resolve(tmpdir(), `quiz-bank-gen-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const texFiles: string[] = [];
  const canvasZipFiles: string[] = [];

  try {
    for (const source of config.sources as any[]) {
      const sourceDir = resolve(tempDir, source.id);
      await mkdir(sourceDir, { recursive: true });

      if (source.type === "gdrive") {
        const headers = buildZipHeaders(source.resolvedAuth);
        const format = (source as any).format === "canvas" ? "canvas" : "latex";
        const ext = format === "canvas" ? ".zip" : ".tex";
        const files = await listDriveFiles(source.folderId, headers, ext);
        for (const f of files) {
          const safeName = f.name.replace(/[^A-Za-z0-9_.-]/g, "_");
          const target = resolve(sourceDir, `${f.id}-${safeName}`);
          const buf = await downloadDriveFile(f.id, headers);
          await writeFile(target, buf);
          if (format === "canvas") {
            canvasZipFiles.push(target);
          } else {
            texFiles.push(target);
          }
        }
        continue;
      }

      const zipPath = resolve(sourceDir, "source.zip");
      let url: string;
      let headers: Headers;

      if (source.type === "github") {
        url = githubZipUrl(source.repo, source.branch);
        headers = buildGitHubHeaders(source.resolvedAuth);
      } else {
        url = source.url;
        headers = buildZipHeaders(source.resolvedAuth);
      }

      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Failed to fetch ${source.id} (${res.status}): ${body || "Fetch failed"}`);
      }

      await writeResponseToFile(res, zipPath);

      if (source.type === "canvas") {
        canvasZipFiles.push(zipPath);
        continue;
      }

      const extractDir = resolve(sourceDir, "extracted");
      await mkdir(extractDir, { recursive: true });
      if (source.type === "zip" && (source as any).format === "canvas") {
        canvasZipFiles.push(zipPath);
        continue;
      }

      new AdmZip(zipPath).extractAllTo(extractDir, true);

      const root = source.type === "github" ? findSingleTopLevelDir(extractDir) : extractDir;
      const base = source.type === "github" ? resolve(root, source.dir) : source.dir ? resolve(root, source.dir) : root;

      if ((source.type === "github" && (source as any).format === "canvas") || (source.type === "zip" && (source as any).format === "canvas")) {
        const found = await fg("**/*.zip", { cwd: base, absolute: true });
        canvasZipFiles.push(...found);
      } else {
        const found = await fg("**/*.tex", { cwd: base, absolute: true });
        texFiles.push(...found);
      }
    }

    return { tempDir, texFiles, canvasZipFiles };
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true });
    throw err;
  }
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}
