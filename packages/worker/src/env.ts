export type Env = {
  QUIZ_KV: KVNamespace;
  UPLOADS_BUCKET: R2Bucket;
  ADMIN_TOKEN: string;
  ADMIN_BOOTSTRAP_GITHUB_USERNAME?: string;
  ADMIN_BOOTSTRAP_EMAIL?: string;
  JWT_SECRET: string;
  CODE_PEPPER: string;
  UI_ORIGIN: string;
  R2_PUBLIC_URL?: string;
  UPLOAD_TTL_HOURS?: string;
  UPLOAD_MAX_BYTES?: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  CONFIG_ENC_KEY_B64: string;
};
