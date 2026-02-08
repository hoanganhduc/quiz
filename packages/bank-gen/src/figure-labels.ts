import { createHash } from "node:crypto";

import { COMBINED_REGEX } from "./latex-render-regex.js";

export type LabelMap = {
  labels: Map<string, string>;
  hashes: Map<string, string>;
  kinds: Map<string, LabelKind>;
};

export type LabelKind = "figure" | "table" | "equation" | "block";

const LABEL_REGEX = /\\label\s*\{([^}]+)\}/g;

function normalizeContent(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function hashContent(content: string): string {
  return createHash("sha256").update(normalizeContent(content)).digest("hex").slice(0, 16);
}

/**
 * Collects labels from all blocks (figures, tables, equations, etc) sequentially.
 * This unifies the numbering across all types to match the UI's simple global sequence.
 */
export function collectSequentialLabels(contents: string[]): LabelMap {
  const labelMap = new Map<string, string>();
  const hashMap = new Map<string, string>();
  const kindMap = new Map<string, LabelKind>();

  let globalCounter = 0;

  for (const text of contents) {
    let match;
    COMBINED_REGEX.lastIndex = 0;
    while ((match = COMBINED_REGEX.exec(text)) !== null) {
      const minipageMatch = match[1];
      const blockMatch = match[2];
      const envName = match[3];

      if (minipageMatch) {
        // Minipages are treated as a single block for numbering if they contain figures/tables
        globalCounter++;
        const numStr = globalCounter.toString();
        const hash = hashContent(minipageMatch);
        hashMap.set(hash, numStr);

        let labelMatch;
        LABEL_REGEX.lastIndex = 0;
        while ((labelMatch = LABEL_REGEX.exec(minipageMatch)) !== null) {
          labelMap.set(labelMatch[1].trim(), numStr);
          kindMap.set(labelMatch[1].trim(), "block");
        }
      } else if (blockMatch) {
        const isMath = /^(align|equation|gather|multline|alignat|flalign)\*?$/.test(envName);

        if (isMath) {
          // Math environments get a new number for EACH label
          let labelMatch;
          LABEL_REGEX.lastIndex = 0;
          while ((labelMatch = LABEL_REGEX.exec(blockMatch)) !== null) {
            globalCounter++;
            const label = labelMatch[1].trim();
            labelMap.set(label, globalCounter.toString());
            kindMap.set(label, "equation");
          }
          // Also set hash for the block itself, mapping to the FIRST label's number or current counter
          const hash = hashContent(blockMatch);
          hashMap.set(hash, globalCounter.toString());
        } else {
          // Non-math blocks (figure, table, etc) get ONE number for the whole block
          globalCounter++;
          const numStr = globalCounter.toString();
          const hash = hashContent(blockMatch);
          hashMap.set(hash, numStr);

          const kind: LabelKind =
            /^(figure|figwindow)$/.test(envName) ? "figure" : /^(table|tabular|tabwindow)$/.test(envName) ? "table" : "block";

          let labelMatch;
          LABEL_REGEX.lastIndex = 0;
          while ((labelMatch = LABEL_REGEX.exec(blockMatch)) !== null) {
            const label = labelMatch[1].trim();
            labelMap.set(label, numStr);
            kindMap.set(label, kind);
          }
        }
      }
    }
  }

  return { labels: labelMap, hashes: hashMap, kinds: kindMap };
}

export function replaceFigureReferences(
  text: string,
  labelNumbers: Map<string, string>,
  language: "en" | "vi" = "vi",
  labelKinds?: Map<string, LabelKind>
): string {
  if (!text) return text;

  const figureName = language === "en" ? "Figure" : "Hình";
  const tableName = language === "en" ? "Table" : "Bảng";

  // Robust regex for \ref and its common prefixes
  // We now output a placeholder wrapped in a span which the UI will resolve.
  return text.replace(/(\\figurename|\\tablename)?\s*~?\s*\\ref\{([^}]+)\}/g, (match, prefix, label) => {
    const trimmedLabel = label.trim();
    const kind = labelKinds?.get(trimmedLabel);
    const resolvedNum = labelNumbers.get(trimmedLabel);
    const placeholder = `<span class="latex-fig-num" data-label="${trimmedLabel}">[[FIG_NUM_${trimmedLabel}]]</span>`;

    // If this is an equation/table/block ref, resolve immediately to avoid UI figure numbering.
    if (!prefix && kind && kind !== "figure") {
      const display = resolvedNum ?? "?";
      return `<a href="#fig-${trimmedLabel}" class="latex-ref">${display}</a>`;
    }
    if (prefix === "\\tablename" && kind && kind !== "figure") {
      const display = resolvedNum ?? "?";
      return `<a href="#fig-${trimmedLabel}" class="latex-ref">${tableName} ${display}</a>`;
    }

    if (prefix) {
      // Has \figurename or \tablename prefix - show as "Figure N" or "Hình N" etc.
      const typeName = prefix.includes("figure") || prefix.includes("figurename") ? figureName : tableName;
      const display = `${typeName} ${placeholder}`;
      return `<a href="#fig-${trimmedLabel}" class="latex-ref">${display}</a>`;
    } else {
      // Standalone \ref{} - just show the number, wrapped in a link
      return `<a href="#fig-${trimmedLabel}" class="latex-ref">${placeholder}</a>`;
    }
  });
}

/** @deprecated Use collectSequentialLabels */
export function collectFigureLabelNumbers(_files: string[]): Map<string, string> {
  return new Map();
}
