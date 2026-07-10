import { createAnimationConfig } from "../canvas/animationRegistry";

export function uid(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function animationPatch(animationType, delayMs = 0) {
  if (!animationType || animationType === "none") return {};
  return { animation: createAnimationConfig(animationType, { delayMs }) };
}

export function textElement({ x, y, text, size = 18, stroke = "#111827", w = 260, h, bold = false, animationType = "none", delayMs = 0, textAlign = "left" }) {
  return {
    id: uid("code_text"), type: "text", x, y, w,
    h: h || Math.max(26, String(text).split("\n").length * size * 1.35),
    text: String(text), stroke, fill: "transparent", fontSize: size,
    lineHeight: Math.round(size * 1.35), fontFamily: "Inter, Arial, sans-serif",
    bold, italic: false, underline: false, textAlign, codeIllustrator: true,
    ...animationPatch(animationType, delayMs),
  };
}

export function rectElement({ x, y, w, h, stroke = "#2563eb", fill = "rgba(37,99,235,0.08)", strokeWidth = 2, cornerRadius = 12, animationType = "none", delayMs = 0 }) {
  return { id: uid("code_rect"), type: "rect", x, y, w, h, stroke, fill, strokeWidth, strokeDash: "solid", cornerRadius, codeIllustrator: true, ...animationPatch(animationType, delayMs) };
}

export function arrowElement({ x1, y1, x2, y2, stroke = "#111827", animationType = "none", delayMs = 0 }) {
  return { id: uid("code_arrow"), type: "arrow", x1, y1, x2, y2, cx1: x1, cy1: y1, cx2: x2, cy2: y2, stroke, fill: "transparent", strokeWidth: 2, strokeDash: "solid", lineStyle: "straight", arrowStart: false, arrowEnd: true, codeIllustrator: true, ...animationPatch(animationType, delayMs) };
}
