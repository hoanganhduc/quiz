import { describe, it, expect } from "vitest";
import { parseLatexQuestions } from "../src/importers/latex/latexParse.js";

describe("parseLatexQuestions", () => {
  it("handles nested braces and comments", async () => {
    const tex = String.raw`
% comment should be removed
\baitracnghiem{graph:q01}{Prompt with {nested} braces \% and text}{\bonpa{A}{Choice {A}}{Choice {B}}{Choice {C}}{Choice {D}}}{Solution {nested}}
\baidienvao{graph:q02}{Compute \blank{a^{b^{c}}} and \answer{\frac{1}{2}} then \daugach{ignored}}{Solution \% with comment}
`;
    const result = await parseLatexQuestions(tex, { courseCode: "MAT3500", subject: "discrete-math" });
    expect(result.quiz.questions.length).toBe(2);

    const mcq = result.quiz.questions[0];
    expect(mcq.type).toBe("mcq-single");
    expect(mcq.choices[0].text).toBe("Choice {A}");

    const fib = result.quiz.questions[1];
    expect(fib.type).toBe("fill-blank");
    expect(fib.blankCount).toBe(2);

    const key = result.answerKey["latex:MAT3500:graph:q02"];
    expect(key.type).toBe("fill-blank");
    if (key.type === "fill-blank") {
      expect(key.acceptedAnswers).toEqual(["a^{b^{c}}", "\\frac{1}{2}"]);
    }
  });

  it("strips comments but keeps escaped percent", async () => {
    const tex = String.raw`
\baitracnghiem{graph:q03}{100\% correct % drop this
}{\bapa{1}{A}{B}{C}}{Solution}
`;
    const result = await parseLatexQuestions(tex, { courseCode: "MAT3500", subject: "discrete-math" });
    const q = result.quiz.questions[0];
    expect(q.prompt.includes("100\\%")).toBe(true);
  });
});
