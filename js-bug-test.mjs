const token = "__TOKEN__";
const replacement = "Math: $x^2$";
const text = "See __TOKEN__ here";

console.log("String replace:", text.replace(token, replacement));
console.log("Func replace:", text.replace(token, () => replacement));
console.log("Join/Split:", text.split(token).join(replacement));

const text2 = "__TOKEN__&quot;";
console.log("String replace special:", text2.replace(token, "Math $"));
// If $ is followed by nothing, maybe it's literal?
console.log("String replace query:", text2.replace(token, "Math $'"));
