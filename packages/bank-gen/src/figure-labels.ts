import { createHash } from "node:crypto";

export type LabelMap = {
  labels: Map<string, string>;
  hashes: Map<string, string>;
};

const FIGURE_ENV_REGEX = /\\begin\{(figure|figwindow)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g;
const TABLE_ENV_REGEX = /\\begin\{(table|tabwindow|tabular)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g;

function normalizeContent(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function hashContent(content: string): string {
  return createHash("sha256").update(normalizeContent(content)).digest("hex").slice(0, 16);
}

/**
 * Collects figure and table numbers by scanning content sequentially.
 * This ensures global, non-resetting numbers and handles unlabeled figures.
 */
export function collectSequentialLabels(contents: string[]): LabelMap {
  const labelMap = new Map<string, string>();
  const hashMap = new Map<string, string>();

  let figureCounter = 0;
  let tableCounter = 0;

  for (const text of contents) {
    // We scan for both figures and tables in separate passes? 
    // Usually they have separate counters in LaTeX.

    // Figures
    let match;
    while ((match = FIGURE_ENV_REGEX.exec(text)) !== null) {
      figureCounter++;
      const fullMatch = match[0];
      const innerContent = match[2];
      const numStr = figureCounter.toString();

      // Hash based on normalized full match (including begin/end)
      const hash = hashContent(fullMatch);
      hashMap.set(hash, numStr);

      // Search for label
      const labelMatch = /\\label\s*\{([^}]+)\}/.exec(innerContent);
      if (labelMatch) {
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

      const labelMatch = /\\label\s*\{([^}]+)\}/.exec(innerContent);
      if (labelMatch) {
        labelMap.set(labelMatch[1].trim(), numStr);
      }
    }

    // Reset regex state for next content string
    FIGURE_ENV_REGEX.lastIndex = 0;
    TABLE_ENV_REGEX.lastIndex = 0;
  }

  return { labels: labelMap, hashes: hashMap };
}

export function replaceFigureReferences(
  text: string,
  labelNumbers: Map<string, string>,
  language: "en" | "vi" = "vi"
): string {
  if (!text) return text;

  const figureName = language === "en" ? "Figure" : "Hình";
  const tableName = language === "en" ? "Table" : "Bảng";

  // Match both \ref and \figurename~\ref or \tablename~\ref
  // We handle both figure and table labels in the same map for simplicity here,
  // but if collision is a concern, we could store type in the map.

  return text.replace(/(\\figurename|\\tablename)?\s*~?\s*\\ref\{([^}]+)\}/g, (match, prefix, label) => {
    const trimmedLabel = label.trim();
    const resolved = labelNumbers.get(trimmedLabel);

    let display = resolved || trimmedLabel;
    if (resolved === undefined) {
      console.warn(`[bank-gen] Warning: Reference label '${trimmedLabel}' not found in label map.`);
    }

    if (prefix) {
      const typeName = prefix.includes("figure") ? figureName : tableName;
      display = `${typeName} ${display}`;
    } else {
      // If no prefix but it's a known label, we might want to guess? 
      // For now stay literal but wrap in link.
    }

    return `<a href="#fig-${trimmedLabel}" class="latex-ref">${display}</a>`;
  });
}

// Keep the old name for backward compatibility in index.ts for a moment, 
// but it will be moved.
export function collectFigureLabelNumbers(_files: string[]): Map<string, string> {
  // This is no longer the right place if we want sequential questions.
  // We will remove this after updating index.ts.
  return new Map();
}
