# Development setup and deployment guide

Complete from-scratch setup for this project using **npm workspaces** and **npx**.

## 1) Local prerequisites
- Install **Node.js 20+** and **Git**.
- Verify:  
  ```bash
  node -v
  npm -v
  ```
- Optional (recommended): VS Code + GitHub Copilot, `jq` for JSON formatting.

## 2) Accounts & credentials to create

### A) Cloudflare Workers + KV
- [ ] Create a Cloudflare account and enable **Workers**.
- [ ] Create a **KV namespace** for v1 (note both `id` and `preview_id`).
- [ ] Create an **R2 bucket** (e.g. `quiz-uploads`) for admin uploads.
- [ ] Create a Cloudflare API token for CI with minimal perms:
  - Workers Scripts: **Edit**
  - Workers KV Storage: **Edit**
- [ ] Find **CLOUDFLARE_ACCOUNT_ID** in the Cloudflare dashboard (Workers overview).

### B) GitHub OAuth Apps (DEV + PROD recommended)
- [ ] Create DEV OAuth app. Callback: `http://localhost:8787/auth/callback/github`
- [ ] Create PROD OAuth app. Callback: `https://<your-worker>.workers.dev/auth/callback/github`
- [ ] Record `client_id` and `client_secret` for each.
- Note: Authorization callback URL must match exactly.

### C) Google Identity Services (OAuth client ID)
- [ ] Create OAuth 2.0 Client ID (Web application).
- Authorized JavaScript origins:
  - `http://localhost:5173`
  - `https://<username>.github.io` (or your Pages domain)
- Authorized redirect URIs:
  - `http://localhost:8787/auth/callback/google`
  - `https://<your-worker>.workers.dev/auth/callback/google`
- [ ] Record **GOOGLE_CLIENT_ID**. (ID-token flow uses only client ID.)
- [ ] Record **GOOGLE_CLIENT_SECRET** for OAuth code flow.

### D) GitHub Pages deployment (Actions)
- [ ] In GitHub repo settings, set Pages **Source = GitHub Actions**.

## 3) Secrets / env vars

### A) Cloudflare Worker (prod secrets)
Run inside `packages/worker`:
```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put JWT_SECRET
npx wrangler secret put CODE_PEPPER
npx wrangler secret put UI_ORIGIN          # pages origin, e.g. https://<user>.github.io
npx wrangler secret put GITHUB_CLIENT_ID   # PROD
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put CONFIG_ENC_KEY_B64
```

How to generate secret values:
- `ADMIN_TOKEN`: random string used for admin API access.
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `JWT_SECRET`: random string used for session signing.
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `CODE_PEPPER`: random string used for exam access code hashing.
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `CONFIG_ENC_KEY_B64`: base64-encoded **32-byte** key for encrypting stored secrets.
  ```bash
  node -e "console.log(Buffer.from(require('crypto').randomBytes(32)).toString('base64'))"
  ```

Keep these values stable in prod. Changing them can invalidate sessions or stored secrets.

### B) Worker local dev vars
Create `packages/worker/.dev.vars` (not committed) with `KEY=VALUE` pairs for:
- `ADMIN_TOKEN`
- `JWT_SECRET`
- `CODE_PEPPER`
- `UI_ORIGIN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CONFIG_ENC_KEY_B64`
Use your **DEV** GitHub OAuth keys here.

### C) UI local env
Create `packages/ui/.env.local` (not committed):
```
VITE_API_BASE=http://localhost:8787
VITE_GOOGLE_CLIENT_ID=dev-google-client-id
```

### D) GitHub Actions secrets (private repo)
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `WORKER_URL`
- `ADMIN_TOKEN`

### E) Worker vars for R2 uploads
Update `packages/worker/wrangler.toml`:
```
[[r2_buckets]]
binding = "UPLOADS_BUCKET"
bucket_name = "quiz-uploads"

[vars]
R2_PUBLIC_URL = "https://<your-worker>.workers.dev/files"
UPLOAD_TTL_HOURS = "72"
UPLOAD_MAX_BYTES = "104857600"
```

Example: if your Worker URL is `https://quiz-worker.example.workers.dev`, then:
- `R2_PUBLIC_URL = "https://quiz-worker.example.workers.dev/files"`
- A stored key like `tools/abc.zip` is reachable at:
  `https://quiz-worker.example.workers.dev/files/tools/abc.zip`
- `UPLOAD_TTL_HOURS` controls auto-delete of uploads (default 72 hours).
- `UPLOAD_MAX_BYTES` controls max upload size (default 104857600 bytes).

## 4) Local run instructions
```bash
npm install
npm run scan:secrets
npm test
npm run bank:gen          # expect packages/bank-gen/dist/bank.public.v1.json and bank.answers.v1.json
npm run dev               # runs worker on http://localhost:8787 and UI on http://localhost:5173
npm run kv:seed           # uploads banks to preview KV for wrangler dev
```

### Enable git pre-commit secret scan
```bash
git config core.hooksPath .githooks
```

### Local Smoke Tests
```bash
curl http://localhost:8787/health
curl -i http://localhost:8787/auth/me
curl -X POST http://localhost:8787/admin/exams \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
        "subject":"discrete-math",
        "composition":[{"topic":"topic1","level":"basic","n":1}],
        "policy":{"authMode":"none","requireViewCode":false,"requireSubmitCode":false,"solutionsMode":"after_submit"}
      }'
```
The exam creation response includes `examId`. Open the UI at `http://localhost:5173/#/exam/<subject>/<examId>`.

## 5) Production deploy instructions (high level)
- CI (GitHub Actions) will: install, test, generate banks, build, deploy worker, upload banks to KV, and deploy UI to GitHub Pages via Actions.
- Manual fallback commands (inside repo):
  ```bash
  npx wrangler deploy
  npx wrangler --config packages/worker/wrangler.toml kv:key put banks:discrete-math:latest:public --binding QUIZ_KV --path packages/bank-gen/dist/bank.public.v1.json
  npx wrangler --config packages/worker/wrangler.toml kv:key put banks:discrete-math:latest:answers --binding QUIZ_KV --path packages/bank-gen/dist/bank.answers.v1.json
  ```

## 6) Production smoke tests
```bash
curl https://<your-worker>.workers.dev/health
curl -X POST https://<your-worker>.workers.dev/admin/exams \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"discrete-math","composition":[{"topic":"topic1","level":"basic","n":1}],"policy":{"authMode":"none","requireViewCode":false,"requireSubmitCode":false,"solutionsMode":"after_submit"}}'
```
- Confirm UI origin and CORS match `UI_ORIGIN`.
- Verify GitHub login uses **PROD** OAuth app callback (`https://<your-worker>.workers.dev/auth/callback/github`).
- Verify Google login works from your Pages origin.

## 7) Common Pitfalls
- Cookie Secure/SameSite issues: localhost (http) vs prod (https) behave differently; ensure UI_ORIGIN matches protocol.
- CORS origin mismatch: `UI_ORIGIN` must exactly match the UI host.
- GitHub callback URL mismatch: must match the OAuth app settings exactly.
- Google origin missing: add all required origins to the OAuth client.
- Banks not uploaded to KV: exam creation will fail if KV keys are missing.
- KV preview vs prod confusion: use preview for `wrangler dev`/kv:seed, prod for live deploys.
