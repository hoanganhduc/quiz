# Sources & Secrets (Admin)

**Last verified: 2026-01-08**

This is the authoritative guide for managing **Sources** (question LaTeX inputs) and **Secrets** (auth material for private sources) via the Admin UI.

> Security rule: never include real secrets in docs, screenshots, logs, or examples. Use placeholders like `<ADMIN_TOKEN>`.

See also:
- CI setup and workflow details: `docs/source-ci-setup.md`
- Troubleshooting: `docs/source-admin-troubleshooting.md`
- Import/export tooling: `docs/import-export.md`

## 1) Overview

### What this feature does

- Lets admins manage a **Sources config** stored in Worker KV (for CI/bank generation workflows).
- Lets admins manage **Secrets** stored in Worker KV **encrypted at rest**.
- Lets admins **test** whether a configured source is reachable (without downloading the full content in common cases).

### What this feature does NOT do

- The browser UI does **not** fetch any “resolved secrets” export.
- The UI does **not** display stored secret values (only names + updated timestamps).
- The Worker does **not** currently implement an `/admin/sources/export` endpoint (even though CI is configured to call it; see §11).

## 2) Where it lives

- UI route (HashRouter): `/#/admin/sources`
  - (Screenshot: Admin “Sources & Secrets” page with Cards)

- Worker admin endpoints used by the UI:
  - `GET /admin/sources`
  - `PUT /admin/sources`
  - `POST /admin/sources/test`
  - `GET /admin/r2/usage`
  - `GET /admin/secrets`
  - `PUT /admin/secrets/:name`
  - `DELETE /admin/secrets/:name`

## 3) Prerequisites

### Admin access rules (Worker)

All `/admin/*` endpoints are protected by `requireAdmin`.

- **Origin gating:** if the request includes an `Origin` header and it is not `UI_ORIGIN`, the Worker returns **403**.
  - Browser requests include `Origin`, so your UI must be hosted at `UI_ORIGIN`.
  - CI/server-side requests typically omit `Origin` and are allowed through the origin gate.
- **Admin auth options:**
  1) `Authorization: Bearer <ADMIN_TOKEN>` (token-based admin)
  2) Admin session cookie (user must have `roles` containing `"admin"`)

### Worker URL / UI configuration

- UI must be configured with `VITE_API_BASE` pointing at the Worker base URL.
  - Example (local): `http://127.0.0.1:8787`

### Worker environment variables (relevant)

From `packages/worker/src/env.ts`:
- `UI_ORIGIN` — allowed origin for browser calls.
- `ADMIN_TOKEN` — bearer token for CI/admin automation.
- `CONFIG_ENC_KEY_B64` — base64-encoded 32-byte key used for AES-GCM encryption of secret values.

### CI setup (GitHub Actions)

CI secrets and workflow behavior are documented in `docs/source-ci-setup.md`.

## 4) Page layout (Tailwind UI terminology)

The page is composed of:
- **Cards**
  - **CI Integration** (display-only)
  - **Sources configuration**
  - **Secrets**
- **Modals**
  - Add/Edit **Source** Modal
  - Create/Update **Secret** Modal
- **Alerts**
  - page-level success/error status
  - modal validation and request errors
- **Badges**
  - source type (`github` / `zip`)
  - auth status (No auth / Secret ref / Missing secret)
  - test result (OK/FAIL)

(Screenshot: Sources configuration Card showing sources list + Badges)

## 5) Secrets management

### What’s stored

- Secret **values** are stored in KV under keys prefixed with `secret:` and encrypted using **AES-GCM**.
- Secret **names** must match: `/^[a-zA-Z0-9-_]{1,60}$/`.

### Create / update a secret

1. Open the **Secrets** Card.
2. Click **New secret** (or **Edit** if present).
3. Enter:
   - `name` (example placeholder: `github_pat`)
   - `value` (never shown again)
4. Click **Save**.

Security behavior (UI):
- Values are entered in a password field with a show/hide toggle.
- Values are held only in memory while the Modal is open, and cleared on close/save.
- The UI does not use localStorage for secrets.

API call (Worker):
- `PUT /admin/secrets/:name` with JSON body `{ "value": "…" }` → `{ ok: true }`.

