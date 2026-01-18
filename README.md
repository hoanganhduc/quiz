# Quiz Platform

This repo hosts the quiz app (UI + Worker) plus tooling for LaTeX and Canvas QTI/IMS-CC import/export.

## Packages

- `packages/ui`: student/admin UI
- `packages/worker`: API backend (Cloudflare Worker)
- `packages/shared`: shared types + import/export toolchain
- `packages/bank-gen`: LaTeX bank generator for CI

## Documentation

| Document | Description |
|----------|-------------|
| [docs/latex-rendering.md](docs/latex-rendering.md) | LaTeX rendering guide (MathJax, images, references) |
| [docs/import-export.md](docs/import-export.md) | Canvas/LaTeX import/export tooling |
| [docs/sources-admin.md](docs/sources-admin.md) | Sources & secrets management (Admin UI) |
| [docs/source-ci-setup.md](docs/source-ci-setup.md) | CI workflow for bank generation |
| [docs/user-guide.md](docs/user-guide.md) | Student guide for taking exams |

## Bank Generation (bank-gen)

The `bank-gen` package processes LaTeX source files into question banks.

### Features

- **TikZ/Figure/Table** → Rendered as PNG images
- **Math environments** (align, equation) → Preserved for MathJax
- **References** (`\ref{}`) → Resolved to sequential numbers
- **Image handling** → Automatic discovery and copying of `\includegraphics` assets

### Quick Usage

```bash
cd packages/bank-gen
npx tsx src/index.ts --latex-assets-dir ./output/latex --latex-assets-base /quiz/latex/
```

**CI Note:** Banks are automatically regenerated when `bank-gen` source files change (e.g., `latex-render.ts`).

See [docs/latex-rendering.md](docs/latex-rendering.md) for full documentation.

## Import/Export

The import/export toolchain lives in `@app/shared/importers` and supports:

- Canvas IMS-CC ZIP <-> app JSON schema (+ AnswerKey)
- LaTeX question bank <-> app JSON schema (+ AnswerKey)
- Direct converters (Canvas <-> LaTeX) composed from the above

See `docs/import-export.md` for full usage, CLI examples, and the Admin "Extra tools" GUI flow. Importers are exposed from `@app/shared/importers` (not the main `@app/shared` entrypoint).

## Quick CLI

Run from the repo root:

```bash
npm run cli --workspace @app/shared -- canvas-import path/to.zip --out out
npm run cli --workspace @app/shared -- latex-parse questions.tex --out out
npm run cli --workspace @app/shared -- canvas-to-latex path/to.zip --out out
npm run cli --workspace @app/shared -- latex-to-canvas questions.tex --quizTitle "Quiz A" --topic graph --out quiz.zip
```

## Tests

```bash
npm run test --workspace @app/shared -- --pool=threads
```
