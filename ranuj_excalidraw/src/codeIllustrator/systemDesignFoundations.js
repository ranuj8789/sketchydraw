import { arrowElement, rectElement, textElement } from "./elementFactory";
import { createAnimationConfig } from "../canvas/animationRegistry";

const FRAME_DURATION_MS = 50000;
const TOTAL_FRAMES = 5;
const BG = "rgba(248,250,252,0.98)";

function animate(element, type, {
  delayMs = 0,
  durationMs = 1200,
  dependsOnId = "",
  dependencyMode = "absolute",
  dependencyOffsetMs = 0,
  beforeStart = "hidden",
  afterEnd = "visible",
  loop = false,
} = {}) {
  element.animation = createAnimationConfig(type, {
    delayMs,
    durationMs,
    dependsOnId,
    dependencyMode,
    dependencyOffsetMs,
    beforeStart,
    afterEnd,
    loop,
  });
  return element;
}

function title(text, subtitle, frameNo) {
  const heading = animate(textElement({ x: 70, y: 38, w: 900, text, size: 34, bold: true, stroke: "#0f172a" }), "typewriter", { delayMs: 300, durationMs: 1800 });
  const sub = animate(textElement({ x: 70, y: 86, w: 930, text: subtitle, size: 17, stroke: "#475569" }), "typewriter", { dependsOnId: heading.id, dependencyMode: "afterEnd", dependencyOffsetMs: 450, durationMs: 1500 });
  const counter = animate(textElement({ x: 1010, y: 45, w: 110, text: `${frameNo}/${TOTAL_FRAMES}`, size: 15, bold: true, stroke: "#64748b", textAlign: "right" }), "fadeIn", { delayMs: 400, durationMs: 700 });
  return { elements: [heading, sub, counter], heading, sub, counter };
}

function footer(text, dependsOnId) {
  const panel = animate(rectElement({ x: 72, y: 610, w: 1056, h: 58, stroke: "#cbd5e1", fill: "rgba(255,255,255,0.96)", cornerRadius: 14 }), "fadeIn", { dependsOnId, dependencyMode: "afterEnd", dependencyOffsetMs: 1400, durationMs: 900 });
  const note = animate(textElement({ x: 92, y: 628, w: 1016, text, size: 16, bold: true, stroke: "#334155", textAlign: "center" }), "typewriter", { dependsOnId: panel.id, dependencyMode: "afterStart", dependencyOffsetMs: 250, durationMs: 2600 });
  return [panel, note];
}

function box({ x, y, w, h, label, subtitle, stroke, fill, dependsOnId, waitMs = 900, durationMs = 1900 }) {
  const rect = animate(rectElement({ x, y, w, h, stroke, fill, cornerRadius: 18 }), "scaleIn", {
    dependsOnId,
    dependencyMode: dependsOnId ? "afterEnd" : "absolute",
    dependencyOffsetMs: dependsOnId ? waitMs : 0,
    delayMs: dependsOnId ? 0 : waitMs,
    durationMs,
  });
  const labelText = animate(textElement({ x: x + 14, y: y + 18, w: w - 28, text: label, size: 22, bold: true, stroke: "#0f172a", textAlign: "center" }), "typewriter", { dependsOnId: rect.id, dependencyMode: "afterStart", dependencyOffsetMs: 350, durationMs: 1200 });
  const subtitleText = animate(textElement({ x: x + 14, y: y + 56, w: w - 28, text: subtitle, size: 14, stroke: "#475569", textAlign: "center" }), "typewriter", { dependsOnId: labelText.id, dependencyMode: "afterEnd", dependencyOffsetMs: 300, durationMs: 1500 });
  return { elements: [rect, labelText, subtitleText], rect, labelText, subtitleText };
}

