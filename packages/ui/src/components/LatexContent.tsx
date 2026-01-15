import { useMemo } from "react";
import { MathJax } from "better-react-mathjax";
import clsx from "clsx";

type Props = {
  content?: string;
  inline?: boolean;
  className?: string;
};

type Segment = { type: "text" | "math"; value: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isEscaped(input: string, index: number): boolean {
  let count = 0;
  for (let i = index - 1; i >= 0 && input[i] === "\\"; i -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

function splitLatexSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  const delimiters = [
    { open: "$$", close: "$$" },
    { open: "\\[", close: "\\]" },
    { open: "\\(", close: "\\)" },
    { open: "$", close: "$" }
  ];

  let index = 0;
  while (index < input.length) {
    let nextIndex = -1;
    let next = null as (typeof delimiters)[number] | null;

    for (const delim of delimiters) {
      const found = input.indexOf(delim.open, index);
      if (found === -1) continue;
      if (delim.open === "$" && isEscaped(input, found)) continue;
      if (
        nextIndex === -1 ||
        found < nextIndex ||
        (found === nextIndex && next && delim.open.length > next.open.length)
      ) {
        nextIndex = found;
        next = delim;
      }
    }

    if (!next || nextIndex === -1) {
      segments.push({ type: "text", value: input.slice(index) });
      break;
    }

    if (nextIndex > index) {
      segments.push({ type: "text", value: input.slice(index, nextIndex) });
    }

    const start = nextIndex + next.open.length;
    const end = input.indexOf(next.close, start);
    if (end === -1) {
      segments.push({ type: "text", value: input.slice(nextIndex) });
      break;
    }

    segments.push({ type: "math", value: input.slice(nextIndex, end + next.close.length) });
    index = end + next.close.length;
  }

  return segments;
}

function applyWrappedCommand(text: string, command: string, openTag: string, closeTag: string): string {
  const token = `\\${command}{`;
  let result = "";
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf(token, index);
    if (start === -1) {
      result += text.slice(index);
      break;
    }
    result += text.slice(index, start);
    let pos = start + token.length;
    let depth = 1;
    while (pos < text.length && depth > 0) {
      if (text[pos] === "{") depth += 1;
      else if (text[pos] === "}") depth -= 1;
      pos += 1;
    }
    if (depth !== 0) {
      result += text.slice(start);
      break;
    }
    const inner = text.slice(start + token.length, pos - 1);
    result += `${openTag}${inner}${closeTag}`;
    index = pos;
  }
  return result;
}

function applyBlockCommand(text: string, command: string, className: string): string {
  const token = `\\${command}{`;
  let result = "";
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf(token, index);
    if (start === -1) {
      result += text.slice(index);
      break;
    }
    result += text.slice(index, start);
    let pos = start + token.length;
    let depth = 1;
    while (pos < text.length && depth > 0) {
      if (text[pos] === "{") depth += 1;
      else if (text[pos] === "}") depth -= 1;
      pos += 1;
    }
    if (depth !== 0) {
      result += text.slice(start);
      break;
    }
    const inner = text.slice(start + token.length, pos - 1);
    result += `<div class="${className}">${inner}</div>`;
    index = pos;
  }
  return result;
}

