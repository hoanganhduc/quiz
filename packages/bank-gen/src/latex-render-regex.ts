
// Combined regex for all block types to handle nesting priority.
// Order matters: regex engine matches earliest occurrence.
// If figure starts at 0 and minipage starts at 10, figure is matched.
// Group 1: Minipage match (side-by-side algos)
// Group 2: Block match (figure, algo, table, etc)
// Group 3: Environment name for Block match (captured by \3)
const ENV_LIST = "tikzpicture|tikz|table|tabular|figure|figwindow|tabwindow|algorithm|algo";
const BLOCK_PATTERN = `\\\\begin\\{(${ENV_LIST})\\}(?:\\[[^\\]]*\\])?[\\s\\S]*?\\\\end\\{\\3\\}`;
const MINIPAGE_PATTERN = "(?:\\\\begin\\{minipage\\}(?:\\[[^\\]]*\\])?\\{[^}]+\\}[\\s\\S]*?\\\\end\\{minipage\\}[~%\\s]*)+";
const COMBINED_REGEX = new RegExp(`(${MINIPAGE_PATTERN})|(${BLOCK_PATTERN})`, "g");
