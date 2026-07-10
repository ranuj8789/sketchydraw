import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import "./App.css";

import Toolbar from "./components/Toolbar/Toolbar";
import Sidebar from "./components/Sidebar/Sidebar";
import CanvasBoard from "./components/CanvasBoard/CanvasBoard";
import FramesPanel from "./components/FramesPanel/FramesPanel";
import RightToolTabs from "./components/RightToolTabs/RightToolTabs";
import FramePlayerScreen from "./components/FramePlayerScreen/FramePlayerScreen";
import SketchyAlert from "./components/SketchyAlert";
import { verifyEmail, resetPassword } from "./api/authApi";
import { measureTextBox } from "./canvas/textMetrics";
import {
  TermsPage,
  PrivacyPolicyPage,
  RefundPolicyPage,
  CancellationPolicyPage,
  DeliveryPolicyPage,
  ContactUsPage,
} from "./components/LegalPages/LegalPages";
import { useSketchyBoardActions } from "./hooks/useSketchyBoardActions";
import {
  DEFAULT_GROUP,
  DEFAULT_TITLE,
} from "./components/DrawingGroupStore/drawingGroupStore";
import { DEFAULT_TEXT_STYLE } from "./canvas/textStyle";
import { createAnimationConfig } from "./canvas/animationRegistry";
import { buildCodeIllustrationFrames, parseCodeIllustratorNumbers } from "./canvas/codeIllustrator";
import { exportTimelineGif } from "./utils/exportGif";
import {
  normalizeTextStyle,
  pickTextStylePatch,
  hasTextStylePatch,
} from "./canvas/textRenderStyle";

const COLORS = [
  "#111827",
  "#ef4444",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#9333ea",
];

const DEFAULT_CANVAS_PROPS = {
  backgroundColor: "#ffffff",
  pattern: "blank",
  cornerRadius: 16,

  // Notebook module props
  pageMode: true,
  pageCount: 1,
};

const OBJECT_ORDER_DELAY_STEP_MS = 500;

const DEFAULT_MAX_HISTORY_LENGTH = 80;
const MIN_HISTORY_LENGTH = 10;
const MAX_ALLOWED_HISTORY_LENGTH = 500;

function getConfiguredMaxHistoryLength() {
  const fromLocalStorage = Number(
      window.localStorage.getItem("sketchydraw_max_history")
  );

  const fromEnv = Number(process.env.REACT_APP_SKETCHYDRAW_MAX_HISTORY);

  const value =
      Number.isFinite(fromLocalStorage) && fromLocalStorage > 0
          ? fromLocalStorage
          : Number.isFinite(fromEnv) && fromEnv > 0
              ? fromEnv
              : DEFAULT_MAX_HISTORY_LENGTH;

  return Math.max(
      MIN_HISTORY_LENGTH,
      Math.min(MAX_ALLOWED_HISTORY_LENGTH, Math.floor(value))
  );
}

function cloneElements(elements) {
  if (typeof structuredClone === "function") {
    return structuredClone(elements || []);
  }

  return JSON.parse(JSON.stringify(elements || []));
}