(Screenshot: Create/Update Secret Modal with password field)

### Delete a secret

- From the Secrets list, delete the secret name.
- API call: `DELETE /admin/secrets/:name` → `{ ok: true }`.

> Note: deleting a secret does not automatically update existing sources; sources referencing that `secretRef` will become “Missing secret” in the UI.

## 6) Sources configuration

### Where it’s stored

- Sources config is stored in Worker KV at key: `sources:v1`.
- `GET /admin/sources` returns the stored config; if missing, Worker returns `DEFAULT_SOURCES_CONFIG`.

### Top-level fields

`SourcesConfigV1` includes:
- `version`: must be `"v1"`
- `courseCode`: required
- `subject`: required
- `uidNamespace`: required
- `sources`: array of sources (ids must be unique)

## 7) Adding GitHub sources

Use when your LaTeX sources live in a GitHub repo.

Fields:
- `id`: unique identifier (used as a temp folder name in bank-gen)
- `repo`: `OWNER/REPO`
- `branch`: branch name
- `dir`: relative path inside the repo zipball (must be relative; cannot start with `/`; cannot include `..`)
- `format`: `latex` (default) or `canvas` (IMS-CC zip files in the repo)

Auth (private repos):
- Set auth kind: `githubToken`
- Set `secretRef` to the **name** of a secret that holds a GitHub token (PAT).

Worker test behavior:
- Tests GitHub sources via `HEAD https://api.github.com/repos/<repo>/zipball/<branch>`.
- Adds `Authorization: Bearer <token>` when `resolvedAuth` exists.

(Screenshot: Add/Edit Source Modal configured for GitHub + auth toggle)

## 8) Adding ZIP sources

Use when sources are provided as a downloadable zip.

Fields:
- `id`: unique identifier
- `url`: must start with `https://`
- `dir` (optional): relative subdirectory within the extracted zip (same relative path rules as above)
- `format`: `latex` (default) or `canvas` (IMS-CC zip)

Auth (HTTP header via secret):
- Set auth kind: `httpHeader`
- Set `secretRef` to a secret whose **value is the full header line**, e.g. `"Authorization: Bearer <TOKEN>"`.
  - The Worker parses by splitting on `:`; the part before the first `:` becomes the header name and the remainder becomes the value.

Worker test behavior:
- Tests zip sources via a partial fetch: `GET <url>` with `Range: bytes=0-0`.
- Applies the parsed header when `resolvedAuth.headerLine` exists.

(Screenshot: Add/Edit Source Modal configured for ZIP + url/dir + auth toggle)

### Canvas IMS-CC via ZIP sources

Use when your source is a Canvas IMS-CC export zip.

- Set `type` to `zip`.
- Set `format` to `canvas`.
- Provide the IMS-CC zip URL (https).
- Optional auth uses the same `httpHeader` secret pattern as ZIP sources.

Worker test behavior is the same as ZIP sources (range request).

### Uploading zip to R2 (admin only)

The Sources modal includes an **Upload zip** control for ZIP sources. The Worker stores the file in R2 and returns a URL that is filled into `url`.

Requirements:
- Bind an R2 bucket as `UPLOADS_BUCKET` in `wrangler.toml`.
- Set `R2_PUBLIC_URL` to the Worker files base URL (e.g. `https://<your-worker>.workers.dev/files`).
- Optional: `UPLOAD_TTL_HOURS` (default 72) controls auto-delete for uploaded files.
- Optional: `UPLOAD_MAX_BYTES` (default 104857600) controls max upload size.

Uploads return warnings when R2 usage crosses 50% of the free tier (Class A/B ops or stored bytes, tracked by the Worker).

### R2 usage panel

The Settings page includes an **Upload** card that shows R2 usage totals and recent uploads. It also performs best-effort cleanup of expired uploads.

## 9) Adding Google Drive sources

Use when your sources live in a Google Drive folder.

- `folderId`: the Drive folder ID.
- `format`: `latex` (default, *.tex) or `canvas` (IMS-CC *.zip).

## 10) Testing sources (`POST /admin/sources/test`)

### What it checks

- Verifies the source can be fetched with the configured auth.
- Uses a lightweight request pattern:
  - GitHub: `HEAD` to the zipball URL
  - Zip: `GET` with `Range: bytes=0-0`