function transformLatexText(input: string): string {
  const htmlTagTokens: string[] = [];
  const verbTokens: string[] = [];
  const imgTokens: string[] = [];

  // Protect HTML tags first so bank-gen injected HTML is preserved
  let text = input.replace(/<\/?[a-z][a-z0-9]*[^>]*>/gi, (match) => {
    const token = `__HTML_TAG_${htmlTagTokens.length}__`;
    htmlTagTokens.push(match);
    return token;
  });

  text = text.replace(/\\verb(.)([\s\S]*?)\1/g, (_match, _delim, body: string) => {
    const html = `<code class="latex-code">${escapeHtml(body)}</code>`;
    const token = `__LATEX_VERB_${verbTokens.length}__`;
    verbTokens.push(html);
    return token;
  });
  text = text.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g, (_match, src: string) => {
    const cleanSrc = escapeHtml(src.trim());
    const html = `<img class="latex-graphic" src="${cleanSrc}" alt="latex graphic" />`;
    const token = `__LATEX_IMG_${imgTokens.length}__`;
    imgTokens.push(html);
    return token;
  });

  text = escapeHtml(text);
  text = text.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, '<div class="latex-figure latex-omit">[TikZ diagram omitted]</div>');
  text = text.replace(/\\begin\{tikz\}[\s\S]*?\\end\{tikz\}/g, '<div class="latex-figure latex-omit">[TikZ diagram omitted]</div>');
  text = text.replace(/\\begin\{center\}/g, '<div class="latex-center">');
  text = text.replace(/\\end\{center\}/g, "</div>");
  text = text.replace(/\\begin\{flushleft\}/g, '<div class="latex-left">');
  text = text.replace(/\\end\{flushleft\}/g, "</div>");
  text = text.replace(/\\begin\{flushright\}/g, '<div class="latex-right">');
  text = text.replace(/\\end\{flushright\}/g, "</div>");
  text = text.replace(/\\begin\{figure\}/g, '<div class="latex-figure">');
  text = text.replace(/\\end\{figure\}/g, "</div>");
  text = text.replace(/\\begin\{table\}/g, '<div class="latex-table">');
  text = text.replace(/\\end\{table\}/g, "</div>");
  text = text.replace(/\\begin\{tabular\}(\[[^\]]*\])?(\{[^}]*\})?/g, '<div class="latex-table latex-tabular">');
  text = text.replace(/\\end\{tabular\}/g, "</div>");
  text = text.replace(/\\begin\{itemize\}/g, '<ul class="latex-list">');
  text = text.replace(/\\end\{itemize\}/g, "</ul>");
  text = text.replace(/\\begin\{enumerate\}/g, '<ol class="latex-list">');
  text = text.replace(/\\end\{enumerate\}/g, "</ol>");
  text = text.replace(/\\item\s*/g, "<li>");
  text = text.replace(/<li>([\s\S]*?)(?=<li>|<\/ul>|<\/ol>)/g, "<li>$1</li>");

  text = applyWrappedCommand(text, "emph", "<em>", "</em>");
  text = applyWrappedCommand(text, "textit", "<em>", "</em>");
  text = applyWrappedCommand(text, "textbf", "<strong>", "</strong>");
  text = applyWrappedCommand(text, "textsf", '<span class="latex-sans">', "</span>");
  text = applyWrappedCommand(text, "textsc", '<span class="latex-smallcaps">', "</span>");
  text = applyWrappedCommand(text, "underline", '<span class="latex-underline">', "</span>");
  text = applyWrappedCommand(text, "texttt", '<code class="latex-code">', "</code>");
  text = applyWrappedCommand(text, "textsuperscript", "<sup>", "</sup>");
  text = applyWrappedCommand(text, "textsubscript", "<sub>", "</sub>");

  text = text.replace(/\\par/g, "<br />");
  text = text.replace(/\\newline/g, "<br />");
  text = text.replace(/\\\\/g, "<br />");
  text = text.replace(/\r?\n/g, "<br />");

  verbTokens.forEach((html, index) => {
    text = text.split(`__LATEX_VERB_${index}__`).join(html);
  });
  imgTokens.forEach((html, index) => {
    text = text.split(`__LATEX_IMG_${index}__`).join(html);
  });
  htmlTagTokens.forEach((tag, index) => {
    text = text.split(`__HTML_TAG_${index}__`).join(tag);
  });

  return text;
}

function formatLatexToHtml(input: string): string {
  if (!input) return "";

  const blocks: string[] = [];
  const tokenPrefix = "__LATEX_BLOCK_TOKEN_";

  let text = input;
  let index = 0;

  // 1. Process block-level commands balanced-brace wise
  // This allows them to contain math segments ($...$) without being broken by splitLatexSegments
  while (true) {
    // Normalizing whitespace slightly just to find the token
    const start = text.indexOf("\\dongkhung", index);
    if (start === -1) break;

    // Check if it's \dongkhung{
    let braceStart = text.indexOf("{", start + 10);
    if (braceStart === -1 || text.slice(start + 10, braceStart).trim() !== "") {
      index = start + 10;
      continue;
    }

    let pos = braceStart + 1;
    let depth = 1;
    while (pos < text.length && depth > 0) {
      if (text[pos] === "{") depth += 1;
      else if (text[pos] === "}") depth -= 1;
      pos += 1;
    }

    if (depth === 0) {
      const inner = text.slice(braceStart + 1, pos - 1).trim();
      const html = `<div class="latex-box latex-box-block">${formatLatexToHtml(inner)}</div>`;
      const token = `${tokenPrefix}${blocks.length}__`;
      blocks.push(html);
      text = text.slice(0, start) + token + text.slice(pos);
      index = start + token.length;
    } else {
      index = start + 10;
    }
  }

  // 2. Process math and standard text segments
  const segments = splitLatexSegments(text);
  let result = segments
    .map((segment) => (segment.type === "math" ? segment.value : transformLatexText(segment.value)))
    .join("");

  // 3. Replace block tokens back
  blocks.forEach((html, i) => {
    result = result.replace(`${tokenPrefix}${i}__`, html);
  });

  return result;
}

export function LatexContent({ content, inline = false, className }: Props) {
  const html = useMemo(() => formatLatexToHtml(content ?? ""), [content]);
  if (inline) {
    return (
      <MathJax renderMode="post" inline dynamic>
        <span className={clsx(className)} dangerouslySetInnerHTML={{ __html: html }} />
      </MathJax>
    );
  }
  return (
    <MathJax renderMode="post" dynamic>
      <div className={clsx(className)} dangerouslySetInnerHTML={{ __html: html }} />
    </MathJax>
  );
}
