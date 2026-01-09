import { describe, it, expect } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildLatexQuestions } from "../src/importers/latex/latexBuild.js";
import { parseLatexQuestions } from "../src/importers/latex/latexParse.js";
import { exportCanvasZip } from "../src/importers/canvasQti/ccBuild.js";
import { importCanvasZip } from "../src/importers/canvasQti/importCanvasZip.js";

describe("round-trip conversions", () => {
  it("round-trips LaTeX without losing answers", async () => {
    const tex = String.raw`
\baitracnghiem{graph:q01}{What is {nested}?}{\haipa{B}{Option {A}}{Option {B}}}{Solution}
\baidienvao{graph:q02}{Compute \blank{x^2} then \answer{y}}{Solution}
`;
    const parsed = await parseLatexQuestions(tex, { courseCode: "MAT3500", subject: "discrete-math" });
    const rebuilt = buildLatexQuestions(parsed.quiz, parsed.answerKey, {
      courseCode: "MAT3500",
      subject: "discrete-math",
      includeSolutions: true
    });
    const reparsed = await parseLatexQuestions(rebuilt, { courseCode: "MAT3500", subject: "discrete-math" });

    expect(reparsed.quiz.questions.length).toBe(2);
    expect(reparsed.answerKey["latex:MAT3500:graph:q01"]).toEqual(parsed.answerKey["latex:MAT3500:graph:q01"]);
    expect(reparsed.answerKey["latex:MAT3500:graph:q02"]).toEqual(parsed.answerKey["latex:MAT3500:graph:q02"]);
  });

  it("round-trips Canvas ZIP for supported types", async () => {
    const quiz = {
      version: { versionId: "Quiz graph", versionIndex: 0 },
      questions: [
        {
          uid: "latex:MAT3500:graph:q01",
          subject: "discrete-math",
          type: "mcq-single",
          id: "graph:q01",
          topic: "graph",
          level: "basic",
          number: 1,
          prompt: "What is 2+2?",
          choices: [
            { key: "A", text: "3" },
            { key: "B", text: "4" },
            { key: "C", text: "5" }
          ]
        },
        {
          uid: "latex:MAT3500:graph:q02",
          subject: "discrete-math",
          type: "fill-blank",
          id: "graph:q02",
          topic: "graph",
          level: "basic",
          number: 2,
          prompt: "Answer: \\underline{\\qquad}",
          blankCount: 1
        }
      ]
    };
    const answerKey = {
      "latex:MAT3500:graph:q01": { type: "mcq-single", correctKey: "B" as const },
      "latex:MAT3500:graph:q02": { type: "fill-blank", blankCount: 1, acceptedAnswers: ["4"] }
    };

    const zipBytes = await exportCanvasZip([quiz], answerKey, [], {
      courseCode: "MAT3500",
      subject: "discrete-math"
    });

    const tmpDir = resolve("packages/shared/tests/.tmp");
    mkdirSync(tmpDir, { recursive: true });
    const zipPath = join(tmpDir, "roundtrip.zip");
    writeFileSync(zipPath, zipBytes);

    const imported = await importCanvasZip(zipPath, { courseCode: "MAT3500", subject: "discrete-math" });
    const totalQuestions = imported.quizzes.reduce((sum, q) => sum + q.questions.length, 0);

    expect(totalQuestions).toBe(2);
    expect(imported.answerKey["latex:MAT3500:graph:q01"].type).toBe("mcq-single");
    expect(imported.answerKey["latex:MAT3500:graph:q02"].type).toBe("fill-blank");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
