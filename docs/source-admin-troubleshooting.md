# Sources & Secrets Troubleshooting

**Last verified: 2026-01-08**

Symptom → cause → fix checklist for the **Sources & Secrets** admin workflow.

## Admin UI page won’t load

### Symptom: UI shows errors loading Sources/Secrets
- Likely causes:
  - `VITE_API_BASE` is not set or points to the wrong Worker URL.
  - Worker is rejecting the browser origin.
- Fix:
  - Set `VITE_API_BASE` to the Worker base URL.
  - Ensure Worker `UI_ORIGIN` exactly matches the origin hosting the UI.

### Symptom: Worker returns `403 Forbidden origin`
- Cause: request included an `Origin` header not equal to `UI_ORIGIN`.
- Fix: set Worker `UI_ORIGIN` to the UI origin, and access the UI from that origin.

## Admin auth failures

### Symptom: `401 Unauthorized`
- Cause: not logged in as admin and no valid `Authorization: Bearer <ADMIN_TOKEN>` header was provided.
- Fix:
  - Log in and ensure your user has the `admin` role, or
  - Use the bearer token in CI/server-side calls.

### Symptom: `403 Forbidden` (but not “Forbidden origin”)
- Cause: you are logged in, but your user record does not include `roles: ["admin", …]`.
- Fix: grant admin role (admin user management) and retry.

## Secrets issues

### Symptom: Can’t create/update a secret (400)
- Likely causes:
  - Secret name fails validation (must match `/^[a-zA-Z0-9-_]{1,60}$/`).
  - Missing/empty `value` in request.
  - Worker `CONFIG_ENC_KEY_B64` is invalid (must decode to 32 bytes).
- Fix:
  - Use a valid name.
  - Ensure `CONFIG_ENC_KEY_B64` is configured correctly.

### Symptom: Source shows “Missing secret” badge
- Cause: a source references `secretRef` that is not present in `GET /admin/secrets`.
- Fix: create the missing secret name, or update the source to reference an existing secret.

## Source testing failures (`POST /admin/sources/test`)

### Symptom: Test returns 404 “Source not found”
- Cause: `sourceId` does not match any `config.sources[].id` in KV.
- Fix: ensure you saved the config and that the `id` matches exactly.

### Symptom: ZIP source test returns 400 “Invalid headerLine”
- Cause: the secret value for a ZIP auth header does not contain a valid `Name: Value` format.
- Fix: store a full header line like `Authorization: Bearer <TOKEN>`.

### Symptom: Test returns 401/403/404 with `{ ok:false, message:"Fetch failed" }`
- Cause: upstream denied the request or the URL/repo/branch is wrong.
- Fix:
  - For GitHub: confirm `repo`, `branch`, and (if private) the token secret.
  - For ZIP: confirm `https://` URL and any required auth header.

### Symptom: Test returns 502 with status 0
- Cause: network failure fetching the upstream.
- Fix: retry; if persistent, check upstream availability from the Worker environment.

## CI failures

### Symptom: CI fails fetching `/admin/sources/export`
- Cause: CI workflow calls `/admin/sources/export`, but the Worker currently has no such route.
- Fix: implement the export endpoint in the Worker, or adjust the workflow to use only supported endpoints.

## Implementation references

- UI page: `packages/ui/src/pages/admin/SourcesManagerPage.tsx`
- UI API client: `packages/ui/src/api/sourcesAdmin.ts`
- Worker admin auth: `packages/worker/src/admin/requireAdmin.ts`
- Worker secrets storage: `packages/worker/src/secrets/store.ts` + `packages/worker/src/secrets/crypto.ts`
- Worker sources routes: `packages/worker/src/admin/sources.ts`
