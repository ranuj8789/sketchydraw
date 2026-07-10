import { arrowElement, rectElement, textElement } from "./elementFactory";
import { createAnimationConfig } from "../canvas/animationRegistry";

const FRAME_DURATION_MS = 15000;
const TIMING_SCALE = 1.45;
const BG = "rgba(248,250,252,0.98)";
const TOTAL_STEPS = 24;

function slowMs(value) {
  return Math.round(Math.max(0, Number(value) || 0) * TIMING_SCALE);
}

function text(opts) {
  const delayMs = slowMs(opts.delayMs || 0);
  const size = Number(opts.size) || 16;
  const chars = String(opts.text || "").length;
  const durationMs = Math.max(size >= 28 ? 1500 : 1200, Math.min(5600, chars * (size >= 28 ? 52 : 46)));
  const el = textElement({ ...opts, animationType: "typewriter", delayMs });
  el.animation = createAnimationConfig("typewriter", {
    delayMs,
    durationMs,
    loop: false,
  });
  return el;
}

function box({ x, y, w, h, label, subtitle, stroke = "#2563eb", fill = "rgba(37,99,235,0.08)", delayMs = 0, animationType = "scaleIn" }) {
  return [
    rectElement({ x, y, w, h, stroke, fill, cornerRadius: 18, animationType, delayMs: slowMs(delayMs) }),
    text({ x: x + 14, y: y + 16, w: w - 28, text: label, size: 21, bold: true, stroke: "#0f172a", delayMs: delayMs + 240, textAlign: "center" }),
    ...(subtitle
        ? [
          text({
            x: x + 14,
            y: y + 50,
            w: w - 28,
            text: subtitle,
            size: 14,
            stroke: "#475569",
            delayMs: delayMs + 620,
            textAlign: "center",
          }),
        ]
        : []),
  ];
}

function flowArrow({ x1, y1, x2, y2, label, delayMs = 0, stroke = "#0f172a", reverse = false }) {
  const scaledDelayMs = slowMs(delayMs);
  const arrow = arrowElement({ x1, y1, x2, y2, stroke, animationType: "movingHead", delayMs: scaledDelayMs });
  arrow.arrowStart = reverse;
  arrow.arrowEnd = !reverse;
  arrow.animation = createAnimationConfig("movingHead", {
    delayMs: scaledDelayMs,
    durationMs: slowMs(2200),
    loop: true,
  });
  return [
    arrow,
    ...(label
        ? [
          text({
            x: Math.min(x1, x2) + Math.abs(x2 - x1) / 2 - 90,
            y: Math.min(y1, y2) - 32,
            w: 180,
            text: label,
            size: 14,
            bold: true,
            stroke,
            delayMs: delayMs + 280,
            textAlign: "center",
          }),
        ]
        : []),
  ];
}

function titleBlock(title, subtitle, step) {
  return [
    text({ x: 70, y: 42, w: 1040, text: title, size: 34, bold: true, stroke: "#0f172a", delayMs: 0 }),
    text({ x: 70, y: 92, w: 1040, text: subtitle, size: 18, stroke: "#475569", delayMs: 650 }),
    text({ x: 1010, y: 48, w: 120, text: `${step}/${TOTAL_STEPS}`, size: 15, bold: true, stroke: "#64748b", delayMs: 180, textAlign: "right" }),
  ];
}

function footer(note, delayMs = 7800) {
  return [
    rectElement({ x: 70, y: 612, w: 1060, h: 58, stroke: "#cbd5e1", fill: "rgba(255,255,255,0.94)", cornerRadius: 14, animationType: "fadeIn", delayMs: slowMs(delayMs) }),
    text({ x: 92, y: 630, w: 1016, text: note, size: 16, stroke: "#334155", delayMs: delayMs + 280, textAlign: "center" }),
  ];
}

function frame(name, title, subtitle, step, elements, note) {
  return {
    name,
    durationMs: FRAME_DURATION_MS,
    elements: [
      rectElement({ x: 38, y: 24, w: 1124, h: 666, stroke: "#e2e8f0", fill: BG, cornerRadius: 24, animationType: "fadeIn", delayMs: 0 }),
      ...titleBlock(title, subtitle, step),
      ...elements,
      ...footer(note),
    ],
  };
}

