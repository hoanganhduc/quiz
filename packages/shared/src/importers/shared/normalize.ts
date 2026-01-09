import * as cheerio from "cheerio";
import he from "he";
import { ImportedAsset, ensureAssetFromZip, mapFilebaseSrcToZipPath } from "./assets.js";

export function slugify(value: string): string {
  const trimmed = value.trim().replace(/^Quiz\s+/i, "");
  const ascii = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function shouldDisplayMath(latex: string): boolean {
  return latex.includes("\\begin") || latex.includes("\n");
}

function htmlToText($: cheerio.CheerioAPI): string {
  $("br").replaceWith("\n");
  $("p, div, li").each((_, el) => {
    const node = $(el);
    node.append("\n\n");
  });
  const raw = $.root().text();
  return raw.replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeCanvasHtml(
  html: string,
  opts: {
    zipEntries?: Map<string, Buffer>;
    assetsOut?: Map<string, ImportedAsset>;
    warnings: string[];
  }
): string {
  const decoded = he.decode(html ?? "", { isAttributeValue: false });
  const $ = cheerio.load(decoded, { decodeEntities: false } as any);

  $("img.equation_image").each((_, el) => {
    const latex = $(el).attr("data-equation-content") ?? "";
    const content = shouldDisplayMath(latex) ? `\\[${latex}\\]` : `\\(${latex}\\)`;
    $(el).replaceWith(content);
  });

  $("img").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    const zipPath = mapFilebaseSrcToZipPath(src);
    if (!zipPath) return;
    const name = zipPath.split("/").pop() ?? zipPath;
    if (opts.zipEntries && opts.assetsOut) {
      ensureAssetFromZip(opts.zipEntries, zipPath, opts.assetsOut, opts.warnings);
    } else {
      opts.warnings.push(`Asset referenced but no zip data provided: ${zipPath}`);
    }
    $(el).replaceWith(`[image: ${name}]`);
  });

  return htmlToText($);
}
