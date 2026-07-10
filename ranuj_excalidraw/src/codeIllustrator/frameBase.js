import { ARRAY_Y, BOX_GAP, BOX_H, BOX_W, CODE_W, CODE_X, PANEL_X_OFFSET, TOP_Y } from "./constants";
import { arrowElement, rectElement, textElement } from "./elementFactory";

export function rangeIndexes(start, endInclusive) {
  const result = [];
  for (let i = start; i <= endInclusive; i += 1) result.push(i);
  return result;
}

export function getLayout(centerX) {
  const startX = Math.max(520, centerX - 150);
  return { titleX: CODE_X, codeX: CODE_X, visualX: startX, panelX: startX + PANEL_X_OFFSET };
}

export function codePanel({ lines = [], activeLine = -1, centerX }) {
  const layout = getLayout(centerX);
  const height = Math.max(210, 52 + lines.length * 26);
  const elements = [
    rectElement({ x: layout.codeX, y: TOP_Y + 74, w: CODE_W, h: height, stroke: "#94a3b8", fill: "rgba(248,250,252,0.96)" }),
    textElement({ x: layout.codeX + 18, y: TOP_Y + 92, text: "Code", size: 18, w: 200, bold: true, stroke: "#0f172a" }),
  ];
  lines.forEach((line, index) => {
    const y = TOP_Y + 128 + index * 26;
    if (index === activeLine) elements.push(rectElement({ x: layout.codeX + 12, y: y - 4, w: CODE_W - 24, h: 26, stroke: "#f97316", fill: "rgba(249,115,22,0.16)", cornerRadius: 8, animationType: "pulseRing" }));
    elements.push(textElement({ x: layout.codeX + 22, y, text: `${index + 1}. ${line}`, size: 15, w: CODE_W - 42, stroke: index === activeLine ? "#9a3412" : "#334155" }));
  });
  return elements;
}

export function arrayElements(values, { centerX, active = [], left = [], right = [], sorted = [], duplicate = [], label = "arr" } = {}) {
  const layout = getLayout(centerX);
  const startX = layout.visualX;
  const activeSet = new Set(active), leftSet = new Set(left), rightSet = new Set(right), sortedSet = new Set(sorted), duplicateSet = new Set(duplicate);
  const width = values.length * BOX_W + Math.max(0, values.length - 1) * BOX_GAP;
  const elements = [textElement({ x: startX, y: ARRAY_Y - 48, text: label, size: 19, w: 420, bold: true, stroke: "#0f172a" })];
  values.forEach((value, index) => {
    const x = startX + index * (BOX_W + BOX_GAP);
    let stroke = "#2563eb", fill = "rgba(37,99,235,0.09)", animationType = "none";
    if (sortedSet.has(index)) { stroke = "#16a34a"; fill = "rgba(22,163,74,0.13)"; }
    if (leftSet.has(index)) { stroke = "#7c3aed"; fill = "rgba(124,58,237,0.13)"; }
    if (rightSet.has(index)) { stroke = "#0ea5e9"; fill = "rgba(14,165,233,0.13)"; }
    if (duplicateSet.has(index)) { stroke = "#dc2626"; fill = "rgba(220,38,38,0.14)"; }
    if (activeSet.has(index)) { stroke = "#f97316"; fill = "rgba(249,115,22,0.18)"; animationType = "pulseRing"; }
    elements.push(rectElement({ x, y: ARRAY_Y, w: BOX_W, h: BOX_H, stroke, fill, animationType, delayMs: index * 30 }));
    elements.push(textElement({ x: x + 8, y: ARRAY_Y + 14, text: String(value), size: 20, w: BOX_W - 16, bold: true, textAlign: "center" }));
    elements.push(textElement({ x: x + 8, y: ARRAY_Y + BOX_H + 12, text: String(index), size: 13, w: BOX_W - 16, stroke: "#64748b", textAlign: "center" }));
  });
  elements.push(arrowElement({ x1: startX - 18, y1: ARRAY_Y + BOX_H + 42, x2: startX + width + 12, y2: ARRAY_Y + BOX_H + 42, stroke: "#94a3b8" }));
  return elements;
}

export function variablePanel({ centerX, items = [], note = "", title = "Dry run values" }) {
  const layout = getLayout(centerX);
  const h = Math.max(160, 58 + items.length * 46 + (note ? 44 : 0));
  const elements = [
    rectElement({ x: layout.panelX, y: TOP_Y + 74, w: 300, h, stroke: "#cbd5e1", fill: "rgba(255,255,255,0.96)" }),
    textElement({ x: layout.panelX + 18, y: TOP_Y + 92, text: title, size: 18, w: 240, bold: true, stroke: "#0f172a" }),
  ];
  items.slice(0, 7).forEach((item, index) => {
    const y = TOP_Y + 132 + index * 46;
    elements.push(rectElement({ x: layout.panelX + 18, y, w: 264, h: 34, stroke: item.stroke || "#e2e8f0", fill: item.fill || "rgba(248,250,252,0.96)", cornerRadius: 9 }));
    elements.push(textElement({ x: layout.panelX + 30, y: y + 8, text: `${item.label}: ${item.value}`, size: 15, w: 240, stroke: item.textStroke || "#334155", bold: !!item.bold }));
  });
  if (note) elements.push(textElement({ x: layout.panelX + 20, y: TOP_Y + 146 + Math.min(items.length, 7) * 46, text: note, size: 15, w: 260, stroke: "#475569" }));
  return elements;
}

