import { describe, expect, it } from "vitest";
import { buildGitHubHeaders, buildZipHeaders } from "../src/sources.js";

describe("resolvedAuth header helpers", () => {
  it("uses resolvedAuth.authorizationBearer for GitHub sources", () => {
    const headers = buildGitHubHeaders({ authorizationBearer: "Bearer abc123" });
    expect(headers.get("Authorization")).toBe("Bearer abc123");
    expect(headers.get("Accept")).toBe("application/vnd.github+json");
  });

  it("does not set Authorization when resolvedAuth is missing", () => {
    const headers = buildGitHubHeaders(undefined);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("uses resolvedAuth.headerLine for zip sources", () => {
    const headers = buildZipHeaders({ headerLine: "X-Token: value:with:colons" });
    expect(headers.get("X-Token")).toBe("value:with:colons");
  });

  it("throws on invalid headerLine", () => {
    expect(() => buildZipHeaders({ headerLine: "not-a-header" })).toThrow(/Invalid headerLine/);
  });
});
