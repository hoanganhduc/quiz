# Quiz Platform

This repo hosts the quiz app (UI + Worker) plus tooling for LaTeX and Canvas QTI/IMS-CC import/export.

## Packages

- `packages/ui`: student/admin UI
- `packages/worker`: API backend (Cloudflare Worker)
- `packages/shared`: shared types + import/export toolchain
- `packages/bank-gen`: LaTeX bank generator for CI

## Import/Export

The import/export toolchain lives in `@app/shared/importers` and supports:

- Canvas IMS-CC ZIP <-> app JSON schema (+ AnswerKey)
- LaTeX question bank <-> app JSON schema (+ AnswerKey)
- Direct converters (Canvas <-> LaTeX) composed from the above

See `docs/import-export.md` for full usage, CLI examples, and the Admin “Extra tools” GUI flow. Importers are exposed from `@app/shared/importers` (not the main `@app/shared` entrypoint).

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
