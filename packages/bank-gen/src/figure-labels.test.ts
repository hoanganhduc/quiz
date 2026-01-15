import { describe, it, expect } from "vitest";
import { replaceFigureReferences } from "./figure-labels";

describe("replaceFigureReferences", () => {
    const labelMap = new Map([
        ["fig:test", "1"]
    ]);

    it("should use 'Figure' for 'en' language", () => {
        const input = "See \\figurename~\\ref{fig:test}";
        const output = replaceFigureReferences(input, labelMap, "en");
        expect(output).toBe('See <a href="#fig-fig:test" class="latex-ref">Figure <span class="latex-fig-num" data-label="fig:test">[[FIG_NUM_fig:test]]</span></a>');
    });

    it("should use 'Hình' for 'vi' language", () => {
        const input = "See \\figurename~\\ref{fig:test}";
        const output = replaceFigureReferences(input, labelMap, "vi");
        expect(output).toBe('See <a href="#fig-fig:test" class="latex-ref">Hình <span class="latex-fig-num" data-label="fig:test">[[FIG_NUM_fig:test]]</span></a>');
    });

    it("should default to 'vi' if language is not provided", () => {
        const input = "See \\figurename~\\ref{fig:test}";
        const output = replaceFigureReferences(input, labelMap);
        expect(output).toBe('See <a href="#fig-fig:test" class="latex-ref">Hình <span class="latex-fig-num" data-label="fig:test">[[FIG_NUM_fig:test]]</span></a>');
    });

    it("should ignore LaTeX package detection (implicit logic removed)", () => {
        // Even with explicit english package or context, if language is 'vi', it should output 'Hình'
        const input = "\\usepackage[english]{babel} See \\figurename~\\ref{fig:test}";
        const output = replaceFigureReferences(input, labelMap, "vi");
        expect(output).toBe('\\usepackage[english]{babel} See <a href="#fig-fig:test" class="latex-ref">Hình <span class="latex-fig-num" data-label="fig:test">[[FIG_NUM_fig:test]]</span></a>');
    });

    it("should ignore LaTeX package detection for english", () => {
        // Even with explicit vietnam package, if language is 'en', it should output 'Figure'
        const input = "\\usepackage{vietnam} See \\figurename~\\ref{fig:test}";
        const output = replaceFigureReferences(input, labelMap, "en");
        expect(output).toBe('\\usepackage{vietnam} See <a href="#fig-fig:test" class="latex-ref">Figure <span class="latex-fig-num" data-label="fig:test">[[FIG_NUM_fig:test]]</span></a>');
    });
});
