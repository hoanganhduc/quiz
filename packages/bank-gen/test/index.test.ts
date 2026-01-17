import { BankAnswersV1Schema, BankPublicV1Schema } from "@app/shared";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildBanksFromFiles,
  parseFillBlankQuestionsFromContent,
  parseQuestionsFromContent,
  stripComments
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("stripComments", () => {
  it("removes unescaped % while preserving escaped \\%", () => {
    const input = "Keep \\% symbol and text % remove this part\nLine two % gone";
    const output = stripComments(input);
    expect(output).toContain("\\% symbol and text");
    expect(output).not.toContain("remove this part");
    expect(output).toContain("Line two");
  });
});

describe("parsing", () => {
  it("handles nested braces in prompt and solution", () => {
    const content = `
      \\baitracnghiem{graph:q12}{Prompt with {nested {details}} braces}{\\bonpa{B}{A}{B text}{C}{D}}{Solution {deeply {nested}} text}
    `;
    const result = parseQuestionsFromContent(stripComments(content), "inline.tex", "MAT3500", "discrete-math");
    expect(result).toHaveLength(1);
    expect(result[0].publicQuestion.prompt).toContain("nested {details}");
    expect(result[0].answerQuestion.solution).toContain("deeply {nested}");
    expect((result[0].answerQuestion as any).answerKey).toBe("B");
  });

  it("parses haipa/bapa/nampa choice blocks", () => {
    const content = `
      \\baitracnghiem{graph:q14}{P1}{\\haipa{2}{A}{B}}{S1}
      \\baitracnghiem{graph:q15}{P2}{\\bapa{3}{A}{B}{C}}{S2}
      \\baitracnghiem{graph:q16}{P3}{\\nampa{5}{A}{B}{C}{D}{E}}{S3}
    `;
    const result = parseQuestionsFromContent(stripComments(content), "choices.tex", "MAT3500", "discrete-math");
    expect(result).toHaveLength(3);

    expect((result[0].answerQuestion as any).answerKey).toBe("B");
    expect((result[0].publicQuestion as any).choices.map((c: any) => c.key)).toEqual(["A", "B"]);

    expect(result[1].answerQuestion.answerKey).toBe("C");
    expect((result[1].publicQuestion as any).choices.map((c: any) => c.key)).toEqual(["A", "B", "C"]);

    expect((result[2].answerQuestion as any).answerKey).toBe("E");
    expect((result[2].publicQuestion as any).choices.map((c: any) => c.key)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("parses fill-blank with inline \\blank/\\answer", () => {
    const content = `
      \\baidienvao{graph:q20}{Compute \\blank{42} and then \\answer{x+y}.}{Solution text}
    `;
    const result = parseFillBlankQuestionsFromContent(stripComments(content), "fib.tex", "MAT3500", "discrete-math");
    expect(result).toHaveLength(1);

    const pub = result[0].publicQuestion;
    const ans = result[0].answerQuestion;

    expect(pub.type).toBe("fill-blank");
    expect((pub as any).blankCount).toBe(2);
    expect(pub.prompt).not.toContain("42");

    expect(ans.type).toBe("fill-blank");
    expect((ans as any).answers).toEqual(["42", "x+y"]);
  });

  it("excludes commented-out questions after stripping", () => {
    const content = `
      % \\baitracnghiem{graph:q13}{Should not parse}{\\bonpa{A}{1}{2}{3}{4}}{Ignored}
    `;
    const result = parseQuestionsFromContent(stripComments(content), "commented.tex", "MAT3500", "discrete-math");
    expect(result).toHaveLength(0);
  });

  it("rejects duplicate choice texts within the same question", () => {
    const content = `
      \\baitracnghiem{graph:q99}{Prompt}{\\bonpa{A}{Same}{Same}{C}{D}}{Solution}
    `;
    expect(() =>
      parseQuestionsFromContent(stripComments(content), "dup-choices.tex", "MAT3500", "discrete-math")
    ).toThrow(/Duplicate choice text/i);
  });
});

describe("bank generation", () => {
  it("produces schema-valid banks in stable uid order", async () => {
    const fixturesDir = resolve(__dirname, "fixtures");
    const files = [resolve(fixturesDir, "q2.tex"), resolve(fixturesDir, "q1.tex")];
    const { publicBank, answersBank } = await buildBanksFromFiles(files, "MAT3500", "discrete-math");

    expect(publicBank.questions.map((q) => q.uid)).toEqual([
      "latex:MAT3500:advanceprobability:q02",
      "latex:MAT3500:graph:q01"
    ]);

    expect(() => BankPublicV1Schema.parse(publicBank)).not.toThrow();
    expect(() => BankAnswersV1Schema.parse(answersBank)).not.toThrow();

    const answerKeys = answersBank.questions
      .filter((q) => q.type === "mcq-single")
      .map((q) => q.answerKey);
    expect(answerKeys).toEqual(["A", "C"]);
  });

  it("rejects duplicate question contents across different ids", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "bank-gen-"));
    try {
      const f1 = resolve(dir, "a.tex");
      const f2 = resolve(dir, "b.tex");

      writeFileSync(
        f1,
        stripComments(`\\baitracnghiem{graph:q01}{Same prompt}{\\bonpa{A}{A}{B}{C}{D}}{Sol1}`),
        "utf8"
      );
      writeFileSync(
        f2,
        stripComments(`\\baitracnghiem{graph:q02}{Same prompt}{\\bonpa{B}{A}{B}{C}{D}}{Sol2}`),
        "utf8"
      );

      await expect(buildBanksFromFiles([f1, f2], "MAT3500", "discrete-math")).rejects.toThrow(
        /Duplicate question content/i
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
