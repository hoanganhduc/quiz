import { collectSequentialLabels, replaceFigureReferences } from "./src/figure-labels";

async function main() {
    console.log("--- Testing Sequential Counting and Hashing ---");

    const question1 = `
    Hãy xem Hình \\ref{fig:one}.
    \\begin{figure}
      \\centering
      \\includegraphics{fig1.png}
      \\caption{Hình đầu tiên}
      \\label{fig:one}
    \\end{figure}
  `;

    const question2 = `
    Đây là một hình không có label.
    \\begin{figure}
      \\centering
      \\includegraphics{fig2.png}
      \\caption{Hình thứ hai}
    \\end{figure}
    Và đây là Hình \\ref{fig:three}.
    \\begin{figure}
      \\centering
      \\includegraphics{fig3.png}
      \\caption{Hình thứ ba}
      \\label{fig:three}
    \\end{figure}
  `;

    const contents = [question1, question2];
    const labelData = collectSequentialLabels(contents);

    console.log("Label Map:", JSON.stringify(Object.fromEntries(labelData.labels), null, 2));
    console.log("Hash Map Size:", labelData.hashes.size);

    console.log("\n--- Testing Reference Replacement ---");
    const replaced1 = replaceFigureReferences(question1, labelData.labels, "vi");
    console.log("Question 1 Replaced:\n", replaced1);

    const replaced2 = replaceFigureReferences(question2, labelData.labels, "vi");
    console.log("Question 2 Replaced:\n", replaced2);

    console.log("\n--- Verification ---");
    if (labelData.labels.get("fig:one") === "1" && labelData.labels.get("fig:three") === "3") {
        console.log("SUCCESS: Sequential labels (1, 3) correctly assigned.");
    } else {
        console.error("FAILURE: Incorrect label mapping.");
    }

    // Verify unlabeled figure exists in hash map
    const unlabeledFig = `\\begin{figure}
      \\centering
      \\includegraphics{fig2.png}
      \\caption{Hình thứ hai}
    \\end{figure}`;
    // Note: normalization might be tricky here if whitespace differs
}

main().catch(console.error);
