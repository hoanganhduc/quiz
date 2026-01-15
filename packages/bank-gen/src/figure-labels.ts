import { createHash } from "node:crypto";

export type LabelMap = {
  labels: Map<string, string>;
  hashes: Map<string, string>;
};

const FIGURE_ENV_REGEX = /\\begin\{(figure|figwindow)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g;
const TABLE_ENV_REGEX = /\\begin\{(table|tabwindow|tabular)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g;
const LABEL_REGEX = /\\label\s*\{([^}]+)\}/g;

function normalizeContent(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function hashContent(content: string): string {
  return createHash("sha256").update(normalizeContent(content)).digest("hex").slice(0, 16);
}

/**
 * Collects figure and table labels by scanning content sequentially.
 * This is still used to find all labels, but the UI will handle the actual numbering.
 */
export function collectSequentialLabels(contents: string[]): LabelMap {
  const labelMap = new Map<string, string>();
  const hashMap = new Map<string, string>();

  let figureCounter = 0;
  let tableCounter = 0;

  for (const text of contents) {
    // Figures
    let match;
    while ((match = FIGURE_ENV_REGEX.exec(text)) !== null) {
      figureCounter++;
      const fullMatch = match[0];
      const innerContent = match[2];
      const numStr = figureCounter.toString();

      const hash = hashContent(fullMatch);
      hashMap.set(hash, numStr);

      // Search for ALL labels in this environment
      let labelMatch;
      LABEL_REGEX.lastIndex = 0; // Reset for inner search
      while ((labelMatch = LABEL_REGEX.exec(innerContent)) !== null) {
        labelMap.set(labelMatch[1].trim(), numStr);
      }
    }

    // Tables
    while ((match = TABLE_ENV_REGEX.exec(text)) !== null) {
      tableCounter++;
      const fullMatch = match[0];
      const innerContent = match[2];
      const numStr = tableCounter.toString();

      const hash = hashContent(fullMatch);
      hashMap.set(hash, numStr);

      let labelMatch;
      LABEL_REGEX.lastIndex = 0; // Reset for inner search
      while ((labelMatch = LABEL_REGEX.exec(innerContent)) !== null) {
        labelMap.set(labelMatch[1].trim(), numStr);
      }
    }

    FIGURE_ENV_REGEX.lastIndex = 0;
    TABLE_ENV_REGEX.lastIndex = 0;
  }

  return { labels: labelMap, hashes: hashMap };
}

export function replaceFigureReferences(
  text: string,
  _labelNumbers: Map<string, string>,
  language: "en" | "vi" = "vi"
): string {
  if (!text) return text;

  const figureName = language === "en" ? "Figure" : "Hình";
  const tableName = language === "en" ? "Table" : "Bảng";

  // Robust regex for \ref and its common prefixes
  // We now output a placeholder wrapped in a span which the UI will resolve.
  return text.replace(/(\\figurename|\\tablename)?\s*~?\s*\\ref\{([^}]+)\}/g, (match, prefix, label) => {
    const trimmedLabel = label.trim();
    const placeholder = `<span class="latex-fig-num" data-label="${trimmedLabel}">[[FIG_NUM_${trimmedLabel}]]</span>`;

    let display = placeholder;
    if (prefix) {
      const typeName = prefix.includes("figure") || prefix.includes("figurename") ? figureName : tableName;
      display = `${typeName} ${display}`;
    }

    return `<a href="#fig-${trimmedLabel}" class="latex-ref">${display}</a>`;
  });
}

/** @deprecated Use collectSequentialLabels */
export function collectFigureLabelNumbers(_files: string[]): Map<string, string> {
  return new Map();
}
