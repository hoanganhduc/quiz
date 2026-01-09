# Sources CI Setup

**Last verified: 2026-01-08**

This document covers the CI workflow that generates question banks from configured Sources and uploads them to KV.

> Security rule: never include real secrets in docs, logs, or examples. Use placeholders like `<ADMIN_TOKEN>`.

## Required GitHub Actions secrets

From `.github/workflows/deploy.yml`:
- `WORKER_URL` — Worker base URL (example placeholder: `https://<your-worker>.workers.dev`).
- `ADMIN_TOKEN` — admin bearer token used by CI for worker admin endpoints.
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — used by Wrangler for deploy + KV writes.

## Workflow triggers

The deploy workflow runs on:
- push to `main`
- manual `workflow_dispatch`
- schedule: every 6 hours (`cron: "0 */6 * * *"`)

## Workflow steps (high level)

1) **Install + test**
- `npm ci`
- `npm test`

2) **Fetch runtime sources export (CI only)**

The workflow currently fetches an export file into `sources.runtime.json`:

```bash
curl -sS \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "<WORKER_URL>/admin/sources/export" \
  > sources.runtime.json
```

Auth/Origin notes:
- CI requests typically do not send an `Origin` header.
- Admin access is via the bearer token.

`/admin/sources/export` returns `{ generatedAt, config }` with resolved auth for CI use.

3) **Generate banks**

- `npm run gen --workspace @app/bank-gen -- --sources-config sources.runtime.json`

`bank-gen` behavior (important):
- Accepts either a raw sources config or an exported wrapper `{ generatedAt, config }`.
- Downloads zip(s), extracts into an OS temp directory (`quiz-bank-gen-<uuid>`), finds `**/*.tex`, and deletes the temp directory afterwards.

4) **Build + deploy**
- `npm run build` (tsc)
- `npm run build --workspace @app/ui`
- `npx wrangler deploy` (worker)

5) **Upload banks to KV**

The workflow writes the generated JSON files into KV using Wrangler:
- `banks:discrete-math:latest:public`
- `banks:discrete-math:latest:answers`

6) **Deploy UI to GitHub Pages (Actions)**

The workflow uploads `packages/ui/dist` as a Pages artifact and deploys with `actions/deploy-pages`.

Pages settings:
- Repo Settings → Pages → Source = **GitHub Actions**

7) **Cleanup**

Always removes `sources.runtime.json` and deletes any directories named `.tmp` under the workspace.

## Implementation references

- CI workflow: `.github/workflows/deploy.yml`
- bank-gen sources ingestion + cleanup: `packages/bank-gen/src/sources.ts` (`loadSourcesConfigFile`, `downloadSourcesToTemp`, `cleanupTempDir`)
- bank-gen entrypoint: `packages/bank-gen/src/index.ts` (`--sources-config`)
- Worker admin auth: `packages/worker/src/admin/requireAdmin.ts` (`requireAdmin`)