function arrow({ x1, y1, x2, y2, label, stroke, dependsOnId, waitMs = 1100, reverse = false, durationMs = 2600 }) {
  const line = animate(arrowElement({ x1, y1, x2, y2, stroke }), "movingHead", {
    dependsOnId,
    dependencyMode: "afterEnd",
    dependencyOffsetMs: waitMs,
    durationMs,
    loop: false,
  });
  line.arrowStart = reverse;
  line.arrowEnd = !reverse;
  const labelText = animate(textElement({ x: Math.min(x1, x2) + Math.abs(x2 - x1) / 2 - 90, y: Math.min(y1, y2) - 32, w: 180, text: label, size: 14, bold: true, stroke, textAlign: "center" }), "fadeIn", { dependsOnId: line.id, dependencyMode: "afterStart", dependencyOffsetMs: 500, durationMs: 900 });
  return { elements: [line, labelText], line, labelText };
}

function frame(name, frameNo, titleText, subtitleText, build) {
  const background = animate(rectElement({ x: 38, y: 24, w: 1124, h: 666, stroke: "#e2e8f0", fill: BG, cornerRadius: 24 }), "fadeIn", { delayMs: 0, durationMs: 700, beforeStart: "visible" });
  const header = title(titleText, subtitleText, frameNo);
  const story = build(header.sub.id);
  return {
    name,
    durationMs: FRAME_DURATION_MS,
    hiddenElementIds: [],
    elements: [background, ...header.elements, ...story.elements, ...footer(story.lastId ? story.note : "", story.lastId)],
  };
}

