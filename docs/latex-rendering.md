# LaTeX Rendering Guide

**Last verified: 2026-01-18**

This document describes how LaTeX content is processed by `bank-gen` for display in the quiz app.

## Overview

The LaTeX rendering pipeline processes question content in multiple stages:
1. **Block environments** (tikz, figure, table, algorithm) → Rendered as PNG images
2. **Math environments** (align, equation) → Preserved for MathJax rendering in browser
3. **References** (`\ref{}`) → Resolved to actual numbers
4. **Typography** → Common LaTeX commands converted to HTML

## Supported Environments

### Rendered as PNG Images

These environments are compiled by `pdflatex` and converted to PNG:

| Environment | Description |
|-------------|-------------|
| `tikzpicture`, `tikz` | TikZ diagrams |
| `figure`, `figwindow` | Figures with captions |
| `table`, `tabular`, `tabwindow` | Tables |
| `algorithm`, `algo` | Algorithm blocks |
| `minipage` | Minipage groups |

### Rendered by MathJax (Browser)

These environments are preserved as LaTeX for MathJax to render:

| Environment | Description |
|-------------|-------------|
| `align`, `align*` | Aligned equations |
| `equation`, `equation*` | Single equations |
| `gather`, `gather*` | Gathered equations |
| `multline`, `multline*` | Multi-line equations |
| `alignat`, `alignat*` | Aligned at specific columns |
| `flalign`, `flalign*` | Full-width aligned equations |

Benefits of MathJax rendering:
- Text is selectable
- Smaller file sizes (no PNG per equation)
- Scales perfectly on any screen
- Better accessibility

## Reference Resolution (`\ref{}`)

### How Labels and References Work

1. **Label collection**: Before rendering, all `\label{}` commands are collected across all source files
2. **Sequential numbering**: Labels are assigned numbers in document order
3. **Reference resolution**: `\ref{label}` is replaced with the corresponding number

### Inside Math Environments

```latex
\begin{align}
  a &= b \label{eq:first}   % → \tag{1}
  c &= d \label{eq:second}  % → \tag{2}
\end{align}

See equation \ref{eq:first}  % → Shows "1"
```

- `\label{eq:x}` is converted to `\tag{N}` so MathJax displays the correct number
- `\ref{eq:x}` shows the same number N

### In Regular Text

```latex
\figurename~\ref{fig:x}  → "Hình 1" (linked)
\tablename~\ref{tab:x}   → "Bảng 2" (linked)
\ref{eq:x}               → "3" (linked)
```

References in text become clickable links that navigate to the referenced element.

## Image Handling (`\includegraphics`)

Images referenced in LaTeX are:

1. **Located**: Searched recursively from source directories using fast-glob
2. **Copied**: Only referenced images are copied (not entire directories)
3. **Path Updated**: LaTeX paths rewritten to use the copied file's basename

Example:
```latex
\includegraphics{figs/graph_theory/maps}
```
- System searches for `**/figs/graph_theory/maps.pdf` (or .png, .jpg, etc.)
- Found file copied to working directory
- Path rewritten to just `maps.pdf`

## Configuration Options

### CLI Options

```bash
npx tsx src/index.ts \
  --latex-assets-dir ./output/latex \
  --latex-assets-base /quiz/latex/
```

| Option | Description |
|--------|-------------|
| `--latex-assets-dir` | Directory to save rendered PNG images |
| `--latex-assets-base` | URL base path for image references in output |
| `--sources-config` | Path to sources configuration JSON |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `LATEX_CMD` | LaTeX compiler (default: `pdflatex`) |
| `LATEX_DEBUG` | Set to `1` to preserve temp files for debugging |

## Frontend Integration

The quiz app uses `better-react-mathjax` for math rendering:

```tsx
import { MathJaxContext, MathJax } from "better-react-mathjax";

// App wrapper
<MathJaxContext version={3} config={...}>
  <App />
</MathJaxContext>

// Content component
<MathJax renderMode="post" dynamic>
  <div dangerouslySetInnerHTML={{ __html: content }} />
</MathJax>
```

MathJax automatically renders:
- Display math environments (`\begin{align}...\end{align}`)
- Inline math (`$...$`)

## Output Format

### Math Environment Output

```html
<div id="fig-eq:label" class="latex-anchor math-anchor" data-latex-type="equation" data-label="eq:label"></div>
<div class="latex-math">
\begin{align}
  a &= b \tag{1}
\end{align}
</div>
```

### Figure Output

```html
<figure id="fig-label" data-latex-type="figure" data-label="label">
  <img src="/quiz/latex/latex-abc123.png" />
  <figcaption>Hình <span class="latex-fig-num">1</span>: Caption text</figcaption>
</figure>
```

## Troubleshooting

### LaTeX Compilation Errors

Enable debug mode to preserve temp files:
```bash
LATEX_DEBUG=1 npx tsx src/index.ts ...
```

Check the preserved directory for:
- `snippet.tex` - The generated LaTeX file
- `snippet.log` - LaTeX compilation log

### Missing Images

If `\includegraphics` fails:
1. Verify the image file exists in your source directory
2. Check that the path is relative (not absolute)
3. Use supported extensions: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.eps`, `.svg`

### MathJax Not Rendering

1. Verify MathJax is loaded in your frontend
2. Check browser console for MathJax errors
3. Ensure math environments are wrapped in `<div class="latex-math">`

## Implementation References

- LaTeX rendering: `packages/bank-gen/src/latex-render.ts`
- Figure labels: `packages/bank-gen/src/figure-labels.ts`
- Source downloading: `packages/bank-gen/src/sources.ts`
- Frontend component: `packages/ui/src/components/LatexContent.tsx`
