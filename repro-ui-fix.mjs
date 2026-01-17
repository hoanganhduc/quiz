
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function isEscaped(input, index) {
    let count = 0;
    for (let i = index - 1; i >= 0 && input[i] === "\\"; i -= 1) {
        count += 1;
    }
    return count % 2 === 1;
}

function splitLatexSegments(input) {
    const segments = [];
    const delimiters = [
        { open: "$$", close: "$$" },
        { open: "\\[", close: "\\]" },
        { open: "\\(", close: "\\)" },
        { open: "$", close: "$" }
    ];

    let index = 0;
    while (index < input.length) {
        let nextIndex = -1;
        let next = null;

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

function transformLatexText(input) {
    return escapeHtml(input);
}

function formatLatexToHtml(input) {
    const blocks = [];
    const tokenPrefix = "__LATEX_BLOCK_TOKEN_";
    let text = input;
    let index = 0;

    while (true) {
        const start = text.indexOf("\\dongkhung", index);
        if (start === -1) break;
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
            const html = formatLatexToHtml(inner);
            const token = `${tokenPrefix}${blocks.length}__`;
            blocks.push(html);
            text = text.slice(0, start) + token + text.slice(pos);
            index = start + token.length;
        } else {
            index = start + 10;
        }
    }

    const segments = splitLatexSegments(text);
    let result = segments
        .map((segment) => (segment.type === "math" ? segment.value : transformLatexText(segment.value)))
        .join("");

    blocks.forEach((html, i) => {
        const token = `${tokenPrefix}${i}__`;
        result = result.replace(token, () => html); // FIX: Use function to avoid $ interpreting
    });

    return result;
}

const afterBankGen = `Ta chứng minh "$\\forall n \\in \\mathbb{N}\\, P(n)$" bằng quy nạp.`;
const nestedInput = `\\dongkhung{${afterBankGen}}`;

console.log("Result (with fix):", formatLatexToHtml(nestedInput));