export function listGraphicElements(items, { centerX, listName = "list", activeIndex = -1, y = ARRAY_Y + 132, kind = "list" } = {}) {
  const layout = getLayout(centerX);
  const startX = layout.visualX;
  const label = kind === "set" ? `${listName} / HashSet` : kind === "map" ? `${listName} / HashMap` : kind === "stack" ? `${listName} stack` : kind === "queue" ? `${listName} queue` : kind === "heap" ? `${listName} heap` : `${listName} output`;
  const elements = [textElement({ x: startX, y: y - 44, text: label, size: 19, w: 460, bold: true, stroke: "#0f172a" })];
  if (!items.length) {
    elements.push(rectElement({ x: startX, y, w: 120, h: BOX_H, stroke: "#94a3b8", fill: "rgba(248,250,252,0.96)", cornerRadius: 12 }));
    elements.push(textElement({ x: startX + 14, y: y + 16, text: "empty", size: 18, w: 92, stroke: "#64748b", textAlign: "center" }));
    return elements;
  }
  items.slice(0, 12).forEach((value, index) => {
    const x = startX + index * (BOX_W + BOX_GAP);
    const active = index === activeIndex;
    elements.push(rectElement({ x, y, w: BOX_W, h: BOX_H, stroke: active ? "#16a34a" : "#2563eb", fill: active ? "rgba(22,163,74,0.16)" : "rgba(37,99,235,0.09)", animationType: active ? "pulseRing" : "none" }));
    elements.push(textElement({ x: x + 6, y: y + 14, text: String(value), size: String(value).length > 6 ? 13 : 20, w: BOX_W - 12, bold: true, textAlign: "center" }));
    elements.push(textElement({ x: x + 8, y: y + BOX_H + 12, text: String(index), size: 13, w: BOX_W - 16, stroke: "#64748b", textAlign: "center" }));
  });
  return elements;
}

export function heapTreeElements(items, { centerX, activeIndex = -1, y = ARRAY_Y + 130 } = {}) {
  const layout = getLayout(centerX);
  const sx = layout.visualX + 200;
  const positions = [
    [sx, y], [sx - 110, y + 82], [sx + 110, y + 82], [sx - 165, y + 164], [sx - 55, y + 164], [sx + 55, y + 164], [sx + 165, y + 164],
  ];
  const elements = [textElement({ x: layout.visualX, y: y - 44, text: "PriorityQueue / Heap tree", size: 19, w: 460, bold: true, stroke: "#0f172a" })];
  items.slice(0, 7).forEach((value, index) => {
    const [x, yy] = positions[index];
    if (index > 0) {
      const [px, py] = positions[Math.floor((index - 1) / 2)];
      elements.push(arrowElement({ x1: px + 28, y1: py + 44, x2: x + 28, y2: yy, stroke: "#94a3b8" }));
    }
    elements.push(rectElement({ x, y: yy, w: 58, h: 44, stroke: index === activeIndex ? "#f97316" : "#2563eb", fill: index === activeIndex ? "rgba(249,115,22,0.16)" : "rgba(37,99,235,0.09)", cornerRadius: 999, animationType: index === activeIndex ? "pulseRing" : "none" }));
    elements.push(textElement({ x: x + 8, y: yy + 11, text: String(value), size: 17, w: 42, bold: true, textAlign: "center" }));
  });
  return elements;
}

export function baseFrame({ name, title, subtitle, centerX, codeLines, activeLine, values, arrayOptions, variables, note, extra = [], panelTitle }) {
  const layout = getLayout(centerX);
  const elements = [
    textElement({ x: 84, y: TOP_Y, text: title || "Code Illustrator", size: 32, w: 980, bold: true, stroke: "#0f172a" }),
    textElement({ x: 84, y: TOP_Y + 44, text: subtitle || "", size: 18, w: 980, stroke: "#475569" }),
    ...codePanel({ lines: codeLines, activeLine, centerX }),
    ...arrayElements(values, { centerX, ...(arrayOptions || {}) }),
    ...variablePanel({ centerX, items: variables || [], note, title: panelTitle || "Dry run values" }),
    ...extra,
  ];
  elements.push(textElement({ x: layout.visualX, y: ARRAY_Y + 250, text: "Every step is editable. Move boxes, change text, add arrows, then Play all / Export GIF.", size: 15, w: 780, stroke: "#64748b" }));
  return { name, elements };
}
