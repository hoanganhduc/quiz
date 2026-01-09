# Worker development

## Seeding preview KV

```bash
npm run kv:seed
```

This generates the latest banks and uploads them to the `QUIZ_KV` preview namespace (`banks:discrete-math:latest:public` and `banks:discrete-math:latest:answers`) used by `wrangler dev`.

## Local development server

```bash
npm run dev --workspace @app/worker
```