function makeFrameId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `frame_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeObjectId(prefix = "object") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getViewportCenterPoint(canvasSize, viewport) {
  const zoom = Math.max(0.01, Number(viewport?.zoom) || 1);
  const offsetX = Number(viewport?.offsetX) || 0;
  const offsetY = Number(viewport?.offsetY) || 0;

  return {
    x: ((Number(canvasSize?.width) || 1200) / 2 - offsetX) / zoom,
    y: ((Number(canvasSize?.height) || 700) / 2 - offsetY) / zoom,
  };
}


function buildSystemDesignPrimitiveElements({
                                              primitiveType = "cache",
                                              center,
                                              pageIndex = 0,
                                              strokeColor = "#111827",
                                              cornerRadius = 16,
                                            }) {
  const animation = createAnimationConfig("none");
  const elements = [];

  const push = (element) => {
    elements.push({
      ...element,
      pageIndex,
      animation,
      systemDesignPrimitive: true,
    });
  };

  const createRect = ({
                        x,
                        y,
                        w,
                        h,
                        fill = "#ffffff",
                        stroke = strokeColor,
                        radius = cornerRadius,
                        strokeWidth = 2,
                        dash = "solid",
                      }) => ({
    id: makeObjectId("system_rect"),
    type: "rect",
    x,
    y,
    w,
    h,
    stroke,
    fill,
    strokeWidth,
    strokeDash: dash,
    cornerRadius: radius,
  });

  const createEllipse = ({
                           x,
                           y,
                           w,
                           h,
                           fill = "#ffffff",
                           stroke = strokeColor,
                           strokeWidth = 2,
                           dash = "solid",
                         }) => ({
    id: makeObjectId("system_ellipse"),
    type: "ellipse",
    x,
    y,
    w,
    h,
    stroke,
    fill,
    strokeWidth,
    strokeDash: dash,
    cornerRadius: 0,
  });

  const createDiamond = ({
                           x,
                           y,
                           w,
                           h,
                           fill = "#ffffff",
                           stroke = strokeColor,
                           strokeWidth = 2,
                           dash = "solid",
                         }) => ({
    id: makeObjectId("system_diamond"),
    type: "diamond",
    x,
    y,
    w,
    h,
    stroke,
    fill,
    strokeWidth,
    strokeDash: dash,
    cornerRadius: 0,
  });

  const createLine = ({
                        x1,
                        y1,
                        x2,
                        y2,
                        stroke = strokeColor,
                        strokeWidth = 2,
                        dash = "solid",
                      }) => ({
    id: makeObjectId("system_line"),
    type: "line",
    x1,
    y1,
    x2,
    y2,
    cx1: x1,
    cy1: y1,
    cx2: x2,
    cy2: y2,
    stroke,
    fill: "transparent",
    strokeWidth,
    strokeDash: dash,
    lineStyle: "straight",
    arrowEnd: false,
  });

  const createText = ({
                        x,
                        y,
                        text,
                        fontSize = 16,
                        stroke = "#111827",
                        width = null,
                        bold = true,
                        align = "center",
                        parentId = null,
                      }) => {
    const textStyle = normalizeTextStyle({
      ...DEFAULT_TEXT_STYLE,
      fontSize,
      lineHeight: Math.round(fontSize * 1.3),
      fontFamily: "Arial",
      bold,
      italic: false,
      underline: false,
      textAlign: align,
      stroke,
    });
    const measured = measureTextBox(text, textStyle);
    return {
      id: makeObjectId("system_text"),
      type: "text",
      x,
      y,
      w: width || measured.w,
      h: measured.h,
      text,
      plainText: text,
      html: text,
      fontSize: textStyle.fontSize,
      lineHeight: textStyle.lineHeight,
      fontFamily: textStyle.fontFamily,
      stroke: textStyle.stroke,
      fill: "transparent",
      bold: textStyle.bold,
      italic: false,
      underline: false,
      textAlign: align,
      parentId,
    };
  };

  const x = Number(center?.x) || 0;
  const y = Number(center?.y) || 0;

  if (primitiveType === "cache") {
    const shell = createRect({ x: x - 110, y: y - 55, w: 220, h: 110, fill: "#fef3c7", radius: 22 });
    push(shell);
    push(createText({ x: shell.x + 44, y: shell.y + 12, width: 132, text: "CACHE", fontSize: 22 }));
    push(createRect({ x: shell.x + 28, y: shell.y + 54, w: 164, h: 14, fill: "#fde68a", radius: 10, stroke: "#d97706" }));
    push(createRect({ x: shell.x + 28, y: shell.y + 74, w: 126, h: 14, fill: "#fde68a", radius: 10, stroke: "#d97706" }));
    push(createText({ x: shell.x + 44, y: shell.y + 91, width: 132, text: "fast reads", fontSize: 12, stroke: "#92400e" }));
    return elements;
  }

  if (primitiveType === "database") {
    push(createEllipse({ x: x - 82, y: y - 62, w: 164, h: 34, fill: "#dbeafe", stroke: "#2563eb" }));
    push(createRect({ x: x - 82, y: y - 46, w: 164, h: 104, fill: "#dbeafe", stroke: "#2563eb", radius: 12 }));
    push(createEllipse({ x: x - 82, y: y + 40, w: 164, h: 34, fill: "#bfdbfe", stroke: "#2563eb" }));
    push(createLine({ x1: x - 82, y1: y - 28, x2: x - 82, y2: y + 56, stroke: "#2563eb" }));
    push(createLine({ x1: x + 82, y1: y - 28, x2: x + 82, y2: y + 56, stroke: "#2563eb" }));
    push(createText({ x: x - 62, y: y - 8, width: 124, text: "DATABASE", fontSize: 20, stroke: "#1e3a8a" }));
    return elements;
  }

  if (primitiveType === "server") {
    const shell = createRect({ x: x - 82, y: y - 92, w: 164, h: 184, fill: "#e2e8f0", radius: 18, stroke: "#475569" });
    push(shell);
    push(createText({ x: shell.x + 28, y: shell.y + 12, width: 108, text: "SERVER", fontSize: 20, stroke: "#0f172a" }));
    [0, 1, 2].forEach((index) => {
      const slotY = shell.y + 52 + index * 34;
      push(createRect({ x: shell.x + 22, y: slotY, w: 120, h: 22, fill: "#cbd5e1", radius: 8, stroke: "#64748b" }));
      push(createEllipse({ x: shell.x + 132, y: slotY + 5, w: 10, h: 10, fill: index === 0 ? "#22c55e" : "#94a3b8", stroke: index === 0 ? "#16a34a" : "#64748b" }));
    });
    return elements;
  }

  if (primitiveType === "nginx") {
    const shell = createDiamond({ x: x - 82, y: y - 82, w: 164, h: 164, fill: "#dcfce7", stroke: "#16a34a" });
    push(shell);
    push(createText({ x: x - 48, y: y - 14, width: 96, text: "NGINX", fontSize: 22, stroke: "#166534" }));
    push(createText({ x: x - 70, y: y + 18, width: 140, text: "gateway / load balancer", fontSize: 12, stroke: "#166534" }));
    return elements;
  }

  if (primitiveType === "datacenter") {
    const shell = createRect({ x: x - 132, y: y - 96, w: 264, h: 192, fill: "#f8fafc", radius: 20, stroke: "#334155" });
    push(shell);
    push(createText({ x: shell.x + 48, y: shell.y + 12, width: 168, text: "DATA CENTRE", fontSize: 20, stroke: "#0f172a" }));
    [-76, 0, 76].forEach((offset) => {
      const rack = createRect({ x: x + offset - 26, y: y - 24, w: 52, h: 92, fill: "#e2e8f0", radius: 10, stroke: "#475569" });
      push(rack);
      [0, 1, 2].forEach((slot) => {
        push(createRect({ x: rack.x + 10, y: rack.y + 10 + slot * 24, w: 32, h: 12, fill: "#cbd5e1", radius: 5, stroke: "#64748b" }));
      });
    });
    return elements;
  }

  if (primitiveType === "kafka") {
    const shell = createRect({ x: x - 150, y: y - 96, w: 300, h: 192, fill: "#f5f3ff", radius: 22, stroke: "#7c3aed" });
    push(shell);
    push(createText({ x: shell.x + 94, y: shell.y + 12, width: 112, text: "KAFKA", fontSize: 24, stroke: "#5b21b6" }));
    [-84, 0, 84].forEach((offset, index) => {
      const broker = createRect({ x: x + offset - 34, y: y - 14, w: 68, h: 80, fill: "#ede9fe", radius: 12, stroke: "#8b5cf6" });
      push(broker);
      push(createText({ x: broker.x + 8, y: broker.y + 10, width: 52, text: `B${index + 1}`, fontSize: 18, stroke: "#4c1d95" }));
      [0, 1].forEach((partitionIndex) => {
        push(createRect({ x: broker.x + 12, y: broker.y + 38 + partitionIndex * 16, w: 44, h: 10, fill: "#ddd6fe", radius: 5, stroke: "#a78bfa" }));
      });
    });
    return elements;
  }

  if (primitiveType === "splunk") {
    const shell = createRect({ x: x - 118, y: y - 68, w: 236, h: 136, fill: "#ecfccb", radius: 20, stroke: "#65a30d" });
    push(shell);
    push(createText({ x: shell.x + 62, y: shell.y + 12, width: 112, text: "SPLUNK", fontSize: 24, stroke: "#3f6212" }));
    [0, 1, 2, 3].forEach((barIndex) => {
      push(createRect({ x: shell.x + 28 + barIndex * 44, y: shell.y + 72 - barIndex * 8, w: 22, h: 28 + barIndex * 8, fill: "#bef264", radius: 8, stroke: "#65a30d" }));
    });
    return elements;
  }

  if (primitiveType === "security") {
    const shell = createDiamond({ x: x - 96, y: y - 96, w: 192, h: 192, fill: "#fee2e2", stroke: "#dc2626" });
    push(shell);
    push(createText({ x: x - 64, y: y - 22, width: 128, text: "SECURITY", fontSize: 20, stroke: "#991b1b" }));
    push(createText({ x: x - 52, y: y + 10, width: 104, text: "Auth / WAF", fontSize: 13, stroke: "#991b1b" }));
    return elements;
  }

  if (primitiveType === "broker") {
    const shell = createRect({ x: x - 134, y: y - 80, w: 268, h: 160, fill: "#eef2ff", radius: 20, stroke: "#4f46e5" });
    push(shell);
    push(createText({ x: shell.x + 82, y: shell.y + 12, width: 104, text: "BROKER", fontSize: 22, stroke: "#312e81" }));
    [0, 1, 2].forEach((partitionIndex) => {
      const row = createRect({ x: shell.x + 24, y: shell.y + 48 + partitionIndex * 28, w: 220, h: 18, fill: "#c7d2fe", radius: 8, stroke: "#818cf8" });
      push(row);
      push(createText({ x: row.x + 10, y: row.y + 1, width: 200, text: `Partition ${partitionIndex}`, fontSize: 12, stroke: "#4338ca" }));
    });
    return elements;
  }

  if (primitiveType === "partition") {
    const shell = createRect({ x: x - 98, y: y - 88, w: 196, h: 176, fill: "#faf5ff", radius: 20, stroke: "#9333ea" });
    push(shell);
    push(createText({ x: shell.x + 44, y: shell.y + 12, width: 108, text: "PARTITION", fontSize: 20, stroke: "#6b21a8" }));
    [0, 1, 2].forEach((segmentIndex) => {
      const segment = createRect({ x: shell.x + 28, y: shell.y + 48 + segmentIndex * 34, w: 140, h: 22, fill: "#e9d5ff", radius: 8, stroke: "#c084fc" });
      push(segment);
      push(createText({ x: segment.x + 12, y: segment.y + 2, width: 116, text: `Offset ${segmentIndex}`, fontSize: 12, stroke: "#7e22ce" }));
    });
    return elements;
  }

  const fallback = createRect({ x: x - 90, y: y - 50, w: 180, h: 100, fill: "#f8fafc", radius: 18, stroke: strokeColor });
  push(fallback);
  push(createText({ x: fallback.x + 16, y: fallback.y + 26, width: 148, text: primitiveType.toUpperCase(), fontSize: 18 }));
  return elements;
}

function createTimelineFrame(elements = [], index = 0, patch = {}) {
  return {
    id: makeFrameId(),
    name: `Frame ${index + 1}`,
    elements: cloneElements(elements),
    hiddenElementIds: [],
    ...patch,
  };
}

function mergeFrameElements(...elementLists) {
  const byId = new Map();
  const noIdElements = [];

  elementLists.forEach((list) => {
    (list || []).forEach((element) => {
      const cloned = cloneElements([element])[0];

      if (cloned?.id) {
        // Later frames win when same object id exists.
        byId.set(cloned.id, cloned);
      } else if (cloned) {
        noIdElements.push(cloned);
      }
    });
  });

  return [...byId.values(), ...noIdElements];
}

function renameTimelineFrames(frames = []) {
  return frames.map((frame, index) => ({
    ...frame,
    name: frame.name?.startsWith("Frame ") ? `Frame ${index + 1}` : frame.name,
  }));
}

function hasFrameContent(frame) {
  return Array.isArray(frame?.elements) && frame.elements.length > 0;
}

function getAnimatedElementIds(elements = []) {
  return new Set(
      (elements || [])
          .filter((el) => el?.animation && el.animation.type && el.animation.type !== "none")
          .map((el) => el.id)
  );
}

function getFrameAnimationDurationMs(frame) {
  const animatedElements = (frame?.elements || []).filter(
      (element) => element?.animation?.type && element.animation.type !== "none"
  );

  if (!animatedElements.length) {
    // Static frame still plays so user can preview/present frames without animations.
    return 1300;
  }

  return Math.max(
      900,
      ...animatedElements.map((element) => {
        const animation = element.animation || {};
        const delayMs = Math.max(0, Number(animation.delayMs) || 0);
        const durationMs = Math.max(1, Number(animation.durationMs) || 1000);
        return delayMs + durationMs;
      })
  );
}

function VerifyPage() {
  const [status, setStatus] = useState("Verifying your email...");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("Invalid verification link. Token missing.");
      setSuccess(false);
      return;
    }

    verifyEmail(token)
        .then((data) => {
          setStatus(
              data?.message || "Email verified successfully. You can now login."
          );
          setSuccess(true);
        })
        .catch((err) => {
          setStatus(err?.message || "Email verification failed.");
          setSuccess(false);
        });
  }, []);



  return (
      <div className="app-shell">
        <div className="verify-page">
          <div className="verify-card">
            <h1>Sketchy</h1>
            <h2>Email Verification</h2>

            <p className={success ? "verify-success" : "verify-message"}>
              {status}
            </p>

            <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
            >
              Go to SketchyDraw
            </button>
          </div>
        </div>
      </div>
  );
}
const TEXT_STYLE_STORAGE_KEY = "sketchydraw_current_text_style";

function loadCurrentTextStyle() {
  if (typeof window === "undefined") {
    return normalizeTextStyle(DEFAULT_TEXT_STYLE);
  }

  try {
    const saved = window.localStorage.getItem(TEXT_STYLE_STORAGE_KEY);

    if (!saved) {
      return normalizeTextStyle(DEFAULT_TEXT_STYLE);
    }

    return normalizeTextStyle({
      ...DEFAULT_TEXT_STYLE,
      ...JSON.parse(saved),
    });
  } catch {
    return normalizeTextStyle(DEFAULT_TEXT_STYLE);
  }
}

function saveCurrentTextStyle(style) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
        TEXT_STYLE_STORAGE_KEY,
        JSON.stringify(normalizeTextStyle(style))
    );
  } catch {
    // ignore localStorage errors
  }
}
function SketchyDrawPage() {
  const [showGrid, setShowGrid] = useState(false);
  const [tool, setTool] = useState("select");
  const [stroke, setStroke] = useState("#111827");
  const [currentTextStyle, setCurrentTextStyle] = useState(loadCurrentTextStyle);

  const updateCurrentTextStyle = useCallback((patch) => {
    const textPatch = pickTextStylePatch(patch);

    if (!Object.keys(textPatch).length) return;

    setCurrentTextStyle((prev) => {
      const next = normalizeTextStyle({
        ...prev,
        ...textPatch,
      });

      saveCurrentTextStyle(next);
      return next;
    });
  }, []);
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [maxHistoryLength] = useState(getConfiguredMaxHistoryLength);
  const [sketchyAlert, setSketchyAlert] = useState(null);
  const [gifExporting, setGifExporting] = useState(false);
  const [gifExportProgress, setGifExportProgress] = useState(0);

  const [timelineFrames, setTimelineFrames] = useState(() => [
    createTimelineFrame([], 0),
  ]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [framesPanelOpen, setFramesPanelOpen] = useState(false);
  const [frameAnimationPlaying, setFrameAnimationPlaying] = useState(false);
  const [frameAnimationTimeMs, setFrameAnimationTimeMs] = useState(0);

  const [frameAdvanceMode, setFrameAdvanceMode] = useState("enter");
  const [animationPlayerOpen, setAnimationPlayerOpen] = useState(false);
  const [animationPlayerMode, setAnimationPlayerMode] = useState("current");
  const [animationPlayerFrameIndex, setAnimationPlayerFrameIndex] = useState(0);
  const [animationPlayerPlaying, setAnimationPlayerPlaying] = useState(false);
  const [animationPlayerTimeMs, setAnimationPlayerTimeMs] = useState(0);
  const [animationPlayerWaitingForNext, setAnimationPlayerWaitingForNext] = useState(false);
  const [animationPlayerSpeed, setAnimationPlayerSpeed] = useState(1);
  const animationPlayerAdvanceTimeoutRef = useRef(null);

  const showSketchyAlert = useCallback((payload) => {
    setSketchyAlert({
      open: true,
      type: "info",
      title: "SketchyDraw",
      icon: "✏️",
      ...payload,
    });
  }, []);

  const closeSketchyAlert = useCallback(() => {
    setSketchyAlert(null);
  }, []);

  const [canvasSize, setCanvasSize] = useState({
    width: 1200,
    height: 700,
  });

  const [canvasProps, setCanvasProps] = useState(DEFAULT_CANVAS_PROPS);

  const updateCanvasProps = (patch) => {
    setCanvasProps((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  const currentTimelineFrame = timelineFrames[currentFrameIndex] || timelineFrames[0];

  const animationRenderOptions = useMemo(() => {
    return {
      animationMode: frameAnimationPlaying,
      animationTimeMs: frameAnimationTimeMs,
      activeAnimatedElementIds: getAnimatedElementIds(elements),
      hiddenElementIds: new Set(currentTimelineFrame?.hiddenElementIds || []),
      loopAnimation: frameAnimationPlaying,
      loopPauseMs: 450,
    };
  }, [elements, frameAnimationPlaying, frameAnimationTimeMs, currentTimelineFrame]);

  const animationPlayerFrame =
      timelineFrames[animationPlayerFrameIndex] || timelineFrames[0] || createTimelineFrame([], 0);

  const animationPlayerRenderOptions = useMemo(() => {
    return {
      animationMode: animationPlayerOpen,
      animationTimeMs: animationPlayerTimeMs,
      activeAnimatedElementIds: getAnimatedElementIds(animationPlayerFrame?.elements || []),
      hiddenElementIds: new Set(animationPlayerFrame?.hiddenElementIds || []),
    };
  }, [animationPlayerOpen, animationPlayerTimeMs, animationPlayerFrame]);

  useEffect(() => {
    if (!frameAnimationPlaying) return undefined;

    let rafId = null;
    const startedAt = performance.now();

    const tick = (now) => {
      setFrameAnimationTimeMs(now - startedAt);
      rafId = window.requestAnimationFrame(tick);
    };

    setFrameAnimationTimeMs(0);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [frameAnimationPlaying]);

  const advanceAnimationPlayerFrame = useCallback(() => {
    setAnimationPlayerFrameIndex((prevIndex) => {
      const nextIndex = Math.min(prevIndex + 1, timelineFrames.length - 1);

      if (nextIndex === prevIndex) {
        setAnimationPlayerPlaying(false);
        setAnimationPlayerWaitingForNext(false);
        return prevIndex;
      }

      setAnimationPlayerTimeMs(0);
      setAnimationPlayerWaitingForNext(false);
      setAnimationPlayerPlaying(true);
      setCurrentFrameIndex(nextIndex);
      setElements(cloneElements(timelineFrames[nextIndex]?.elements || []));
      setSelectedIds([]);
      return nextIndex;
    });
  }, [timelineFrames]);

  useEffect(() => {
    if (!animationPlayerOpen || !animationPlayerPlaying) return undefined;

    let rafId = null;
    const startedAt = performance.now();
    const durationMs = getFrameAnimationDurationMs(animationPlayerFrame);
    const speed = Math.max(0.25, Number(animationPlayerSpeed) || 1);

    const tick = (now) => {
      const elapsed = (now - startedAt) * speed;

      if (elapsed >= durationMs) {
        setAnimationPlayerTimeMs(durationMs);
        setAnimationPlayerPlaying(false);

        const hasNextFrame =
            animationPlayerMode === "all" &&
            animationPlayerFrameIndex < timelineFrames.length - 1;

        if (hasNextFrame) {
          if (frameAdvanceMode === "auto") {
            setAnimationPlayerWaitingForNext(false);
            animationPlayerAdvanceTimeoutRef.current = window.setTimeout(() => {
              advanceAnimationPlayerFrame();
            }, Math.max(120, 650 / speed));
          } else {
            setAnimationPlayerWaitingForNext(true);
          }
        } else {
          setAnimationPlayerWaitingForNext(false);
        }

        return;
      }

      setAnimationPlayerTimeMs(elapsed);
      rafId = window.requestAnimationFrame(tick);
    };

    setAnimationPlayerWaitingForNext(false);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [
    animationPlayerOpen,
    animationPlayerPlaying,
    animationPlayerFrame,
    animationPlayerFrameIndex,
    animationPlayerMode,
    timelineFrames.length,
    frameAdvanceMode,
    advanceAnimationPlayerFrame,
    animationPlayerSpeed,
  ]);

  useEffect(() => {
    return () => {
      if (animationPlayerAdvanceTimeoutRef.current) {
        window.clearTimeout(animationPlayerAdvanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!animationPlayerOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAnimationPlayerOpen(false);
        setAnimationPlayerPlaying(false);
        setAnimationPlayerWaitingForNext(false);
        return;
      }

      if (event.key === "Enter") {
        const hasNextFrame =
            animationPlayerMode === "all" &&
            animationPlayerFrameIndex < timelineFrames.length - 1;

        if (animationPlayerWaitingForNext && hasNextFrame) {
          event.preventDefault();
          advanceAnimationPlayerFrame();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    animationPlayerOpen,
    animationPlayerMode,
    animationPlayerFrameIndex,
    animationPlayerWaitingForNext,
    timelineFrames.length,
    advanceAnimationPlayerFrame,
  ]);

  const updateCurrentTimelineFrame = useCallback((nextElements, patch = {}) => {
    const snapshot = cloneElements(nextElements);

    setTimelineFrames((prevFrames) => {
      const safeFrames = prevFrames.length ? prevFrames : [createTimelineFrame([], 0)];
      const safeIndex = Math.max(0, Math.min(currentFrameIndex, safeFrames.length - 1));

      return safeFrames.map((frame, index) =>
          index === safeIndex
              ? {
                ...frame,
                elements: snapshot,
                ...patch,
              }
              : frame
      );
    });
  }, [currentFrameIndex]);

  const createTimelineFrameForNewObject = useCallback((nextElements) => {
    const snapshot = cloneElements(nextElements);

    setTimelineFrames((prevFrames) => {
      const safeFrames = prevFrames.length ? prevFrames : [createTimelineFrame([], 0)];
      const safeIndex = Math.max(0, Math.min(currentFrameIndex, safeFrames.length - 1));
      const currentFrame = safeFrames[safeIndex];

      if (!hasFrameContent(currentFrame)) {
        setCurrentFrameIndex(safeIndex);
        return safeFrames.map((frame, index) =>
            index === safeIndex
                ? {
                  ...frame,
                  elements: snapshot,
                }
                : frame
        );
      }

      const nextFrames = safeFrames.slice(0, safeIndex + 1);
      const newIndex = nextFrames.length;
      nextFrames.push(createTimelineFrame(snapshot, newIndex));
      setCurrentFrameIndex(newIndex);
      return nextFrames;
    });

    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, [currentFrameIndex]);

  const replaceTimelineWithElements = useCallback((nextElements) => {
    const nextFrame = createTimelineFrame(nextElements, 0);
    setTimelineFrames([nextFrame]);
    setCurrentFrameIndex(0);
    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, []);

  const selectTimelineFrame = useCallback((index) => {
    const frame = timelineFrames[index];
    if (!frame) return;

    setCurrentFrameIndex(index);
    setElements(cloneElements(frame.elements));
    setSelectedIds([]);
    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, [timelineFrames]);

  const addTimelineFrameAfterCurrent = useCallback(() => {
    const snapshot = cloneElements(elements);

    setTimelineFrames((prevFrames) => {
      const safeFrames = prevFrames.length ? prevFrames : [createTimelineFrame([], 0)];
      const safeIndex = Math.max(0, Math.min(currentFrameIndex, safeFrames.length - 1));
      const nextFrames = [...safeFrames];
      const insertIndex = safeIndex + 1;
      nextFrames.splice(insertIndex, 0, createTimelineFrame(snapshot, insertIndex));

      const renamed = nextFrames.map((frame, index) => ({
        ...frame,
        name: frame.name?.startsWith("Frame ") ? `Frame ${index + 1}` : frame.name,
      }));

      setCurrentFrameIndex(insertIndex);
      return renamed;
    });

    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, [currentFrameIndex, elements]);

  const deleteTimelineFrame = useCallback((index) => {
    setTimelineFrames((prevFrames) => {
      if (prevFrames.length <= 1) {
        const emptyFrame = createTimelineFrame([], 0);
        setCurrentFrameIndex(0);
        setElements([]);
        setSelectedIds([]);
        return [emptyFrame];
      }

      const nextFrames = prevFrames
          .filter((_, frameIndex) => frameIndex !== index)
          .map((frame, frameIndex) => ({
            ...frame,
            name: frame.name?.startsWith("Frame ") ? `Frame ${frameIndex + 1}` : frame.name,
          }));
      const nextIndex = Math.max(0, Math.min(currentFrameIndex, nextFrames.length - 1));
      const nextFrame = nextFrames[nextIndex];

      setCurrentFrameIndex(nextIndex);
      setElements(cloneElements(nextFrame.elements));
      setSelectedIds([]);
      return nextFrames;
    });

    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, [currentFrameIndex]);

  const mergeCurrentFrameWithNext = useCallback(() => {
    setTimelineFrames((prevFrames) => {
      const safeFrames = prevFrames.length ? prevFrames : [createTimelineFrame([], 0)];
      const safeIndex = Math.max(0, Math.min(currentFrameIndex, safeFrames.length - 1));

      if (safeIndex >= safeFrames.length - 1) {
        return safeFrames;
      }

      const currentFrame = safeFrames[safeIndex];
      const nextFrame = safeFrames[safeIndex + 1];
      const mergedElements = mergeFrameElements(currentFrame.elements, nextFrame.elements);
      const mergedHidden = [];

      const mergedFrame = {
        ...currentFrame,
        elements: mergedElements,
        hiddenElementIds: mergedHidden,
      };

      const nextFrames = [
        ...safeFrames.slice(0, safeIndex),
        mergedFrame,
        ...safeFrames.slice(safeIndex + 2),
      ];

      const renamed = renameTimelineFrames(nextFrames);
      setCurrentFrameIndex(safeIndex);
      setElements(cloneElements(renamed[safeIndex]?.elements || []));
      setSelectedIds([]);
      return renamed;
    });

    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, [currentFrameIndex]);

  const mergeAllTimelineFrames = useCallback(() => {
    setTimelineFrames((prevFrames) => {
      const safeFrames = prevFrames.length ? prevFrames : [createTimelineFrame([], 0)];
      const mergedElements = mergeFrameElements(...safeFrames.map((frame) => frame.elements || []));
      const mergedHidden = [];

      const mergedFrame = createTimelineFrame(mergedElements, 0, {
        id: safeFrames[0]?.id || makeFrameId(),
        name: "Frame 1",
        hiddenElementIds: mergedHidden,
      });

      setCurrentFrameIndex(0);
      setElements(cloneElements(mergedFrame.elements));
      setSelectedIds([]);
      return [mergedFrame];
    });

    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, []);

  const toggleFrameElementHidden = useCallback((frameIndex, elementId) => {
    setTimelineFrames((prevFrames) => {
      return prevFrames.map((frame, index) => {
        if (index !== frameIndex) return frame;

        const hidden = new Set(frame.hiddenElementIds || []);

        if (hidden.has(elementId)) {
          hidden.delete(elementId);
        } else {
          hidden.add(elementId);
        }

        return {
          ...frame,
          hiddenElementIds: Array.from(hidden),
        };
      });
    });
  }, []);

  const moveFrameElementOrder = useCallback((frameIndex, elementId, direction) => {
    if (!elementId) return;

    setTimelineFrames((prevFrames) => {
      return prevFrames.map((frame, index) => {
        if (index !== frameIndex) return frame;

        const nextElements = cloneElements(frame.elements || []);
        const fromIndex = nextElements.findIndex((element) => element.id === elementId);

        if (fromIndex < 0) return frame;

        let toIndex = fromIndex;

        if (direction === "first") {
          toIndex = 0;
        } else if (direction === "last") {
          toIndex = nextElements.length - 1;
        } else if (direction === "up") {
          toIndex = Math.max(0, fromIndex - 1);
        } else if (direction === "down") {
          toIndex = Math.min(nextElements.length - 1, fromIndex + 1);
        }

        if (toIndex === fromIndex) return frame;

        const [movedElement] = nextElements.splice(fromIndex, 1);
        nextElements.splice(toIndex, 0, movedElement);

        if (index === currentFrameIndex) {
          setElements(cloneElements(nextElements));
          setSelectedIds([elementId]);
        }

        return {
          ...frame,
          elements: nextElements,
        };
      });
    });

    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, [currentFrameIndex]);

  const applyFrameObjectOrderTiming = useCallback((frameIndex, options = {}) => {
    const delayStepMs = Math.max(0, Number(options.delayStepMs) || OBJECT_ORDER_DELAY_STEP_MS);
    setTimelineFrames((prevFrames) => {
      return prevFrames.map((frame, index) => {
        if (index !== frameIndex) return frame;

        const nextElements = cloneElements(frame.elements || []).map((element, objectIndex) => {
          const type = element?.animation?.type || "none";

          if (type === "none") {
            return element;
          }

          return {
            ...element,
            animation: {
              ...element.animation,
              delayMs: objectIndex * delayStepMs,
            },
          };
        });

        if (index === currentFrameIndex) {
          setElements(cloneElements(nextElements));
        }

        return {
          ...frame,
          elements: nextElements,
        };
      });
    });

    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, [currentFrameIndex]);

  const toggleCurrentFrameAnimation = useCallback(() => {
    setFrameAnimationTimeMs(0);
    setFrameAnimationPlaying((value) => !value);
  }, []);

  const startCurrentFrameAnimationPreview = useCallback(() => {
    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
    window.requestAnimationFrame(() => {
      setFrameAnimationPlaying(true);
    });
  }, []);



  const openAnimationPlayer = useCallback((mode = "current") => {
    const startIndex = mode === "all" ? 0 : currentFrameIndex;
    const safeIndex = Math.max(0, Math.min(startIndex, timelineFrames.length - 1));

    if (animationPlayerAdvanceTimeoutRef.current) {
      window.clearTimeout(animationPlayerAdvanceTimeoutRef.current);
      animationPlayerAdvanceTimeoutRef.current = null;
    }

    setAnimationPlayerMode(mode);
    setAnimationPlayerFrameIndex(safeIndex);
    setCurrentFrameIndex(safeIndex);
    setElements(cloneElements(timelineFrames[safeIndex]?.elements || []));
    setSelectedIds([]);
    setAnimationPlayerTimeMs(0);
    setAnimationPlayerWaitingForNext(false);
    setAnimationPlayerOpen(true);
    setAnimationPlayerPlaying(true);
    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, [currentFrameIndex, timelineFrames]);

  const closeAnimationPlayer = useCallback(() => {
    if (animationPlayerAdvanceTimeoutRef.current) {
      window.clearTimeout(animationPlayerAdvanceTimeoutRef.current);
      animationPlayerAdvanceTimeoutRef.current = null;
    }

    setAnimationPlayerOpen(false);
    setAnimationPlayerPlaying(false);
    setAnimationPlayerWaitingForNext(false);
    setAnimationPlayerTimeMs(0);
  }, []);

  const restartAnimationPlayerFrame = useCallback(() => {
    if (animationPlayerAdvanceTimeoutRef.current) {
      window.clearTimeout(animationPlayerAdvanceTimeoutRef.current);
      animationPlayerAdvanceTimeoutRef.current = null;
    }

    setAnimationPlayerTimeMs(0);
    setAnimationPlayerWaitingForNext(false);
    setAnimationPlayerPlaying(true);
  }, []);

  const [viewport, setViewport] = useState({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const [currentDrawingMeta, setCurrentDrawingMeta] = useState({
    id: null,
    title: DEFAULT_TITLE,
    groupName: DEFAULT_GROUP,
    description: "",
  });

  const exportGif = useCallback(async () => {
    if (gifExporting) return;

    setGifExporting(true);
    setGifExportProgress(0);

    try {
      await exportTimelineGif({
        frames: timelineFrames,
        canvasSize,
        viewport,
        canvasProps,
        fileName: `${currentDrawingMeta.title || DEFAULT_TITLE}.gif`,
        fps: 12,
        onProgress: (progress) => setGifExportProgress(progress || 0),
      });
    } catch (error) {
      console.error("GIF export failed", error);
      showSketchyAlert({
        icon: "⚠️",
        title: "GIF export failed",
        message: "GIF encoder could not load or export failed. Check internet/CDN access and try again.",
      });
    } finally {
      setGifExporting(false);
      setGifExportProgress(0);
    }
  }, [
    gifExporting,
    timelineFrames,
    canvasSize,
    viewport,
    canvasProps,
    currentDrawingMeta.title,
    showSketchyAlert,
  ]);

  const commitHistory = useCallback((nextElements) => {
    const snapshot = cloneElements(nextElements);

    setHistory((prevHistory) => {
      const trimmed = prevHistory.slice(0, historyIndex + 1);
      trimmed.push(snapshot);

      const limited =
          trimmed.length > maxHistoryLength
              ? trimmed.slice(trimmed.length - maxHistoryLength)
              : trimmed;

      setHistoryIndex(limited.length - 1);
      return limited;
    });
  }, [historyIndex, maxHistoryLength]);

  const insertEmojiObject = useCallback((emojiValue) => {
    const emoji = String(emojiValue || "⭐").trim() || "⭐";
    const center = getViewportCenterPoint(canvasSize, viewport);
    const pageIndex = Number(canvasProps?.currentPageIndex) || 0;

    const nextElement = {
      id: makeObjectId("emoji"),
      type: "text",
      text: emoji,
      x: center.x - 24,
      y: center.y - 24,
      w: 56,
      h: 56,
      fontSize: 42,
      lineHeight: 56,
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      stroke: "#111827",
      fill: "transparent",
      textAlign: "left",
      emojiObject: true,
      pageIndex,
      animation: {
        type: "none",
        durationMs: 1000,
        delayMs: 0,
      },
    };

    const next = [...elements, nextElement];
    setElements(next);
    setSelectedIds([nextElement.id]);
    setTool("select");
    commitHistory(next);
    createTimelineFrameForNewObject(next);
  }, [
    canvasProps,
    canvasSize,
    viewport,
    elements,
    commitHistory,
    createTimelineFrameForNewObject,
  ]);

  const insertRichTextObject = useCallback((richTextPayload = {}) => {
    const center = getViewportCenterPoint(canvasSize, viewport);
    const pageIndex = Number(canvasProps?.currentPageIndex) || 0;
    const plainText = String(richTextPayload.plainText || "Rich text box");
    const fontSize = Math.max(
        8,
        Math.min(96, Number(richTextPayload.fontSize) || 22)
    );

    const nextElement = {
      id: makeObjectId("rich_text"),
      type: "text",
      x: center.x - 160,
      y: center.y - 60,
      w: 320,
      h: 120,
      html: richTextPayload.html || plainText,
      plainText,
      text: plainText,
      fontSize,
      lineHeight: Math.round(fontSize * 1.35),
      fontFamily: richTextPayload.fontFamily || currentTextStyle.fontFamily || "Arial",
      stroke: richTextPayload.stroke || stroke || "#111827",
      fill: "transparent",
      bold: !!richTextPayload.bold,
      italic: !!richTextPayload.italic,
      underline: !!richTextPayload.underline,
      textAlign: "left",
      richTextObject: true,
      pageIndex,
      animation: {
        type: "none",
        durationMs: 1000,
        delayMs: 0,
      },
    };

    const next = [...elements, nextElement];
    setElements(next);
    setSelectedIds([nextElement.id]);
    setTool("select");
    commitHistory(next);
    createTimelineFrameForNewObject(next);
  }, [
    canvasProps,
    canvasSize,
    viewport,
    elements,
    stroke,
    currentTextStyle,
    commitHistory,
    createTimelineFrameForNewObject,
  ]);

  const insertGifPrimitiveObject = useCallback((payload = {}) => {
    const primitiveType = payload.type || "line";
    const animationType = payload.animated ? payload.animationType || "draw" : "none";
    const center = getViewportCenterPoint(canvasSize, viewport);
    const pageIndex = Number(canvasProps?.currentPageIndex) || 0;
    const baseStroke = stroke || "#111827";

    let nextElement;

    if (primitiveType === "rectangle" || primitiveType === "ellipse" || primitiveType === "circle") {
      const isEllipse = primitiveType === "ellipse" || primitiveType === "circle";
      const size = primitiveType === "circle" ? 110 : null;

      nextElement = {
        id: makeObjectId(isEllipse ? "gif_ellipse" : "gif_rect"),
        type: isEllipse ? "ellipse" : "rect",
        x: center.x - (size ? size / 2 : 80),
        y: center.y - (size ? size / 2 : 45),
        w: size || 160,
        h: size || 90,
        stroke: baseStroke,
        fill: "transparent",
        strokeWidth: 2,
        strokeDash: "solid",
        cornerRadius: isEllipse ? 0 : Number(canvasProps?.cornerRadius) || 0,
        pageIndex,
        gifPrimitive: true,
        animation: createAnimationConfig(animationType),
      };
    } else {
      const isArrow = primitiveType === "arrow";
      const x1 = center.x - 100;
      const y1 = center.y;
      const x2 = center.x + 100;
      const y2 = center.y;

      nextElement = {
        id: makeObjectId(isArrow ? "gif_arrow" : "gif_line"),
        type: isArrow ? "arrow" : "line",
        x1,
        y1,
        x2,
        y2,
        cx1: x1,
        cy1: y1,
        cx2: x2,
        cy2: y2,
        stroke: baseStroke,
        fill: "transparent",
        strokeWidth: 2,
        strokeDash: "solid",
        lineStyle: "straight",
        arrowEnd: isArrow,
        pageIndex,
        gifPrimitive: true,
        animation: createAnimationConfig(animationType),
      };
    }

    const next = [...elements, nextElement];
    setElements(next);
    setSelectedIds([nextElement.id]);
    setTool("select");
    commitHistory(next);
    createTimelineFrameForNewObject(next);

    if (animationType !== "none") {
      setFrameAnimationPlaying(false);
      setFrameAnimationTimeMs(0);
      window.requestAnimationFrame(() => {
        setFrameAnimationPlaying(true);
      });
    }
  }, [
    canvasProps,
    canvasSize,
    viewport,
    elements,
    stroke,
    commitHistory,
    createTimelineFrameForNewObject,
  ]);


  const insertSystemDesignPrimitiveObject = useCallback((payload = {}) => {
    const center = getViewportCenterPoint(canvasSize, viewport);
    const pageIndex = Number(canvasProps?.currentPageIndex) || 0;
    const createdElements = buildSystemDesignPrimitiveElements({
      primitiveType: payload.type || "cache",
      center,
      pageIndex,
      strokeColor: stroke || "#111827",
      cornerRadius: Number(canvasProps?.cornerRadius) || 16,
    });

    if (!createdElements.length) {
      return;
    }

    const next = [...elements, ...createdElements];
    setElements(next);
    setSelectedIds(createdElements.map((element) => element.id));
    setTool("select");
    commitHistory(next);
    createTimelineFrameForNewObject(next);
  }, [
    canvasProps,
    canvasSize,
    viewport,
    elements,
    stroke,
    commitHistory,
    createTimelineFrameForNewObject,
  ]);


  const generateCodeIllustration = useCallback((payload = {}) => {
    const center = getViewportCenterPoint(canvasSize, viewport);
    const numbers = parseCodeIllustratorNumbers(payload.numbers);
    const generatedFrames = buildCodeIllustrationFrames({
      algorithm: payload.algorithm || "bubble",
      problemType: payload.problemType || "auto",
      code: payload.code || "",
      numbers,
      centerX: center.x,
      title: payload.title || "Code Illustrator",
    });

    if (!generatedFrames.length) {
      showSketchyAlert({
        icon: "⚠️",
        title: "Code Illustrator",
        message: "No animation frames could be generated for this input.",
      });
      return;
    }

    const nextFrames = generatedFrames.map((generatedFrame, index) =>
        createTimelineFrame(generatedFrame.elements, index, {
          name: generatedFrame.name || `Step ${index + 1}`,
        })
    );

    const firstElements = cloneElements(nextFrames[0]?.elements || []);

    setTimelineFrames(nextFrames);
    setCurrentFrameIndex(0);
    setElements(firstElements);
    setSelectedIds([]);
    setTool("select");
    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
    setFramesPanelOpen(true);
    commitHistory(firstElements);

    // Do not show a blocking modal here. It blurs the canvas and looks like a frozen screen
    // while the user is trying to inspect generated frames. Frames panel opens automatically.
  }, [canvasSize, viewport, commitHistory, showSketchyAlert]);

  const {
    canvasRef,
    jsonInputRef,
    exportPNG,
    exportJPEG,
    exportSVG,
    exportPDF,
    printCanvas,
    exportJSON,
    importDrawingJson,
    openJsonPicker,
  } = useSketchyBoardActions({
    elements,
    viewport,
    canvasSize,
    canvasProps,
    drawingTitle: currentDrawingMeta.title,
    setElements,
    setSelectedIds,
    setViewport,
    setCanvasSize,
    setCanvasProps,
    commitHistory,
  });
  const selectedElements = useMemo(() => {
    if (!selectedIds.length) return [];

    const selectedSet = new Set(selectedIds);
    return elements.filter((el) => selectedSet.has(el.id));
  }, [elements, selectedIds]);

  const selectedElement =
      selectedElements.length === 1 ? selectedElements[0] : null;

  const activeSelection =
      selectedElements.length > 0
          ? selectedElements.length === 1
              ? selectedElements[0]
              : {
                id: "__multi__",
                type: "multiple",
                selectedCount: selectedElements.length,
                stroke: selectedElements[0]?.stroke || stroke,
                strokeWidth: selectedElements[0]?.strokeWidth || 2,
                strokeDash: selectedElements[0]?.strokeDash || "solid",
              }
          : null;

  const updateSelectedElementStyle = (patch) => {
    if (!selectedIds.length) return;

    const selectedSet = new Set(selectedIds);
    let touchedText = false;

    const next = elements.map((el) => {
      if (!selectedSet.has(el.id)) return el;

      const updated = {
        ...el,
        ...patch,
      };

      if (updated.type === "text") {
        touchedText = true;

        const style = normalizeTextStyle(updated);

        const box = measureTextBox(updated.text || "", style);

        return {
          ...updated,

          // Important:
          // do not move text position when style changes
          x: el.x,
          y: el.y,

          stroke: style.stroke,
          w: box.w,
          h: box.h,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          fontFamily: style.fontFamily,
          bold: style.bold,
          italic: style.italic,
          underline: style.underline,
          textAlign: style.textAlign,
        };
      }

      return updated;
    });

    if (touchedText && hasTextStylePatch(patch)) {
      updateCurrentTextStyle(patch);
    }

    setElements(next);
    commitHistory(next);
    updateCurrentTimelineFrame(next);
  };

  const undo = () => {
    if (historyIndex === 0) {
      showSketchyAlert({
        icon: "↩️",
        title: "Nothing to undo",
        message: "No previous canvas step is available yet.",
      });
      return;
    }

    const nextIndex = historyIndex - 1;

    setHistoryIndex(nextIndex);
    setElements(cloneElements(history[nextIndex]));
    setSelectedIds([]);

    // showSketchyAlert({
    //   icon: "↩️",
    //   title: "Undo applied",
    //   message: `Moved back to step ${nextIndex + 1} of ${history.length}.`,
    // });
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) {
      showSketchyAlert({
        icon: "↪️",
        title: "Nothing to redo",
        message: "No next canvas step is available yet.",
      });
      return;
    }

    const nextIndex = historyIndex + 1;

    setHistoryIndex(nextIndex);
    setElements(cloneElements(history[nextIndex]));
    setSelectedIds([]);

    // showSketchyAlert({
    //   icon: "↪️",
    //   title: "Redo applied",
    //   message: `Moved forward to step ${nextIndex + 1} of ${history.length}.`,
    // });
  };

  const createNewDrawing = () => {
    showSketchyAlert({
      type: "confirm",
      icon: "✨",
      title: "Create new drawing?",
      message: "Your current canvas will be cleared. Save it first if you want to keep the changes.",
      confirmText: "Create new",
      onConfirm: () => {
        const nextElements = [];

        setElements(nextElements);
        setSelectedIds([]);
        setHistory([[]]);
        setHistoryIndex(0);
        replaceTimelineWithElements([]);

        setViewport({
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
        });

        setCurrentDrawingMeta({
          id: null,
          title: DEFAULT_TITLE,
          groupName: DEFAULT_GROUP,
          description: "",
        });

        setCanvasProps(DEFAULT_CANVAS_PROPS);

        setSketchyAlert(null);
      },
    });
  };

  const clearCanvas = () => {
    showSketchyAlert({
      type: "confirm",
      icon: "🧹",
      title: "Clear whole canvas?",
      message: "All canvas steps/history will be cleared and the whole canvas will become empty.",
      confirmText: "Clear canvas",
      onConfirm: () => {
        setElements([]);
        setSelectedIds([]);
        setHistory([[]]);
        setHistoryIndex(0);
        replaceTimelineWithElements([]);
        setSketchyAlert(null);
      },
    });
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;

    const selectedSet = new Set(selectedIds);

    const parentShapeIds = elements
        .filter(
            (el) =>
                selectedSet.has(el.id) &&
                (el.type === "rect" ||
                    el.type === "ellipse" ||
                    el.type === "diamond")
        )
        .map((el) => el.id);

    let next = elements.filter((el) => !selectedSet.has(el.id));

    if (parentShapeIds.length > 0) {
      const parentSet = new Set(parentShapeIds);
      next = next.filter((el) => !parentSet.has(el.parentId));
    }

    setElements(next);
    setSelectedIds([]);
    commitHistory(next);
    updateCurrentTimelineFrame(next);
  };

  const toggleSelectedLineCurve = () => {
    if (!selectedElement) return;
    if (selectedElement.type !== "line" && selectedElement.type !== "arrow") {
      return;
    }

    const next = elements.map((el) => {
      if (el.id !== selectedElement.id) return el;

      const isCurved = el.lineStyle === "curved";
      const x1 = el.x1;
      const y1 = el.y1;
      const x2 = el.x2;
      const y2 = el.y2;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      if (isCurved) {
        return {
          ...el,
          lineStyle: "straight",
          cx1: midX,
          cy1: midY,
          cx2: midX,
          cy2: midY,
          points: undefined,
        };
      }

      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy) || 1;
      const curveAmount = Math.min(90, Math.max(28, length * 0.22));
      const controlX = midX + (-dy / length) * curveAmount;
      const controlY = midY + (dx / length) * curveAmount;

      return {
        ...el,
        lineStyle: "curved",
        cx1: controlX,
        cy1: controlY,
        cx2: controlX,
        cy2: controlY,
        points: undefined,
      };
    });

    setElements(next);
    commitHistory(next);
    updateCurrentTimelineFrame(next);
  };

  return (
      <div className="app-shell">
        <SketchyAlert
            alert={sketchyAlert}
            onClose={closeSketchyAlert}
            onConfirm={() => sketchyAlert?.onConfirm?.()}
        />

        <div className="layout">
          <Sidebar
              tool={tool}
              setTool={setTool}
              stroke={stroke}
              setStroke={setStroke}
              colors={COLORS}
              selectedElement={activeSelection}
              deleteSelected={deleteSelected}
              toggleSelectedLineCurve={toggleSelectedLineCurve}
              updateSelectedElementStyle={updateSelectedElementStyle}
              canvasProps={canvasProps}
              updateCanvasProps={updateCanvasProps}
              frames={timelineFrames}
              currentFrameIndex={currentFrameIndex}
              animationPlaying={frameAnimationPlaying}
              animationTimeMs={frameAnimationTimeMs}
              advanceMode={frameAdvanceMode}
              onAdvanceModeChange={setFrameAdvanceMode}
              onOpenPlayer={openAnimationPlayer}
              onAddFrameAfter={addTimelineFrameAfterCurrent}
              onToggleFrameAnimation={toggleCurrentFrameAnimation}
              onApplyFrameObjectOrderTiming={applyFrameObjectOrderTiming}
              onMergeFrameWithNext={mergeCurrentFrameWithNext}
              onMergeAllFrames={mergeAllTimelineFrames}
              onInsertGifPrimitive={insertGifPrimitiveObject}
              onInsertEmoji={insertEmojiObject}
              onInsertRichText={insertRichTextObject}
              onGenerateCodeIllustration={generateCodeIllustration}
              onInsertSystemDesignPrimitive={insertSystemDesignPrimitiveObject}
          />

          <div className="work-area">
            <input
                ref={jsonInputRef}
                type="file"
                accept="application/json"
                onChange={importDrawingJson}
                style={{ display: "none" }}
            />

            <Toolbar
                undo={undo}
                redo={redo}
                clearCanvas={clearCanvas}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
                showGrid={showGrid}
                setShowGrid={setShowGrid}
                exportPNG={exportPNG}
                exportJPEG={exportJPEG}
                exportSVG={exportSVG}
                exportPDF={exportPDF}
                printCanvas={printCanvas}
                exportJSON={exportJSON}
                canvasProps={canvasProps}
                updateCanvasProps={updateCanvasProps}
                openJsonPicker={openJsonPicker}
                drawingTitle={currentDrawingMeta.title}
                onDrawingTitleChange={(title) =>
                    setCurrentDrawingMeta((prev) => ({
                      ...prev,
                      title: title || "Untitled",
                    }))
                }
                createNewDrawing={createNewDrawing}
                timelineFrames={timelineFrames}
                currentFrameIndex={currentFrameIndex}
                openFramesPanel={() => setFramesPanelOpen(true)}
                exportGIF={exportGif}
                gifExporting={gifExporting}
                gifExportProgress={gifExportProgress}
            />

            <CanvasBoard
                tool={tool}
                setTool={setTool}
                stroke={stroke}
                elements={elements}
                setElements={setElements}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                commitHistory={commitHistory}
                onExport={exportPNG}
                history={history}
                showGrid={showGrid}
                canvasRef={canvasRef}
                viewport={viewport}
                setViewport={setViewport}
                canvasSize={canvasSize}
                setCanvasSize={setCanvasSize}
                currentDrawingMeta={currentDrawingMeta}
                setCurrentDrawingMeta={setCurrentDrawingMeta}
                canvasProps={canvasProps}
                setCanvasProps={setCanvasProps}
                currentTextStyle={currentTextStyle}
                timelineFrames={timelineFrames}
                currentFrameIndex={currentFrameIndex}
                renderOptions={animationRenderOptions}
                onCreateTimelineFrame={createTimelineFrameForNewObject}
                onUpdateTimelineFrame={updateCurrentTimelineFrame}
                onReplaceTimeline={replaceTimelineWithElements}
                onStartAnimationPreview={startCurrentFrameAnimationPreview}
            />

            <FramesPanel
                open={framesPanelOpen}
                frames={timelineFrames}
                currentIndex={currentFrameIndex}
                canvasSize={canvasSize}
                canvasViewport={viewport}
                canvasProps={canvasProps}
                renderOptions={animationRenderOptions}
                animationPlaying={frameAnimationPlaying}
                animationTimeMs={frameAnimationTimeMs}
                onClose={() => setFramesPanelOpen(false)}
                onSelectFrame={selectTimelineFrame}
                onAddFrameAfter={addTimelineFrameAfterCurrent}
                onDeleteFrame={deleteTimelineFrame}
                onToggleElementHidden={toggleFrameElementHidden}
                onMoveFrameElementOrder={moveFrameElementOrder}
                onApplyFrameObjectOrderTiming={applyFrameObjectOrderTiming}
                onMergeFrameWithNext={mergeCurrentFrameWithNext}
                onMergeAllFrames={mergeAllTimelineFrames}
            />

            <FramePlayerScreen
                open={animationPlayerOpen}
                frame={animationPlayerFrame}
                frameIndex={animationPlayerFrameIndex}
                totalFrames={timelineFrames.length || 1}
                mode={animationPlayerMode}
                advanceMode={frameAdvanceMode}
                canvasSize={canvasSize}
                canvasViewport={viewport}
                canvasProps={canvasProps}
                renderOptions={animationPlayerRenderOptions}
                playing={animationPlayerPlaying}
                timeMs={animationPlayerTimeMs}
                waitingForNext={animationPlayerWaitingForNext}
                playbackSpeed={animationPlayerSpeed}
                onPlaybackSpeedChange={setAnimationPlayerSpeed}
                onClose={closeAnimationPlayer}
                onRestart={restartAnimationPlayerFrame}
                onNext={advanceAnimationPlayerFrame}
                onAdvanceModeChange={setFrameAdvanceMode}
            />
          </div>

          <RightToolTabs
              frames={timelineFrames}
              currentFrameIndex={currentFrameIndex}
              canvasSize={canvasSize}
              canvasViewport={viewport}
              canvasProps={canvasProps}
              renderOptions={animationRenderOptions}
              animationPlaying={frameAnimationPlaying}
              animationTimeMs={frameAnimationTimeMs}
              onSelectFrame={selectTimelineFrame}
              onAddFrameAfter={addTimelineFrameAfterCurrent}
              onDeleteFrame={deleteTimelineFrame}
              onToggleElementHidden={toggleFrameElementHidden}
              onMoveFrameElementOrder={moveFrameElementOrder}
              onApplyFrameObjectOrderTiming={applyFrameObjectOrderTiming}
              onMergeFrameWithNext={mergeCurrentFrameWithNext}
              onMergeAllFrames={mergeAllTimelineFrames}
          />
        </div>
      </div>
  );
}

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setStatus("Invalid reset link. Token missing.");
      setSuccess(false);
      return;
    }

    if (!password || password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      setSuccess(false);
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      setSuccess(false);
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const data = await resetPassword({
        token,
        newPassword: password,
      });

      setStatus(
          data?.message || "Password reset successfully. You can now login."
      );
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatus(err?.message || "Password reset failed.");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="app-shell">
        <div className="verify-page">
          <div className="verify-card">
            <h1>Sketchy</h1>
            <h2>Reset Password</h2>

            <form onSubmit={handleSubmit}>
              <label className="reset-field">
                <span>New password</span>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                />
              </label>

              <label className="reset-field">
                <span>Confirm password</span>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                />
              </label>

              {status && (
                  <p className={success ? "verify-success" : "verify-message"}>
                    {status}
                  </p>
              )}

              <button type="submit" disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <button
                type="button"
                style={{ marginTop: 12 }}
                onClick={() => {
                  window.location.href = "/";
                }}
            >
              Go to SketchyDraw
            </button>
          </div>
        </div>
      </div>
  );
}

export default function App() {
  const path = window.location.pathname;

  if (path === "/verify") {
    return <VerifyPage />;
  }

  if (path === "/reset-password") {
    return <ResetPasswordPage />;
  }

  if (path === "/terms") {
    return <TermsPage />;
  }

  if (path === "/privacy-policy") {
    return <PrivacyPolicyPage />;
  }

  if (path === "/refund-policy") {
    return <RefundPolicyPage />;
  }

  if (path === "/cancellation-policy") {
    return <CancellationPolicyPage />;
  }

  if (path === "/delivery-policy") {
    return <DeliveryPolicyPage />;
  }

  if (path === "/contact-us") {
    return <ContactUsPage />;
  }

  return <SketchyDrawPage />;
}