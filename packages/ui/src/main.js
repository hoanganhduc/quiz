import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/tailwind.css";
import "./styles.css";
import { MathJaxContext } from "better-react-mathjax";
import { ThemeProvider } from "./theme/ThemeProvider";
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(MathJaxContext, { version: 3, config: {
            loader: { load: ["input/tex", "output/chtml"] },
            tex: { inlineMath: [["$", "$"], ["\\(", "\\)"]] }
        }, children: _jsx(ThemeProvider, { children: _jsx(App, {}) }) }) }));
