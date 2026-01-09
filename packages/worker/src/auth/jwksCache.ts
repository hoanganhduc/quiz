import { createRemoteJWKSet } from "jose";

const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

const googleJwks = createRemoteJWKSet(GOOGLE_JWKS_URL, {
  cooldownDuration: 60 * 60 * 1000
});

export function getGoogleJwks() {
  return googleJwks;
}
