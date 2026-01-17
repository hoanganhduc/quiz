import { describe, it, expect } from "vitest";
import { replaceFigureReferences, collectSequentialLabels } from "./figure-labels";

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

describe("collectSequentialLabels", () => {
    it("should number math environments with multiple labels correctly", () => {
        const input = [
            `
            \\begin{align}
                x &= 1 \\label{eq:1} \\\\
                y &= 2 \\label{eq:2}
            \\end{align}
            `
        ];
        const { labels } = collectSequentialLabels(input);
        expect(labels.get("eq:1")).toBe("1");
        expect(labels.get("eq:2")).toBe("2");
    });

    it("should unify numbering across figures and math environments", () => {
        const input = [
            `
            \\begin{figure}
                \\caption{Fig 1} \\label{fig:1}
            \\end{figure}
            \\begin{align}
                x &= 1 \\label{eq:1}
            \\end{align}
            \\begin{figure}
                \\caption{Fig 2} \\label{fig:2}
            \\end{figure}
            `
        ];
        const { labels } = collectSequentialLabels(input);
        expect(labels.get("fig:1")).toBe("1");
        expect(labels.get("eq:1")).toBe("2");
        expect(labels.get("fig:2")).toBe("3");
    });

    it("should handle minipages with unified numbering", () => {
        const input = [
            `
            \\begin{minipage}{0.5\\textwidth}
                \\begin{figure}
                    \\caption{F1} \\label{fig:1}
                \\end{figure}
            \\end{minipage}
            \\begin{minipage}{0.5\\textwidth}
                \\begin{figure}
                    \\caption{F2} \\label{fig:2}
                \\end{figure}
            \\end{minipage}
            `
        ];
        const { labels } = collectSequentialLabels(input);
        expect(labels.get("fig:1")).toBe("1");
        expect(labels.get("fig:2")).toBe("1");
    });
});
