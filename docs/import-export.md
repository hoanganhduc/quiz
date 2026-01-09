# Import/Export Toolchain

**Last verified: 2026-01-09**

This doc describes the Canvas QTI/IMS-CC and LaTeX import/export tooling provided by `@app/shared/importers`.

## 1) Overview

Supported conversions:

- Canvas IMS-CC ZIP <-> app JSON schema (+ AnswerKey)
- LaTeX question-bank <-> app JSON schema (+ AnswerKey)
- Direct converters (Canvas <-> LaTeX) composed from the above

The system is designed for:

- brace-aware LaTeX parsing (nested braces)
- deterministic IDs
- explicit warnings (not hard crashes)
- asset extraction and rewriting

## 2) Public API (TypeScript)

Key entry points exported from `@app/shared/importers`:

- `importCanvasZip(zipPath, opts)`
- `exportCanvasZip(quizzes, answerKey, assets, opts)`
- `parseLatexQuestions(tex, opts)`
- `buildLatexQuestions(quiz, answerKey, opts)`
- `canvasZipToLatex(zipPath, opts)`
- `latexToCanvasZip(tex, opts)`

Option shape:

```
type ImportOptions = {
  courseCode: string;
  subject: string;
  level?: string;
  versionIndex?: number;
  topicByQuizTitle?: Record<string,string>;
  fillBlankExportMode?: "combined_short_answer" | "split_items";
  combinedDelimiter?: string;
};
```

## 3) CLI usage

The CLI lives in `packages/shared/src/cli.ts` and is exposed as:

```
npm run cli --workspace @app/shared -- <command> [options]
```

### Canvas import

```
npm run cli --workspace @app/shared -- canvas-import path/to.zip --out out
```

Outputs:
- `out/quizzes.json`
- `out/answerKey.json`
- `out/warnings.json`
- `out/assets/...`

### Canvas export

```
npm run cli --workspace @app/shared -- canvas-export \
  --quizzes out/quizzes.json \
  --answerKey out/answerKey.json \
  --out quiz.zip \
  --assets out/assets
```

### LaTeX parse/build

```
npm run cli --workspace @app/shared -- latex-parse questions.tex --out out
npm run cli --workspace @app/shared -- latex-build --quiz out/quiz.json --answerKey out/answerKey.json --out out.tex
```

### Direct converters

```
npm run cli --workspace @app/shared -- canvas-to-latex path/to.zip --out out
npm run cli --workspace @app/shared -- latex-to-canvas questions.tex --quizTitle "Quiz A" --topic graph --out quiz.zip
```

## 4) Admin UI tools

Admins can use **Admin → Extra tools** to run Canvas ↔ LaTeX conversions from the browser. The UI can fetch files via GitHub, Google Drive, direct HTTPS links, or upload to R2, then downloads outputs + warnings. R2 uploads auto-expire based on `UPLOAD_TTL_HOURS`.

## 5) Assets

Canvas assets are extracted from `web_resources/...` and referenced in prompts as:

```
[image: filename.png]
```

On export, placeholders are converted back to:

```
<img src="$IMS-CC-FILEBASE$/...">
```

## 6) Warnings

The importers are tolerant and emit warnings for:

- unknown question types
- missing correctness patterns
- missing assets or placeholder mismatch
- fill-blank placeholder inconsistencies

Always check `warnings.json` after import.