### Request

```json
{ "sourceId": "<source-id>" }
```

### Typical outcomes

- **OK**: response `{ "ok": true, "status": 200 }` (status may vary by host, but must be `res.ok`).
- **Auth failure / forbidden**: `{ "ok": false, "status": 401 | 403, "message": "Fetch failed" }`.
- **Not found**: `{ "ok": false, "status": 404, "message": "Fetch failed" }`.
- **Network failure**: HTTP **502** with `{ "ok": false, "status": 0, "message": "Fetch failed" }`.

> Note: Testing resolves secrets server-side (`resolveForBuild`) before making the request.

## 11) Saving config and getting changes to production

### Save config

- UI performs client-side validation and then calls:
  - `PUT /admin/sources` with the full `SourcesConfigV1` JSON.
- Worker validates again (`validateSourcesConfig`) before storing to KV.

(Screenshot: Save config button + success Alert)

### How updates reach production

See `docs/source-ci-setup.md` for the current workflow triggers (schedule/dispatch), bank generation, and KV upload steps.

## 12) CI export (CI-only)

CI is configured to fetch `GET <WORKER_URL>/admin/sources/export` using `Authorization: Bearer <ADMIN_TOKEN>`.

- **Current code status:** the Worker does not implement `/admin/sources/export` yet, so CI export will fail until it exists.
- Details (curl template + security rules) are in `docs/source-ci-setup.md`.

## 13) Security model summary

- **Secrets at rest:** stored encrypted in Worker KV using **AES-GCM**.
  - Key material: `CONFIG_ENC_KEY_B64` (must decode to 32 bytes).
  - KV keys: `secret:<name>`.
- **Secrets in UI:** secret values are never displayed and are cleared from memory on modal close/save.
- **Admin auth:** enforced by `requireAdmin` with origin gating + token/session-based access.
- **No TeX persistence during CI bank generation:** bank-gen downloads/extracts zips into an OS temp directory and deletes it afterwards (cleanup in `finally`).

## 13) Smoke-test checklist (after changes)

If you hit issues, see `docs/source-admin-troubleshooting.md`.

1. Open `/#/admin/sources` and confirm the page loads (no “Forbidden origin”).
2. Secrets:
   - Create a new secret (name + value) → verify it appears in the list with updated timestamp.
   - Delete a secret → verify it disappears.
3. Sources:
   - Add a GitHub source (public repo) and click **Test** → expect OK.
   - Add a ZIP source (https URL) and click **Test** → expect OK.
   - If using auth, confirm the source row shows the intended secretRef and no secret values are displayed.
4. Save:
   - Click **Save config** → reload page and confirm the config persists.
5. CI readiness:
   - Confirm `.github/workflows/deploy.yml` secrets are set (`WORKER_URL`, `ADMIN_TOKEN`).
   - Confirm `/admin/sources/export` exists before relying on CI export (currently missing).

## 14) Implementation references

- Worker admin auth: `packages/worker/src/admin/requireAdmin.ts` (`requireAdmin`)
- Worker sources routes: `packages/worker/src/admin/sources.ts` (`registerAdminSourcesRoutes`)
- Worker secrets routes: `packages/worker/src/admin/secrets.ts` (`registerAdminSecretsRoutes`)
- Sources KV storage: `packages/worker/src/sources/store.ts` (KV key `sources:v1`)
- Secret encryption + storage:
  - `packages/worker/src/secrets/crypto.ts` (`importKeyFromB64`, AES-GCM)
  - `packages/worker/src/secrets/store.ts` (`putSecret`, `getSecretPlaintext`, prefix `secret:`)
- Secret resolution for tests/builds: `packages/worker/src/sources/resolve.ts` (`resolveForBuild`)
- bank-gen sources ingestion + cleanup: `packages/bank-gen/src/sources.ts` (`loadSourcesConfigFile`, `downloadSourcesToTemp`, `cleanupTempDir`)
- CI workflow: `.github/workflows/deploy.yml`
- UI page + API client:
  - `packages/ui/src/pages/admin/SourcesManagerPage.tsx`
  - `packages/ui/src/api/sourcesAdmin.ts`