function architecture({
                        active = "",
                        request = false,
                        response = false,
                        showCacheArrow = false,
                        showDbArrow = false,
                        security = false,
                        logging = false,
                        details = {},
                      } = {}) {
  const activeStroke = "#f97316";
  const activeFill = "rgba(249,115,22,0.14)";
  const accent = (key, stroke, fill) =>
      key === active
          ? { stroke: activeStroke, fill: activeFill, animationType: "pulseRing" }
          : { stroke, fill, animationType: "scaleIn" };

  const els = [
    ...box({ x: 80, y: 260, w: 150, h: 112, label: "User", subtitle: details.user || "Web / Mobile client", delayMs: 900, ...accent("user", "#7c3aed", "rgba(124,58,237,0.09)") }),
    ...box({ x: 345, y: 224, w: 230, h: 178, label: "Application Server", subtitle: details.app || "Runs validation and business logic", delayMs: 1600, ...accent("app", "#2563eb", "rgba(37,99,235,0.09)") }),
    ...box({ x: 705, y: 170, w: 190, h: 105, label: "Cache", subtitle: details.cache || "Fast support layer", delayMs: 2250, ...accent("cache", "#0ea5e9", "rgba(14,165,233,0.10)") }),
    ...box({ x: 705, y: 355, w: 190, h: 115, label: "Database", subtitle: details.db || "Durable source of truth", delayMs: 2750, ...accent("db", "#16a34a", "rgba(22,163,74,0.10)") }),
  ];

  if (request) {
    els.push(...flowArrow({ x1: 230, y1: 305, x2: 345, y2: 305, label: details.requestLabel || "Request", delayMs: 3650, stroke: "#7c3aed" }));
  }
  if (response) {
    els.push(...flowArrow({ x1: 345, y1: 350, x2: 230, y2: 350, label: details.responseLabel || "Response", delayMs: 4700, stroke: "#16a34a", reverse: true }));
  }
  if (showCacheArrow) {
    els.push(...flowArrow({ x1: 575, y1: 274, x2: 705, y2: 220, label: details.cacheLabel || "Check cache", delayMs: 4200, stroke: "#0ea5e9" }));
  }
  if (showDbArrow) {
    els.push(...flowArrow({ x1: 575, y1: 348, x2: 705, y2: 410, label: details.dbLabel || "Query database", delayMs: 4300, stroke: "#16a34a" }));
  }
  if (security) {
    els.push(...box({ x: 945, y: 175, w: 170, h: 105, label: "Security", subtitle: details.security || "TLS, auth, validation", delayMs: 3500, ...accent("security", "#dc2626", "rgba(220,38,38,0.09)") }));
    if (details.securityArrow) {
      els.push(...flowArrow({ x1: 575, y1: 250, x2: 945, y2: 225, label: details.securityArrow, delayMs: 4300, stroke: "#dc2626" }));
    }
  }
  if (logging) {
    els.push(...box({ x: 945, y: 355, w: 170, h: 115, label: "Logging", subtitle: details.logging || "Logs and metrics", delayMs: 3650, ...accent("logging", "#d97706", "rgba(217,119,6,0.09)") }));
    if (details.loggingArrow) {
      els.push(...flowArrow({ x1: 575, y1: 390, x2: 945, y2: 410, label: details.loggingArrow, delayMs: 4550, stroke: "#d97706" }));
    }
  }
  return els;
}

function scalingArchitecture() {
  return [
    ...box({ x: 80, y: 280, w: 150, h: 112, label: "User", subtitle: "Client request", delayMs: 900, stroke: "#7c3aed", fill: "rgba(124,58,237,0.09)", animationType: "scaleIn" }),
    ...box({ x: 290, y: 248, w: 190, h: 102, label: "Load Balancer", subtitle: "Distributes traffic", delayMs: 1550, stroke: "#ef4444", fill: "rgba(239,68,68,0.09)", animationType: "pulseRing" }),
    ...box({ x: 560, y: 178, w: 185, h: 105, label: "App Server 1", subtitle: "Handles requests", delayMs: 2250, stroke: "#2563eb", fill: "rgba(37,99,235,0.09)", animationType: "scaleIn" }),
    ...box({ x: 560, y: 340, w: 185, h: 105, label: "App Server 2", subtitle: "Same code, same APIs", delayMs: 2550, stroke: "#2563eb", fill: "rgba(37,99,235,0.09)", animationType: "scaleIn" }),
    ...box({ x: 855, y: 260, w: 180, h: 110, label: "Database", subtitle: "Shared data layer", delayMs: 3150, stroke: "#16a34a", fill: "rgba(22,163,74,0.10)", animationType: "scaleIn" }),
    ...flowArrow({ x1: 230, y1: 325, x2: 290, y2: 300, label: "Incoming request", delayMs: 3850, stroke: "#7c3aed" }),
    ...flowArrow({ x1: 480, y1: 285, x2: 560, y2: 228, label: "Route to server", delayMs: 4550, stroke: "#2563eb" }),
    ...flowArrow({ x1: 480, y1: 315, x2: 560, y2: 390, label: "Or another server", delayMs: 5200, stroke: "#2563eb" }),
    ...flowArrow({ x1: 745, y1: 228, x2: 855, y2: 295, label: "Read / write", delayMs: 5900, stroke: "#16a34a" }),
    ...flowArrow({ x1: 745, y1: 390, x2: 855, y2: 335, label: "Shared access", delayMs: 6450, stroke: "#16a34a" }),
  ];
}

