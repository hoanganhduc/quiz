import { collectSequentialLabels, replaceFigureReferences } from "./src/figure-labels";

async function main() {
  console.log("--- Testing Multi-Label Resolution and Sorting ---");

  // Simulate questions with numeric IDs
  const q9 = `
    \\baitracnghiem{q9}{
      Xem Hình \\ref{fig:one}.
      \\begin{figure}
        \\centering
        \\includegraphics{f1.png}
        \\caption{Figure One}
        \\label{fig:one}
      \\end{figure}
    }{}{}{}
  `;

  // Q10 should come AFTER Q9 in natural sorting
  const q10 = `
    \\baitracnghiem{q10}{
      Xem Hình \\ref{fig:sub} và Hình \\ref{fig:main}.
      \\begin{figure}
        \\centering
        \\begin{minipage}{0.5\\textwidth}
          \\includegraphics{f2.png}
          \\label{fig:sub}
        \\end{minipage}
        \\caption{Figure Multi}
        \\label{fig:main}
      \\end{figure}
    }{}{}{}
  `;

  const q2 = `
    \\baitracnghiem{q2}{
       Không có hình.
    }{}{}{}
  `;

  // We sort them naturally before scanning, just like in index.ts
  const contents = [q9, q10, q2].sort((a, b) => {
    const idA = /\{([^}]+)\}/.exec(a)?.[1] || "";
    const idB = /\{([^}]+)\}/.exec(b)?.[1] || "";
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
  });

  console.log("Sorted Order:", contents.map(c => /\{([^}]+)\}/.exec(c)?.[1]));

  const labelData = collectSequentialLabels(contents);

  console.log("Label Map:", JSON.stringify(Object.fromEntries(labelData.labels), null, 2));

  console.log("\n--- Reference Verification ---");
  const ref1 = replaceFigureReferences("Hình \\ref{fig:one}", labelData.labels, "vi");
  const ref2 = replaceFigureReferences("Hình \\ref{fig:sub} và \\ref{fig:main}", labelData.labels, "vi");

  console.log("Ref 1:", ref1);
  console.log("Ref 2:", ref2);

  if (labelData.labels.get("fig:one") === "1" && labelData.labels.get("fig:main") === "2" && labelData.labels.get("fig:sub") === "2") {
    console.log("\nSUCCESS: Sequential numbering (1, 2) and multi-labels (sub=2, main=2) both verified.");
  } else {
    console.error("\nFAILURE: Logic error in numbering or labeling.");
  }
}

main().catch(console.error);
