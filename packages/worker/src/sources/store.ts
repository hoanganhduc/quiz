import type { Env } from "../env";
import { validateSourcesConfig, type SourcesConfigV1 } from "@app/shared";

const KEY = "sources:v1";

export const DEFAULT_SOURCES_CONFIG: SourcesConfigV1 = {
  version: "v1",
  courseCode: "default-course",
  subjects: [{ id: "discrete-math", title: "Discrete Mathematics" }],
  uidNamespace: "default-uid",
  sources: []
};

export async function getSourcesConfig(env: Env): Promise<SourcesConfigV1> {
  const raw = await env.QUIZ_KV.get(KEY);
  if (!raw) {
    return DEFAULT_SOURCES_CONFIG;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Stored sources config is not valid JSON");
  }
  return validateSourcesConfig(json);
}

export async function putSourcesConfig(env: Env, config: SourcesConfigV1): Promise<SourcesConfigV1> {
  const validated = validateSourcesConfig(config);
  await env.QUIZ_KV.put(KEY, JSON.stringify(validated));
  return validated;
}
