import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function Svg({ title, children, ...props }) {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": title ? undefined : true, ...props, children: [title ? _jsx("title", { children: title }) : null, children] }));
}
export function IconQuestion(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M9.09 9a3 3 0 0 1 5.82 1c0 2-3 2-3 4" }), _jsx("path", { d: "M12 17h.01" })] }));
}
export function IconLogout(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), _jsx("path", { d: "M16 17l5-5-5-5" }), _jsx("path", { d: "M21 12H9" })] }));
}
export function IconLogin(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" }), _jsx("path", { d: "M10 17l-5-5 5-5" }), _jsx("path", { d: "M5 12h10" })] }));
}
export function IconUser(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M20 21a8 8 0 0 0-16 0" }), _jsx("circle", { cx: "12", cy: "7", r: "4" })] }));
}
export function IconClock(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M12 6v6l4 2" })] }));
}
export function IconSettings(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M12 1v2" }), _jsx("path", { d: "M12 21v2" }), _jsx("path", { d: "M4.22 4.22l1.42 1.42" }), _jsx("path", { d: "M18.36 18.36l1.42 1.42" }), _jsx("path", { d: "M1 12h2" }), _jsx("path", { d: "M21 12h2" }), _jsx("path", { d: "M4.22 19.78l1.42-1.42" }), _jsx("path", { d: "M18.36 5.64l1.42-1.42" }), _jsx("circle", { cx: "12", cy: "12", r: "4" })] }));
}
export function IconShield(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" }), _jsx("path", { d: "M9 12l2 2 4-4" })] }));
}
export function IconPlay(props) {
    return (_jsx(Svg, { ...props, children: _jsx("path", { d: "M8 5v14l11-7z" }) }));
}
export function IconLink(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" }), _jsx("path", { d: "M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" })] }));
}
export function IconPlus(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M12 5v14" }), _jsx("path", { d: "M5 12h14" })] }));
}
export function IconMenu(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M3 12h18" }), _jsx("path", { d: "M3 6h18" }), _jsx("path", { d: "M3 18h18" })] }));
}
export function IconX(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M18 6L6 18" }), _jsx("path", { d: "M6 6l12 12" })] }));
}
export function IconArrowUp(props) {
    return (_jsx(Svg, { ...props, children: _jsx("path", { d: "M18 15l-6-6-6 6" }) }));
}
export function IconArrowDown(props) {
    return (_jsx(Svg, { ...props, children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
}
