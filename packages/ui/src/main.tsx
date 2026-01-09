import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/tailwind.css";
import "./styles.css";
import { MathJaxContext } from "better-react-mathjax";
import { ThemeProvider } from "./theme/ThemeProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MathJaxContext
      version={3}
      config={{
        loader: { load: ["input/tex", "output/chtml"] },
        tex: { inlineMath: [["$", "$"], ["\\(", "\\)"]] }
      }}
    >
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </MathJaxContext>
  </React.StrictMode>
);