export function systemDesignFoundationFrames() {
  return [
    frame("One request begins", 1, "A single user starts the system", "One click becomes a complete backend journey", (headerId) => {
      const user = box({ x: 110, y: 245, w: 210, h: 150, label: "User", subtitle: "Clicks ‘View Profile’", stroke: "#7c3aed", fill: "rgba(124,58,237,0.10)", dependsOnId: headerId, waitMs: 1400 });
      const app = box({ x: 490, y: 220, w: 250, h: 200, label: "Application Server", subtitle: "Receives and coordinates work", stroke: "#2563eb", fill: "rgba(37,99,235,0.10)", dependsOnId: user.subtitleText.id, waitMs: 1500, durationMs: 2100 });
      const request = arrow({ x1: 320, y1: 320, x2: 490, y2: 320, label: "Profile request", stroke: "#7c3aed", dependsOnId: app.subtitleText.id, waitMs: 1700 });
      const db = box({ x: 860, y: 245, w: 220, h: 150, label: "Database", subtitle: "Stores the user record", stroke: "#16a34a", fill: "rgba(22,163,74,0.10)", dependsOnId: request.labelText.id, waitMs: 1600, durationMs: 2100 });
      const query = arrow({ x1: 740, y1: 320, x2: 860, y2: 320, label: "Read profile", stroke: "#16a34a", dependsOnId: db.subtitleText.id, waitMs: 1500 });
      const response = arrow({ x1: 490, y1: 380, x2: 320, y2: 380, label: "Return profile", stroke: "#16a34a", dependsOnId: query.labelText.id, waitMs: 1900, reverse: true });
      return {
        elements: [...user.elements, ...app.elements, ...request.elements, ...db.elements, ...query.elements, ...response.elements],
        lastId: response.labelText.id,
        note: "Story: the user asks, the application understands, the database answers, and the result returns.",
      };
    }),

    frame("The application scales", 2, "Traffic grows, so the application scales", "The same request can be handled by more than one server", (headerId) => {
      const user = box({ x: 75, y: 265, w: 165, h: 120, label: "Users", subtitle: "More traffic arrives", stroke: "#7c3aed", fill: "rgba(124,58,237,0.10)", dependsOnId: headerId, waitMs: 1200 });
      const lb = box({ x: 320, y: 245, w: 205, h: 150, label: "Load Balancer", subtitle: "Chooses a healthy server", stroke: "#ef4444", fill: "rgba(239,68,68,0.10)", dependsOnId: user.subtitleText.id, waitMs: 1500 });
      const incoming = arrow({ x1: 240, y1: 325, x2: 320, y2: 325, label: "Incoming traffic", stroke: "#7c3aed", dependsOnId: lb.subtitleText.id, waitMs: 1400 });
      const app1 = box({ x: 650, y: 165, w: 210, h: 125, label: "App Server 1", subtitle: "Same APIs and logic", stroke: "#2563eb", fill: "rgba(37,99,235,0.10)", dependsOnId: incoming.labelText.id, waitMs: 1300 });
      const app2 = box({ x: 650, y: 370, w: 210, h: 125, label: "App Server 2", subtitle: "Handles another request", stroke: "#2563eb", fill: "rgba(37,99,235,0.10)", dependsOnId: app1.subtitleText.id, waitMs: 1200 });
      const route1 = arrow({ x1: 525, y1: 300, x2: 650, y2: 225, label: "Route request", stroke: "#2563eb", dependsOnId: app2.subtitleText.id, waitMs: 1300 });
      const route2 = arrow({ x1: 525, y1: 345, x2: 650, y2: 430, label: "Spread traffic", stroke: "#2563eb", dependsOnId: route1.labelText.id, waitMs: 900 });
      const db = box({ x: 935, y: 270, w: 180, h: 125, label: "Database", subtitle: "Shared source of truth", stroke: "#16a34a", fill: "rgba(22,163,74,0.10)", dependsOnId: route2.labelText.id, waitMs: 1300 });
      return { elements: [...user.elements, ...lb.elements, ...incoming.elements, ...app1.elements, ...app2.elements, ...route1.elements, ...route2.elements, ...db.elements], lastId: db.subtitleText.id, note: "Story: scaling adds more application servers; the load balancer decides where each request should go." };
    }),

    frame("Secure the request", 3, "HTTPS protects the journey", "Before business logic runs, the request must arrive safely", (headerId) => {
      const user = box({ x: 100, y: 260, w: 190, h: 135, label: "User", subtitle: "Sends login details", stroke: "#7c3aed", fill: "rgba(124,58,237,0.10)", dependsOnId: headerId, waitMs: 1300 });
      const https = box({ x: 415, y: 215, w: 220, h: 180, label: "HTTPS / TLS", subtitle: "Encrypts data in transit", stroke: "#dc2626", fill: "rgba(220,38,38,0.09)", dependsOnId: user.subtitleText.id, waitMs: 1500, durationMs: 2100 });
      const encrypted = arrow({ x1: 290, y1: 325, x2: 415, y2: 325, label: "Encrypted request", stroke: "#dc2626", dependsOnId: https.subtitleText.id, waitMs: 1500 });
      const app = box({ x: 790, y: 245, w: 250, h: 150, label: "Application Server", subtitle: "Receives readable data safely", stroke: "#2563eb", fill: "rgba(37,99,235,0.10)", dependsOnId: encrypted.labelText.id, waitMs: 1500 });
      const secureArrow = arrow({ x1: 635, y1: 325, x2: 790, y2: 325, label: "Secure channel", stroke: "#dc2626", dependsOnId: app.subtitleText.id, waitMs: 1400 });
      const callout = animate(textElement({ x: 300, y: 475, w: 600, text: "HTTPS protects the path. It does not replace validation or authorization.", size: 23, bold: true, stroke: "#991b1b", textAlign: "center" }), "typewriter", { dependsOnId: secureArrow.labelText.id, dependencyMode: "afterEnd", dependencyOffsetMs: 1800, durationMs: 3000 });
      return { elements: [...user.elements, ...https.elements, ...encrypted.elements, ...app.elements, ...secureArrow.elements, callout], lastId: callout.id, note: "Story: first protect the message while it travels; then inspect and process it inside the application." };
    }),

    frame("Validate and decide", 4, "The application checks before it acts", "Validation protects quality; business logic decides the outcome", (headerId) => {
      const request = box({ x: 75, y: 250, w: 200, h: 150, label: "Incoming Request", subtitle: "email, token, amount", stroke: "#7c3aed", fill: "rgba(124,58,237,0.10)", dependsOnId: headerId, waitMs: 1200 });
      const validation = box({ x: 350, y: 175, w: 235, h: 145, label: "Validation", subtitle: "Required fields and safe values", stroke: "#dc2626", fill: "rgba(220,38,38,0.09)", dependsOnId: request.subtitleText.id, waitMs: 1500 });
      const validateArrow = arrow({ x1: 275, y1: 310, x2: 350, y2: 245, label: "Check input", stroke: "#dc2626", dependsOnId: validation.subtitleText.id, waitMs: 1200 });
      const logic = box({ x: 350, y: 375, w: 235, h: 145, label: "Business Logic", subtitle: "Apply product rules", stroke: "#2563eb", fill: "rgba(37,99,235,0.10)", dependsOnId: validateArrow.labelText.id, waitMs: 1400 });
      const decision = arrow({ x1: 275, y1: 345, x2: 350, y2: 445, label: "Valid request", stroke: "#2563eb", dependsOnId: logic.subtitleText.id, waitMs: 1300 });
      const db = box({ x: 770, y: 250, w: 235, h: 160, label: "Database", subtitle: "Read or save durable state", stroke: "#16a34a", fill: "rgba(22,163,74,0.10)", dependsOnId: decision.labelText.id, waitMs: 1500 });
      const dataArrow = arrow({ x1: 585, y1: 445, x2: 770, y2: 345, label: "Read / write data", stroke: "#16a34a", dependsOnId: db.subtitleText.id, waitMs: 1500 });
      const result = animate(textElement({ x: 720, y: 470, w: 330, text: "Controlled result, not accidental behavior", size: 20, bold: true, stroke: "#166534", textAlign: "center" }), "typewriter", { dependsOnId: dataArrow.labelText.id, dependencyMode: "afterEnd", dependencyOffsetMs: 1400, durationMs: 2500 });
      return { elements: [...request.elements, ...validation.elements, ...validateArrow.elements, ...logic.elements, ...decision.elements, ...db.elements, ...dataArrow.elements, result], lastId: result.id, note: "Story: validation asks ‘is the request safe?’; business logic asks ‘what should the product do?’" };
    }),

    frame("Cache, database and response", 5, "A fast read still needs a source of truth", "Cache supports speed; database protects durable state", (headerId) => {
      const app = box({ x: 80, y: 245, w: 230, h: 170, label: "Application Server", subtitle: "Needs the same profile again", stroke: "#2563eb", fill: "rgba(37,99,235,0.10)", dependsOnId: headerId, waitMs: 1300 });
      const cache = box({ x: 485, y: 150, w: 220, h: 140, label: "Cache", subtitle: "Fast temporary copy", stroke: "#0ea5e9", fill: "rgba(14,165,233,0.10)", dependsOnId: app.subtitleText.id, waitMs: 1500 });
      const cacheArrow = arrow({ x1: 310, y1: 285, x2: 485, y2: 220, label: "Check cache first", stroke: "#0ea5e9", dependsOnId: cache.subtitleText.id, waitMs: 1300 });
      const db = box({ x: 485, y: 395, w: 220, h: 145, label: "Database", subtitle: "Durable source of truth", stroke: "#16a34a", fill: "rgba(22,163,74,0.10)", dependsOnId: cacheArrow.labelText.id, waitMs: 1600 });
      const dbArrow = arrow({ x1: 310, y1: 375, x2: 485, y2: 465, label: "Use DB when needed", stroke: "#16a34a", dependsOnId: db.subtitleText.id, waitMs: 1300 });
      const response = box({ x: 850, y: 250, w: 230, h: 165, label: "Response", subtitle: "Profile returned to the user", stroke: "#7c3aed", fill: "rgba(124,58,237,0.10)", dependsOnId: dbArrow.labelText.id, waitMs: 1500 });
      const finalArrow = arrow({ x1: 705, y1: 325, x2: 850, y2: 325, label: "Build response", stroke: "#7c3aed", dependsOnId: response.subtitleText.id, waitMs: 1400 });
      const summary = animate(textElement({ x: 250, y: 555, w: 700, text: "User → HTTPS → Application → Validation → Logic → Cache / Database → Response", size: 20, bold: true, stroke: "#1d4ed8", textAlign: "center" }), "typewriter", { dependsOnId: finalArrow.labelText.id, dependencyMode: "afterEnd", dependencyOffsetMs: 1700, durationMs: 3600 });
      return { elements: [...app.elements, ...cache.elements, ...cacheArrow.elements, ...db.elements, ...dbArrow.elements, ...response.elements, ...finalArrow.elements, summary], lastId: summary.id, note: "Final story: cache makes repeated reads faster, but the database remains the durable source of truth." };
    }),
  ];
}
