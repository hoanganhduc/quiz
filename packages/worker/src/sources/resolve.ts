import type { Env } from "../env";
import type { SourcesConfigV1 } from "@app/shared";
import { getSecretPlaintext } from "../secrets/store";

type ResolvedGitHubAuth = { authorizationBearer: string };
type ResolvedZipAuth = { headerLine: string };

export type ResolvedSourcesConfigV1 = SourcesConfigV1 & {
  sources: (
    | (SourcesConfigV1["sources"][number] & { type: "github"; resolvedAuth?: ResolvedGitHubAuth })
    | (SourcesConfigV1["sources"][number] & { type: "zip"; resolvedAuth?: ResolvedZipAuth })
    | (SourcesConfigV1["sources"][number] & { type: "canvas"; resolvedAuth?: ResolvedZipAuth })
    | (SourcesConfigV1["sources"][number] & { type: "gdrive"; resolvedAuth?: ResolvedZipAuth })
  )[];
};

async function resolveSecret(env: Env, secretRef: string): Promise<string> {
  const secret = await getSecretPlaintext(env, secretRef);
  if (!secret) {
    throw new Error(`Secret not found for ref: ${secretRef}`);
  }
  return secret;
}

export async function resolveForBuild(env: Env, config: SourcesConfigV1): Promise<ResolvedSourcesConfigV1> {
  const resolvedSources = [];
  for (const source of config.sources) {
    if (source.type === "github") {
      let resolvedAuth: ResolvedGitHubAuth | undefined;
      if (source.auth) {
        if (!source.auth.secretRef) {
          throw new Error("Missing secretRef for github source");
        }
        const token = await resolveSecret(env, source.auth.secretRef);
        resolvedAuth = { authorizationBearer: `Bearer ${token}` };
      }
      resolvedSources.push({ ...source, resolvedAuth });
    } else if (source.type === "zip" || source.type === "canvas" || source.type === "gdrive") {
      let resolvedAuth: ResolvedZipAuth | undefined;
      if (source.auth) {
        if (!source.auth.secretRef) {
          throw new Error("Missing secretRef for zip/canvas source");
        }
        const headerVal = await resolveSecret(env, source.auth.secretRef);
        resolvedAuth = { headerLine: headerVal };
      }
      resolvedSources.push({ ...source, resolvedAuth });
    } else {
      // exhaustive
      resolvedSources.push(source as any);
    }
  }

  return {
    ...config,
    sources: resolvedSources
  };
}