const lessons = [
  [
    "Opening",
    "System Design Foundation",
    "A slow visual introduction to how a backend request works",
    {},
    "We will focus only on the core foundation: user, application server, cache, database, security, logging, and response.",
  ],
  [
    "Core Components",
    "The basic architecture",
    "User, application server, cache, and database",
    {},
    "These are the first building blocks you should understand before moving into deeper topics like queues, sharding, or microservices.",
  ],
  [
    "User Request",
    "Step 1 — The user starts everything",
    "A click, search, login, or form submission becomes a request",
    { active: "user", request: true, details: { requestLabel: "User sends request" } },
    "Every system begins with user intent. The frontend sends that intent to the backend as a request.",
  ],
  [
    "HTTPS",
    "Security begins at the entry point",
    "The request should travel using HTTPS",
    { request: true, security: true, active: "security", details: { requestLabel: "HTTPS request", security: "TLS protects data in transit", securityArrow: "Encrypt traffic" } },
    "HTTPS protects data while it moves between the client and the backend.",
  ],
  [
    "Server Entry",
    "Step 2 — The application server receives the request",
    "The application server becomes the coordinator",
    { request: true, active: "app", details: { app: "Receives and coordinates work", requestLabel: "Reach server" } },
    "The application server is the main coordinator. It receives the request and decides what should happen next.",
  ],
  [
    "Validation",
    "Validate the incoming request",
    "Check required fields, format, and safe input",
    { active: "security", security: true, details: { app: "Waits for clean input", security: "Validation and sanitization", securityArrow: "Validate request" } },
    "Validation is the first protection layer. Reject bad or incomplete input before business logic runs.",
  ],
  [
    "Authentication",
    "Authenticate the caller",
    "Who is making the request?",
    { active: "security", security: true, details: { security: "JWT, session, or token check", securityArrow: "Verify identity" } },
    "Authentication answers one question: who is the caller?",
  ],
  [
    "Authorization",
    "Authorize the action",
    "What is this user allowed to do?",
    { active: "security", security: true, details: { security: "Roles, access rules, ownership", securityArrow: "Check permissions" } },
    "Authorization decides whether the authenticated user is allowed to access the requested resource or action.",
  ],
  [
    "Business Logic",
    "Run business logic",
    "The application server applies product rules",
    { active: "app", details: { app: "Rules, workflows, and decisions" } },
    "This is where the product becomes useful. The server checks rules and decides how to process the request.",
  ],
  [
    "Cache Introduction",
    "Cache is a support layer",
    "The server may check cache before touching the database",
    { active: "cache", showCacheArrow: true, details: { cache: "Fast temporary lookup", cacheLabel: "Check cache first" } },
    "At foundation level, just remember this: cache is a fast support layer that can reduce load on the database.",
  ],
  [
    "Database Introduction",
    "Database is the source of truth",
    "Permanent application data lives here",
    { active: "db", showDbArrow: true, details: { db: "Profiles, orders, products, records", dbLabel: "Access database" } },
    "The database stores durable data. It is the main place where important application data is saved.",
  ],
  [
    "Read Flow",
    "Step 3 — Read data from the database",
    "The server asks the database for information",
    { active: "db", showDbArrow: true, details: { app: "Requests data", db: "Return requested record", dbLabel: "Read requested data" } },
    "When a user wants existing information, the server reads from the database and gets the required result.",
  ],
  [
    "Write Flow",
    "Step 4 — Write data to the database",
    "The server can create or update records",
    { active: "db", showDbArrow: true, details: { app: "Prepare insert / update", db: "Save durable record", dbLabel: "Write application data" } },
    "When the request changes state, the server writes data to the database so the change is stored permanently.",
  ],
  [
    "Prepare Response",
    "Step 5 — Build the response",
    "The application server prepares the result for the client",
    { active: "app", response: true, details: { app: "Create JSON and status code", responseLabel: "Prepare response" } },
    "After processing is complete, the application server builds the final response body and status code.",
  ],
  [
    "Return Response",
    "Step 6 — Send the response back",
    "The result returns to the user",
    { active: "user", response: true, details: { responseLabel: "Return to user" } },
    "The client receives the response and shows the result to the user.",
  ],
  [
    "Logging",
    "Logging records what happened",
    "Important events should be written to logs",
    { active: "logging", logging: true, details: { logging: "Request, route, result, errors", loggingArrow: "Write logs" } },
    "Logs help developers understand what happened inside the system when requests succeed or fail.",
  ],
  [
    "Metrics",
    "Metrics show system health",
    "Track latency, requests, and errors",
    { active: "logging", logging: true, details: { logging: "Latency, traffic, error rate", loggingArrow: "Track metrics" } },
    "Metrics help teams monitor the health and performance of the system over time.",
  ],
  [
    "Timeouts",
    "Requests should not wait forever",
    "Use timeouts to control waiting",
    { active: "app", logging: true, details: { app: "Timeout policies", logging: "Record slow requests", loggingArrow: "Observe delays" } },
    "Timeouts protect user experience and stop the system from waiting too long on dependencies.",
  ],
  [
    "Retries",
    "Retry carefully when needed",
    "Only repeat safe operations",
    { active: "app", logging: true, details: { app: "Controlled retry logic", logging: "Track retry attempts", loggingArrow: "Observe retries" } },
    "Retries can help with short failures, but they should be controlled and used carefully.",
  ],
  [
    "Scaling",
    "One application server is not enough forever",
    "As traffic grows, add more application servers",
    { active: "app", details: { app: "Scale horizontally with more instances" } },
    "A common first scaling step is to run multiple application server instances.",
  ],
  [
    "Load Balancer",
    "A load balancer distributes traffic",
    "It sends requests to one of many application servers",
    "SPECIAL_SCALING",
    "A load balancer helps spread incoming traffic across multiple application server instances.",
  ],
  [
    "Complete Read Flow",
    "Complete foundation flow — read request",
    "User → server → cache / database → response",
    {
      active: "app",
      request: true,
      response: true,
      showCacheArrow: true,
      showDbArrow: true,
      security: true,
      logging: true,
      details: {
        requestLabel: "Read request",
        responseLabel: "Read response",
        cacheLabel: "Optional fast lookup",
        dbLabel: "Read data",
        security: "TLS, auth, access checks",
        logging: "Logs and metrics",
        securityArrow: "Secure request",
        loggingArrow: "Observe system",
      },
    },
    "This is the full foundation flow for a read request: enter securely, process on the server, access data, log activity, and respond.",
  ],
  [
    "Complete Write Flow",
    "Complete foundation flow — write request",
    "User → server → database → response",
    {
      active: "app",
      request: true,
      response: true,
      showDbArrow: true,
      security: true,
      logging: true,
      details: {
        requestLabel: "Write request",
        responseLabel: "Write response",
        dbLabel: "Persist new data",
        security: "Validation, auth, authorization",
        logging: "Logs and monitoring",
        securityArrow: "Protect request",
        loggingArrow: "Capture result",
      },
    },
    "This is the full foundation flow for a write request: validate it, process it, save it, log it, and return the result.",
  ],
  [
    "Summary",
    "Foundation complete",
    "You now have the first system design building block",
    {
      request: true,
      response: true,
      security: true,
      logging: true,
      details: {
        requestLabel: "Incoming request",
        responseLabel: "Final response",
        security: "Security around entry and access",
        logging: "Logging and metrics around the flow",
        securityArrow: "Protect",
        loggingArrow: "Observe",
      },
    },
    "Foundation means understanding the basic request-response lifecycle clearly before moving to advanced system design topics.",
  ],
];

export function systemDesignFoundationFrames() {
  return lessons.map(([name, title, subtitle, options, note], index) => {
    const elements = options === "SPECIAL_SCALING" ? scalingArchitecture() : architecture(options);
    return frame(name, title, subtitle, index + 1, elements, note);
  });
}
