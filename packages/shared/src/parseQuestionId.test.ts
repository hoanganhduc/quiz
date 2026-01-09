import { describe, expect, it } from "vitest";
import { parseQuestionId } from "./index.js";

describe("parseQuestionId", () => {
  it("parses basic question ids", () => {
    expect(parseQuestionId("graph:q12")).toEqual({
      topic: "graph",
      level: "basic",
      number: 12
    });
  });

  it("parses advanced question ids", () => {
    expect(parseQuestionId("advancecombinatorics:q03")).toEqual({
      topic: "combinatorics",
      level: "advanced",
      number: 3
    });
  });

  it("throws on invalid format", () => {
    expect(() => parseQuestionId("bad-format")).toThrowError(/Invalid question id/);
  });
});
