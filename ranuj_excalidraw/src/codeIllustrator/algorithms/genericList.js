import { baseFrame, listGraphicElements } from "../frameBase";
import { findActiveLineIndex, getCodeLines, parseLoopCountFromCode } from "../parser";

function parseListNameFromCode(code) {
  const raw = String(code || "");
  const addMatch = raw.match(/([A-Za-z_$][\w$]*)\s*\.\s*(add|push)\s*\(/); if (addMatch) return addMatch[1];
  const listMatch = raw.match(/(?:List|ArrayList)\s*<[^>]*>\s+([A-Za-z_$][\w$]*)/); if (listMatch) return listMatch[1];
  const assignMatch = raw.match(/(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[\]/); if (assignMatch) return assignMatch[1];
  return "list";
}
function parseAddExpressionFromCode(code) { const m = String(code || "").match(/\.\s*(add|push)\s*\(([^)]*)\)/); return m ? (m[2].trim() || "i") : "i"; }
function evaluateSimpleExpression(expr, { i, inputValues }) {
  const raw = String(expr || "i").replace(/\s+/g, ""); if (raw === "i") return i; if (raw === "i+1") return i + 1; if (raw === "i-1") return i - 1; if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/(?:arr|array|nums|numbers)\[(?:i|index)\]/i.test(raw)) return inputValues[i] ?? i;
  const arithmetic = raw.match(/^i([+\-*])(-?\d+)$/); if (arithmetic) { const n = Number(arithmetic[2]); if (arithmetic[1] === "+") return i + n; if (arithmetic[1] === "-") return i - n; if (arithmetic[1] === "*") return i * n; }
  return `${expr.replace(/\s+/g, " ")} @${i}`;
}

export function genericListFrames(numbers, centerX, title, code) {
  const codeLines = getCodeLines(code, ["list = []", "for i from 0 to n-1:", "list.add(i)", "return list"]);
  const inputValues = [...numbers], listName = parseListNameFromCode(code), addExpr = parseAddExpressionFromCode(code), count = parseLoopCountFromCode(code, inputValues.length || 5);
  const initLine = findActiveLineIndex(codeLines, ["new arraylist", "[]", "new list", "arraylist", "list"]), loopLine = findActiveLineIndex(codeLines, ["for", "while"]), addLine = findActiveLineIndex(codeLines, [".add", ".push", "append"]), returnLine = findActiveLineIndex(codeLines, ["return"]);
  const output = [], frames = [];
  frames.push(baseFrame({ name: "Create list", title: title || "Generic Code Flow", subtitle: "Create empty list", centerX, codeLines, activeLine: initLine, values: inputValues.length ? inputValues : Array.from({ length: count }, (_, i) => i), arrayOptions: { label: "input values / loop indexes" }, variables: [{ label: listName, value: "[]", bold: true }, { label: "operation", value: "create list" }], note: "Initialization before loop.", extra: listGraphicElements(output, { centerX, listName }) }));
  for (let i = 0; i < count; i += 1) {
    frames.push(baseFrame({ name: `Loop i=${i}`, title: title || "Generic Code Flow", subtitle: `Loop iteration i=${i}`, centerX, codeLines, activeLine: loopLine, values: inputValues.length ? inputValues : Array.from({ length: count }, (_, k) => k), arrayOptions: { active: [i], label: "input values / loop indexes" }, variables: [{ label: "i", value: i, bold: true }, { label: listName, value: `[${output.join(", ")}]` }], note: "Orange box is current loop index.", extra: listGraphicElements(output, { centerX, listName }) }));
    const addedValue = evaluateSimpleExpression(addExpr, { i, inputValues }); output.push(addedValue);
    frames.push(baseFrame({ name: `Add ${addedValue}`, title: title || "Generic Code Flow", subtitle: `${listName}.add(${addExpr}) → ${addedValue}`, centerX, codeLines, activeLine: addLine, values: inputValues.length ? inputValues : Array.from({ length: count }, (_, k) => k), arrayOptions: { active: [i], label: "input values / loop indexes" }, variables: [{ label: "i", value: i }, { label: "added", value: addedValue, bold: true }, { label: listName, value: `[${output.join(", ")}]`, bold: true }], note: "New value appears in output list.", extra: listGraphicElements(output, { centerX, listName, activeIndex: output.length - 1 }) }));
  }
  frames.push(baseFrame({ name: "Return list", title: title || "Generic Code Flow", subtitle: `Return ${listName} = [${output.join(", ")}]`, centerX, codeLines, activeLine: returnLine >= 0 ? returnLine : codeLines.length - 1, values: inputValues.length ? inputValues : output, arrayOptions: { label: "input values / loop indexes" }, variables: [{ label: "answer", value: `[${output.join(", ")}]`, bold: true }], note: "Generic create → loop → add → return flow.", extra: listGraphicElements(output, { centerX, listName }) }));
  return frames.slice(0, 80);
}
