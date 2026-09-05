import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import "./App.css";

import Toolbar from "./components/Toolbar/Toolbar";
import Sidebar from "./components/Sidebar/Sidebar";
import CanvasBoard from "./components/CanvasBoard/CanvasBoard";
import FramesPanel from "./components/FramesPanel/FramesPanel";
import FramePlayerScreen from "./components/FramePlayerScreen/FramePlayerScreen";
import StoryboardBar from "./components/StoryboardBar/StoryboardBar";
import SEO from "./components/SEO/SEO";
import SeoLandingPage, { SEO_PAGES } from "./components/SeoLandingPage/SeoLandingPage";
import SketchyAlert from "./components/SketchyAlert";
import MarkdownViewer from "./components/MarkDownViewer/MarkdownViewer";
import SpreadsheetWorkspace from "./components/SpreadsheetWorkspace/SpreadsheetWorkspace";
import { verifyEmail, resetPassword } from "./api/authApi";
import { measureTextBox, measureWrappedTextBox } from "./canvas/textMetrics";
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
import {
  DEFAULT_TIMELINE_PLAYBACK_SPEED,
  getFramePlaybackDurationMs,
  getTimelineSourceTimeMs,
  normalizeTimelinePlaybackSpeed,
} from "./canvas/animationTimeline";
import {
  DEFAULT_ANIMATION_EXPORT_RESOLUTION,
  DEFAULT_ANIMATION_EXPORT_FIT_CONTENT,
  DEFAULT_ANIMATION_EXPORT_TEXT_SCALE_PERCENT,
  DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT,
  normalizeAnimationExportResolution,
  normalizeAnimationExportPan,
  normalizeAnimationExportTextScalePercent,
  normalizeAnimationExportZoomPercent,
} from "./canvas/animationExportSettings";
import { buildTextElement } from "./canvas/canvasFactories";
import { buildCodeIllustrationFrames, parseCodeIllustratorNumbers } from "./codeIllustrator";
import { exportTimelineGif } from "./utils/exportGif";
import { hasProAccess, requestProUpgrade } from "./utils/proFeatureGate";
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

function createTimelineFrame(elements = [], index = 0, patch = {}) {
  return {
    id: makeFrameId(),
    name: `Frame ${index + 1}`,
    elements: cloneElements(elements),
    hiddenElementIds: [],
    durationMs: 1300,
    gapAfterMs: 0,
    transition: "none",
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
  return getFramePlaybackDurationMs(frame);
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
  const proUser = hasProAccess();
  const requirePro = useCallback((feature, action) => {
    if (!hasProAccess()) {
      requestProUpgrade(feature);
      return false;
    }
    action?.();
    return true;
  }, []);
  const [showGrid, setShowGrid] = useState(false);
  const [socialCreatorPreset, setSocialCreatorPreset] = useState(null);
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
  const [markdownViewer, setMarkdownViewer] = useState({ open: false, title: "Markdown Grid", content: "" });
  const [workspaceMode, setWorkspaceMode] = useState("canvas");

  const [timelineFrames, setTimelineFrames] = useState(() => [
    createTimelineFrame([], 0),
  ]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [framesPanelOpen, setFramesPanelOpen] = useState(false);

  useEffect(() => {
    const handleOpenFrameAnimationManager = () => setFramesPanelOpen(true);
    window.addEventListener(
        "sketchydraw:open-frame-animation-manager",
        handleOpenFrameAnimationManager
    );
    return () =>
        window.removeEventListener(
            "sketchydraw:open-frame-animation-manager",
            handleOpenFrameAnimationManager
        );
  }, []);
  const [focusMode, setFocusMode] = useState(false);
  const [frameAnimationPlaying, setFrameAnimationPlaying] = useState(false);
  const [frameAnimationTimeMs, setFrameAnimationTimeMs] = useState(0);

  const [frameAdvanceMode, setFrameAdvanceMode] = useState("enter");
  const [animationPlayerOpen, setAnimationPlayerOpen] = useState(false);
  const [animationPlayerMode, setAnimationPlayerMode] = useState("current");
  const [animationPlayerFrameIndex, setAnimationPlayerFrameIndex] = useState(0);
  const [animationPlayerPlaying, setAnimationPlayerPlaying] = useState(false);
  const [animationPlayerTimeMs, setAnimationPlayerTimeMs] = useState(0);
  const [animationPlayerWaitingForNext, setAnimationPlayerWaitingForNext] = useState(false);
  const [animationPlayerSpeed, setAnimationPlayerSpeed] = useState(() => {
    try {
      return normalizeTimelinePlaybackSpeed(
          window.localStorage.getItem("sketchydraw.timelinePlaybackSpeed") ||
          DEFAULT_TIMELINE_PLAYBACK_SPEED
      );
    } catch {
      return DEFAULT_TIMELINE_PLAYBACK_SPEED;
    }
  });
  const [animationExportResolution, setAnimationExportResolution] = useState(() => {
    try {
      return normalizeAnimationExportResolution(
          window.localStorage.getItem("sketchydraw.animationExportResolution") ||
          DEFAULT_ANIMATION_EXPORT_RESOLUTION
      );
    } catch {
      return DEFAULT_ANIMATION_EXPORT_RESOLUTION;
    }
  });
  const [animationExportZoomPercent, setAnimationExportZoomPercent] = useState(() => {
    try {
      return normalizeAnimationExportZoomPercent(
          window.localStorage.getItem("sketchydraw.animationExportZoomPercent") ||
          DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT
      );
    } catch {
      return DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT;
    }
  });
  const [animationExportFitContent, setAnimationExportFitContent] = useState(() => {
    try {
      return window.localStorage.getItem("sketchydraw.animationExportFitContent") !== "false";
    } catch {
      return DEFAULT_ANIMATION_EXPORT_FIT_CONTENT;
    }
  });
  const [animationExportPan, setAnimationExportPan] = useState(() => {
    try {
      return normalizeAnimationExportPan(
          JSON.parse(window.localStorage.getItem("sketchydraw.animationExportPan") || "null")
      );
    } catch {
      return { x: 0, y: 0 };
    }
  });
  const [animationExportTextScalePercent, setAnimationExportTextScalePercent] = useState(() => {
    try {
      return normalizeAnimationExportTextScalePercent(
          window.localStorage.getItem("sketchydraw.animationExportTextScalePercent") ||
          DEFAULT_ANIMATION_EXPORT_TEXT_SCALE_PERCENT
      );
    } catch {
      return DEFAULT_ANIMATION_EXPORT_TEXT_SCALE_PERCENT;
    }
  });
  const animationPlayerAdvanceTimeoutRef = useRef(null);
  const frameActionUndoStackRef = useRef([]);

  const updateTimelinePlaybackSpeed = useCallback((value) => {
    const nextSpeed = normalizeTimelinePlaybackSpeed(value);
    setAnimationPlayerSpeed(nextSpeed);
    try {
      window.localStorage.setItem("sketchydraw.timelinePlaybackSpeed", String(nextSpeed));
    } catch {}
  }, []);

  const updateAnimationExportResolution = useCallback((value) => {
    const nextResolution = normalizeAnimationExportResolution(value);
    setAnimationExportResolution(nextResolution);
    try {
      window.localStorage.setItem("sketchydraw.animationExportResolution", nextResolution);
    } catch {}
  }, []);

  const updateAnimationExportZoomPercent = useCallback((value) => {
    const nextZoom = normalizeAnimationExportZoomPercent(value);
    setAnimationExportZoomPercent(nextZoom);
    try {
      window.localStorage.setItem("sketchydraw.animationExportZoomPercent", String(nextZoom));
    } catch {}
  }, []);

  const updateAnimationExportFitContent = useCallback((value) => {
    const nextValue = Boolean(value);
    setAnimationExportFitContent(nextValue);
    try {
      window.localStorage.setItem("sketchydraw.animationExportFitContent", String(nextValue));
    } catch {}
  }, []);

  const updateAnimationExportPan = useCallback((value) => {
    const nextPan = normalizeAnimationExportPan(value);
    setAnimationExportPan(nextPan);
    try {
      window.localStorage.setItem("sketchydraw.animationExportPan", JSON.stringify(nextPan));
    } catch {}
  }, []);

  const updateAnimationExportTextScalePercent = useCallback((value) => {
    const nextValue = normalizeAnimationExportTextScalePercent(value);
    setAnimationExportTextScalePercent(nextValue);
    try {
      window.localStorage.setItem("sketchydraw.animationExportTextScalePercent", String(nextValue));
    } catch {}
  }, []);

  const rememberFrameAction = useCallback((label, frames, activeIndex) => {
    const snapshot = {
      label,
      frames: (frames || []).map((frame) => ({
        ...frame,
        hiddenElementIds: [...(frame.hiddenElementIds || [])],
        elements: cloneElements(frame.elements || []),
      })),
      activeIndex: Math.max(0, Number(activeIndex) || 0),
    };

    frameActionUndoStackRef.current = [
      ...frameActionUndoStackRef.current.slice(-9),
      snapshot,
    ];
  }, []);

  const showSketchyAlert = useCallback((payload) => {
    setSketchyAlert({
      open: true,
      type: "info",
      title: "SketchyDraw",
      icon: "✏️",
      ...payload,
    });
  }, []);

  const undoLastFrameAction = useCallback(() => {
    const stack = frameActionUndoStackRef.current;
    const snapshot = stack[stack.length - 1];

    if (!snapshot) {
      showSketchyAlert({
        type: "info",
        title: "Nothing to undo",
        message: "No frame merge action is available to undo.",
      });
      return;
    }

    frameActionUndoStackRef.current = stack.slice(0, -1);

    const restoredFrames = snapshot.frames.map((frame) => ({
      ...frame,
      hiddenElementIds: [...(frame.hiddenElementIds || [])],
      elements: cloneElements(frame.elements || []),
    }));

    const safeIndex = Math.max(
        0,
        Math.min(snapshot.activeIndex, restoredFrames.length - 1)
    );

    setTimelineFrames(restoredFrames);
    setCurrentFrameIndex(safeIndex);
    setElements(cloneElements(restoredFrames[safeIndex]?.elements || []));
    setSelectedIds([]);
    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);

    showSketchyAlert({
      type: "success",
      title: "Frame action undone",
      message: `${snapshot.label} was reversed.`,
    });
  }, [showSketchyAlert]);

  const closeSketchyAlert = useCallback(() => {
    setSketchyAlert(null);
  }, []);

  useEffect(() => {
    const openMarkdown = (event) => setMarkdownViewer((previous) => ({
      open: true,
      title: event.detail?.title || previous.title || "Markdown Grid",
      content: event.detail?.content ?? previous.content ?? "",
    }));
    const openMarkdownWorkspace = (event) => { openMarkdown(event); setWorkspaceMode("markdown"); };
    window.addEventListener("sketchydraw:open-markdown-grid", openMarkdownWorkspace);
    return () => window.removeEventListener("sketchydraw:open-markdown-grid", openMarkdownWorkspace);
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
      loopAnimation: false,
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
    const durationMs = getFramePlaybackDurationMs(currentTimelineFrame);

    const tick = (now) => {
      const elapsedMs = getTimelineSourceTimeMs(now - startedAt, animationPlayerSpeed);
      if (elapsedMs >= durationMs) {
        setFrameAnimationTimeMs(durationMs);
        setFrameAnimationPlaying(false);
        return;
      }

      setFrameAnimationTimeMs(elapsedMs);
      rafId = window.requestAnimationFrame(tick);
    };

    setFrameAnimationTimeMs(0);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [frameAnimationPlaying, currentTimelineFrame, animationPlayerSpeed]);

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
    const speed = normalizeTimelinePlaybackSpeed(animationPlayerSpeed);

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
            }, Math.max(0, (Number(animationPlayerFrame?.gapAfterMs) || 0) / speed));
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


  const restoreTimelineFrames = useCallback((savedFrames, requestedIndex = 0) => {
    const normalizedFrames = (Array.isArray(savedFrames) ? savedFrames : [])
        .filter(Boolean)
        .map((savedFrame, index) => createTimelineFrame(savedFrame.elements || [], index, {
          ...savedFrame,
          id: savedFrame.id || makeFrameId(),
          name: savedFrame.name || `Frame ${index + 1}`,
          durationMs: Math.max(1000, Number(savedFrame.durationMs) || 10000),
          hiddenElementIds: Array.isArray(savedFrame.hiddenElementIds)
              ? [...savedFrame.hiddenElementIds]
              : [],
          elements: cloneElements(savedFrame.elements || []),
        }));

    const nextFrames = normalizedFrames.length
        ? normalizedFrames
        : [createTimelineFrame([], 0)];
    const safeIndex = Math.max(
        0,
        Math.min(Number(requestedIndex) || 0, nextFrames.length - 1)
    );

    setTimelineFrames(nextFrames);
    setCurrentFrameIndex(safeIndex);
    setElements(cloneElements(nextFrames[safeIndex]?.elements || []));
    setSelectedIds([]);
    setHistory([cloneElements(nextFrames[safeIndex]?.elements || [])]);
    setHistoryIndex(0);
    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
    // Restoring/opening a saved drawing must not automatically open Manage Frames.
    // The panel should open only from an explicit user action (Manage / frame count).
    setFramesPanelOpen(false);
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

  const createSocialTextPages = useCallback(({
                                               pages = [],
                                               firstPagePosition,
                                               followingPagePosition,
                                               style = {},
                                               parentId = null,
                                             }) => {
    const safePages = pages.filter((page) => String(page || "").trim()).slice(0, 20);
    if (!safePages.length) return;

    const baseElements = cloneElements(elements);
    const pageFrames = safePages.map((pageText, pageIndex) => {
      const position = pageIndex === 0 ? firstPagePosition : followingPagePosition;
      const textElement = buildTextElement({
        x: position?.x || 0,
        y: position?.y || 0,
        text: pageText,
        stroke: style.stroke,
        parentId,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontFamily: style.fontFamily,
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
        textAlign: style.textAlign,
        richText: [],
      });

      return createTimelineFrame([...cloneElements(baseElements), textElement], pageIndex, {
        name: `Picture ${pageIndex + 1}`,
      });
    });

    setTimelineFrames((prevFrames) => {
      const safeFrames = prevFrames.length ? prevFrames : [createTimelineFrame([], 0)];
      const safeIndex = Math.max(0, Math.min(currentFrameIndex, safeFrames.length - 1));
      const nextFrames = [...safeFrames];
      nextFrames.splice(safeIndex, 1, ...pageFrames);
      return nextFrames.map((frame, index) => ({
        ...frame,
        name: frame.name?.startsWith("Frame ") ? `Frame ${index + 1}` : frame.name,
      }));
    });

    const firstElements = cloneElements(pageFrames[0].elements);
    setElements(firstElements);
    setSelectedIds([firstElements[firstElements.length - 1]?.id].filter(Boolean));
    setHistory([firstElements]);
    setHistoryIndex(0);
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

  const updateFrameAudio = useCallback((frameIndex, audioDataUrl, audioMeta = {}) => {
    setTimelineFrames((prevFrames) =>
        prevFrames.map((frame, index) =>
            index === frameIndex
                ? {
                  ...frame,
                  audioDataUrl: audioDataUrl || "",
                  audioName: audioMeta.name || "Recorded narration",
                  audioDurationMs: Math.max(
                      0,
                      Number(audioMeta.durationMs) || 0
                  ),
                }
                : frame
        )
    );
  }, []);

  const removeFrameAudio = useCallback((frameIndex) => {
    updateFrameAudio(frameIndex, "", {
      name: "",
      durationMs: 0,
    });
  }, [updateFrameAudio]);

  const mergeCurrentFrameWithNext = useCallback(() => {
    setTimelineFrames((prevFrames) => {
      const safeFrames = prevFrames.length ? prevFrames : [createTimelineFrame([], 0)];
      rememberFrameAction("Merge current frame with next", safeFrames, currentFrameIndex);
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
  }, [currentFrameIndex, rememberFrameAction]);

  const mergeAllTimelineFrames = useCallback(() => {
    setTimelineFrames((prevFrames) => {
      const safeFrames = prevFrames.length ? prevFrames : [createTimelineFrame([], 0)];
      rememberFrameAction("Merge all frames", safeFrames, currentFrameIndex);
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
  }, [currentFrameIndex, rememberFrameAction]);

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

  const updateElementFrameVisibility = useCallback((elementId, firstFrameIndex, lastFrameIndex) => {
    if (!elementId) return;

    setTimelineFrames((prevFrames) => {
      const maxIndex = Math.max(0, prevFrames.length - 1);
      const start = Math.max(0, Math.min(Number(firstFrameIndex) || 0, maxIndex));
      const end = Math.max(start, Math.min(Number(lastFrameIndex) || start, maxIndex));

      return prevFrames.map((frame, index) => {
        const containsElement = (frame.elements || []).some((element) => element.id === elementId);
        if (!containsElement) return frame;

        const hidden = new Set(frame.hiddenElementIds || []);
        if (index < start || index > end) hidden.add(elementId);
        else hidden.delete(elementId);

        return { ...frame, hiddenElementIds: Array.from(hidden) };
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
    const mode = options.mode || "sequence";
    const startDelayMs = Math.max(0, Number(options.startDelayMs) || 0);
    const delayStepMs = Math.max(0, Number(options.delayStepMs) || OBJECT_ORDER_DELAY_STEP_MS);
    const gapMs = Math.max(0, Number(options.gapMs) || 120);
    const overlapMs = Math.max(0, Number(options.overlapMs) || 250);

    setTimelineFrames((prevFrames) => {
      return prevFrames.map((frame, index) => {
        if (index !== frameIndex) return frame;

        let animatedIndex = 0;
        let sequenceCursorMs = startDelayMs;
        const nextElements = cloneElements(frame.elements || []).map((element) => {
          const type = element?.animation?.type || "none";

          if (type === "none") return element;

          const durationMs = Math.max(50, Number(element?.animation?.durationMs) || 1000);
          const delayMs = mode === "stagger"
              ? startDelayMs + animatedIndex * delayStepMs
              : sequenceCursorMs;

          animatedIndex += 1;
          if (mode !== "stagger") {
            sequenceCursorMs += Math.max(120, durationMs - overlapMs + gapMs);
          }

          return {
            ...element,
            animation: {
              ...element.animation,
              durationMs,
              delayMs: Math.round(delayMs),
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

  const updateFrameElementAnimation = useCallback((frameIndex, elementId, patch = {}) => {
    setTimelineFrames((prevFrames) => prevFrames.map((frame, index) => {
      if (index !== frameIndex) return frame;
      const nextElements = cloneElements(frame.elements || []).map((element) => {
        if (element.id !== elementId) return element;
        return {
          ...element,
          animation: {
            ...(element.animation || {}),
            ...patch,
          },
        };
      });
      if (index === currentFrameIndex) setElements(cloneElements(nextElements));
      return { ...frame, elements: nextElements };
    }));
    setFrameAnimationPlaying(false);
  }, [currentFrameIndex]);

  const updateTimelineFrameMeta = useCallback((frameIndex, patch = {}) => {
    setTimelineFrames((prevFrames) => prevFrames.map((frame, index) =>
        index === frameIndex ? { ...frame, ...patch } : frame
    ));
  }, []);

  const reorderTimelineFrames = useCallback((fromIndex, toIndex) => {
    setTimelineFrames((prevFrames) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= prevFrames.length || toIndex >= prevFrames.length) return prevFrames;
      const next = [...prevFrames];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      const renamed = renameTimelineFrames(next);
      const activeId = prevFrames[currentFrameIndex]?.id;
      const nextActiveIndex = Math.max(0, renamed.findIndex((frame) => frame.id === activeId));
      setCurrentFrameIndex(nextActiveIndex);
      return renamed;
    });
  }, [currentFrameIndex]);

  const mergeFrameWithNextAt = useCallback((frameIndex) => {
    setTimelineFrames((prevFrames) => {
      if (frameIndex < 0 || frameIndex >= prevFrames.length - 1) return prevFrames;
      rememberFrameAction("Merge frame with next", prevFrames, frameIndex);
      const currentFrame = prevFrames[frameIndex];
      const nextFrame = prevFrames[frameIndex + 1];
      const mergedFrame = {
        ...currentFrame,
        elements: mergeFrameElements(currentFrame.elements, nextFrame.elements),
        hiddenElementIds: [],
        durationMs: Math.max(1000, Number(currentFrame.durationMs) || 1300) + Math.max(1000, Number(nextFrame.durationMs) || 1300),
        gapAfterMs: Number(nextFrame.gapAfterMs) || 0,
      };
      const next = renameTimelineFrames([
        ...prevFrames.slice(0, frameIndex),
        mergedFrame,
        ...prevFrames.slice(frameIndex + 2),
      ]);
      setCurrentFrameIndex(frameIndex);
      setElements(cloneElements(mergedFrame.elements));
      setSelectedIds([]);
      return next;
    });
    setFrameAnimationPlaying(false);
    setFrameAnimationTimeMs(0);
  }, [rememberFrameAction]);

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

    // "Play all" should actually continue through every imported frame.
    // A selected-frame preview remains manual/current-frame only.
    if (mode === "all") {
      setFrameAdvanceMode("auto");
    }
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

  useEffect(() => {
    const openAnimationStoryboard = () => {
      openAnimationPlayer("current");
    };

    window.addEventListener(
        "sketchydraw:open-animation-storyboard",
        openAnimationStoryboard
    );

    return () => {
      window.removeEventListener(
          "sketchydraw:open-animation-storyboard",
          openAnimationStoryboard
      );
    };
  }, [openAnimationPlayer]);

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

  const restartAllAnimationPlayerFrames = useCallback(() => {
    if (animationPlayerAdvanceTimeoutRef.current) {
      window.clearTimeout(animationPlayerAdvanceTimeoutRef.current);
      animationPlayerAdvanceTimeoutRef.current = null;
    }

    const firstFrame = timelineFrames[0];
    setAnimationPlayerMode("all");
    setAnimationPlayerFrameIndex(0);
    setCurrentFrameIndex(0);
    setElements(cloneElements(firstFrame?.elements || []));
    setSelectedIds([]);
    setAnimationPlayerTimeMs(0);
    setAnimationPlayerWaitingForNext(false);
    setAnimationPlayerPlaying(true);
  }, [timelineFrames]);

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

  const exportGif = useCallback(async (options = {}) => {
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
        playbackSpeed: animationPlayerSpeed,
        resolution: normalizeAnimationExportResolution(
            options.resolution || animationExportResolution
        ),
        zoomPercent: normalizeAnimationExportZoomPercent(
            options.zoomPercent || animationExportZoomPercent
        ),
        fitContent: options.fitContent ?? animationExportFitContent,
        pan: normalizeAnimationExportPan(options.pan || animationExportPan),
        textScalePercent: normalizeAnimationExportTextScalePercent(
            options.textScalePercent || animationExportTextScalePercent
        ),
        onProgress: (progress) => setGifExportProgress(progress || 0),
      });
    } catch (error) {
      console.error("GIF export failed", error);
      showSketchyAlert({
        icon: "⚠️",
        title: "GIF export failed",
        message: error?.message || "GIF export could not be completed. Please try again.",
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
    animationPlayerSpeed,
    animationExportResolution,
    animationExportZoomPercent,
    animationExportFitContent,
    animationExportPan,
    animationExportTextScalePercent,
    showSketchyAlert,
  ]);

  const exportVideoFromPlayer = useCallback((options = {}) => {
    let mode = "server";
    try {
      mode = window.localStorage.getItem("sketchydraw.videoExportMode") || "server";
    } catch {}
    window.dispatchEvent(new CustomEvent("sketchydraw:export-video", {
      detail: {
        gapSeconds: 0,
        preAnimationDelaySeconds: 0,
        playbackSpeed: animationPlayerSpeed,
        resolution: options.resolution || animationExportResolution,
        zoomPercent: options.zoomPercent || animationExportZoomPercent,
        fitContent: options.fitContent ?? animationExportFitContent,
        pan: normalizeAnimationExportPan(options.pan || animationExportPan),
        textScalePercent: normalizeAnimationExportTextScalePercent(
            options.textScalePercent || animationExportTextScalePercent
        ),
        trimTrailingPause: true,
        timelineFrames: JSON.parse(JSON.stringify(timelineFrames)),
        mode,
        frameFrom: 1,
        frameTo: timelineFrames.length,
        totalFrames: timelineFrames.length,
        fileName: `${currentDrawingMeta.title || DEFAULT_TITLE}.${mode === "browser" ? "webm" : "mp4"}`,
      },
    }));
  }, [
    animationPlayerSpeed,
    animationExportResolution,
    animationExportZoomPercent,
    animationExportFitContent,
    animationExportPan,
    animationExportTextScalePercent,
    timelineFrames,
    currentDrawingMeta.title,
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
          durationMs: generatedFrame.durationMs,
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
    exportInstagram,
    exportJPEG,
    exportSVG,
    exportPDF,
    printCanvas,
    exportJSON,
    exportPPT,
    exportExcel,
    exportCSV,
    exportProtectedDrawing,
    importDrawingJson,
    openJsonPicker,
    openImportPicker,
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
    timelineFrames,
    currentFrameIndex,
    onRestoreTimeline: restoreTimelineFrames,
    socialCreatorPreset,
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

        const stableWidth = Math.max(60, Number(el.w) || measureTextBox(updated.text || "", style).w);
        const box = measureWrappedTextBox(updated.text || "", style, stableWidth);

        return {
          ...updated,

          // Important:
          // do not move text position when style changes
          x: Math.round(el.x),
          y: Math.round(el.y),

          stroke: style.stroke,
          w: Math.round(stableWidth),
          h: Math.round(box.h),
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

  const enterFocusMode = async () => {
    setFocusMode(true);
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (_) {
      // Focus mode still works even when the browser blocks fullscreen.
    }
  };

  const exitFocusMode = async () => {
    setFocusMode(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (_) {
      // The editor has already returned to its normal layout.
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!focusMode) return undefined;

    const handleFocusModeKeyDown = (event) => {
      if (event.key === "Escape") {
        exitFocusMode();
      }
    };

    window.addEventListener("keydown", handleFocusModeKeyDown);
    return () => window.removeEventListener("keydown", handleFocusModeKeyDown);
  }, [focusMode]);

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
      <>
        <SEO
            title="SketchyDraw — Animated Diagram Maker, Visual Explainers and Presentations"
            description="Create animated diagrams, visual explanations, frame-based presentations, GIFs and videos in your browser with SketchyDraw."
            path="/"
            schema={[{
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "SketchyDraw",
              applicationCategory: "DesignApplication",
              operatingSystem: "Web browser",
              url: "https://sketchydraw.com",
              description: "A browser-based workspace for animated diagrams, visual explainers, presentations, GIFs and videos.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            }]}
        />
        <div className={`app-shell ${focusMode ? "focus-mode" : ""}`}>
          <SketchyAlert
              alert={sketchyAlert}
              onClose={closeSketchyAlert}
              onConfirm={() => sketchyAlert?.onConfirm?.()}
          />

          <div className={`layout workspace-${workspaceMode}`}>
            {workspaceMode === "canvas" && <Sidebar
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
                onUpdateFrameAudio={updateFrameAudio}
                onRemoveFrameAudio={removeFrameAudio}
                animationPlaying={frameAnimationPlaying}
                animationTimeMs={frameAnimationTimeMs}
                playbackSpeed={animationPlayerSpeed}
                onPlaybackSpeedChange={updateTimelinePlaybackSpeed}
                advanceMode={frameAdvanceMode}
                onAdvanceModeChange={setFrameAdvanceMode}
                onOpenPlayer={openAnimationPlayer}
                onAddFrameAfter={addTimelineFrameAfterCurrent}
                onToggleFrameAnimation={toggleCurrentFrameAnimation}
                onApplyFrameObjectOrderTiming={applyFrameObjectOrderTiming}
                onUpdateFrameElementAnimation={updateFrameElementAnimation}
                onPreviewTimeChange={(timeMs) => { setFrameAnimationPlaying(false); setFrameAnimationTimeMs(Math.max(0, Number(timeMs) || 0)); }}
                onToggleFrameAnimation={toggleCurrentFrameAnimation}
                onMergeFrameWithNext={mergeCurrentFrameWithNext}
                onMergeAllFrames={mergeAllTimelineFrames}
                onInsertGifPrimitive={insertGifPrimitiveObject}
                onInsertEmoji={insertEmojiObject}
                onInsertRichText={insertRichTextObject}
                onGenerateCodeIllustration={generateCodeIllustration}
                onSelectFrame={(index) => requirePro("Frames", () => selectTimelineFrame(index))}
                onDeleteFrame={deleteTimelineFrame}
                onOpenFramesPanel={() => setFramesPanelOpen(true)}
                onUpdateElementFrameVisibility={updateElementFrameVisibility}
                focusMode={focusMode}
            />}

            <div className="work-area">
              <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json,.sketchylock,.docx,.pptx,.xlsx,.xls,.csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={importDrawingJson}
                  style={{ display: "none" }}
              />

              {!focusMode && workspaceMode !== "excel" && <Toolbar
                  undo={undo}
                  redo={redo}
                  clearCanvas={clearCanvas}
                  canUndo={historyIndex > 0}
                  canRedo={historyIndex < history.length - 1}
                  showGrid={showGrid}
                  setShowGrid={setShowGrid}
                  exportPNG={exportPNG}
                  exportInstagram={exportInstagram}
                  exportJPEG={exportJPEG}
                  exportSVG={exportSVG}
                  exportPDF={exportPDF}
                  printCanvas={printCanvas}
                  exportJSON={exportJSON}
                  exportPPT={exportPPT}
                  exportExcel={exportExcel}
                  exportCSV={exportCSV}
                  exportProtectedDrawing={exportProtectedDrawing}
                  canvasSize={canvasSize}
                  canvasProps={canvasProps}
                  updateCanvasProps={updateCanvasProps}
                  openJsonPicker={openJsonPicker}
                  openImportPicker={openImportPicker}
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
                  onPresentFrames={() => requirePro("Presentation and frame playback", () => openAnimationPlayer("all"))}
                  onPreviousFrame={() => requirePro("Frames", () => selectTimelineFrame(Math.max(0, currentFrameIndex - 1)))}
                  onNextFrame={() => requirePro("Frames", () => selectTimelineFrame(Math.min(timelineFrames.length - 1, currentFrameIndex + 1)))}
                  openFramesPanel={() => requirePro("Frames", () => setFramesPanelOpen(true))}
                  exportGIF={exportGif}
                  gifExporting={gifExporting}
                  gifExportProgress={gifExportProgress}
                  playbackSpeed={animationPlayerSpeed}
                  onPlaybackSpeedChange={updateTimelinePlaybackSpeed}
                  exportResolution={animationExportResolution}
                  onExportResolutionChange={updateAnimationExportResolution}
                  exportZoomPercent={animationExportZoomPercent}
                  onExportZoomPercentChange={updateAnimationExportZoomPercent}
                  exportFitContent={animationExportFitContent}
                  onExportFitContentChange={updateAnimationExportFitContent}
                  exportCameraPan={animationExportPan}
                  onExportCameraPanChange={updateAnimationExportPan}
                  exportTextScalePercent={animationExportTextScalePercent}
                  onExportTextScalePercentChange={updateAnimationExportTextScalePercent}
                  socialCreatorPreset={socialCreatorPreset}
                  setSocialCreatorPreset={setSocialCreatorPreset}
                  onToggleFocusMode={enterFocusMode}
                  onOpenMarkdownGrid={() => { setMarkdownViewer((prev) => ({ ...prev, open: true })); setWorkspaceMode("markdown"); }}
                  onOpenExcelGrid={() => setWorkspaceMode("excel")}
                  tool={tool}
                  setTool={setTool}
              />}

              {workspaceMode === "canvas" && <CanvasBoard
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
                  onRestoreTimeline={restoreTimelineFrames}
                  onStartAnimationPreview={startCurrentFrameAnimationPreview}
                  onCreateSocialTextPages={createSocialTextPages}
                  onSelectTimelineFrame={(index) => requirePro("Frames", () => selectTimelineFrame(index))}
                  socialCreatorPreset={socialCreatorPreset}
                  focusMode={focusMode}
              />}

              {workspaceMode === "canvas" && !focusMode && <StoryboardBar
                  frames={timelineFrames}
                  currentIndex={currentFrameIndex}
                  onSelectFrame={selectTimelineFrame}
                  onAddFrame={() => requirePro("Frames", addTimelineFrameAfterCurrent)}
                  onOpenManager={() => requirePro("Frames", () => setFramesPanelOpen(true))}
                  onPresent={() => requirePro("Presentation and frame playback", () => openAnimationPlayer("all"))}
                  onPreviousFrame={() => requirePro("Frames", () => selectTimelineFrame(Math.max(0, currentFrameIndex - 1)))}
                  onNextFrame={() => requirePro("Frames", () => selectTimelineFrame(Math.min(timelineFrames.length - 1, currentFrameIndex + 1)))}
                  onPlayCurrent={() => requirePro("Frame playback", () => openAnimationPlayer("current"))}
                  onMergeAll={() => requirePro("Merge frames", mergeAllTimelineFrames)}
                  onUndoFrameAction={undoLastFrameAction}
                  canUndoFrameAction={frameActionUndoStackRef.current.length > 0}
                  onReorderFrames={reorderTimelineFrames}
              />}

              {workspaceMode === "markdown" && (
                  <MarkdownViewer
                      open
                      title={markdownViewer.title}
                      content={markdownViewer.content}
                      onChange={(content) => setMarkdownViewer((prev) => ({ ...prev, content }))}
                      onTitleChange={(title) => setMarkdownViewer((prev) => ({ ...prev, title }))}
                      onClose={() => { setMarkdownViewer((prev) => ({ ...prev, open: false })); setWorkspaceMode("canvas"); }}
                  />
              )}

              {workspaceMode === "excel" && (
                  <SpreadsheetWorkspace onClose={() => setWorkspaceMode("canvas")} />
              )}

              {focusMode && (
                  <button
                      type="button"
                      className="focus-mode-exit"
                      onClick={exitFocusMode}
                      title="Exit focus mode (Esc)"
                  >
                    Exit focus mode
                  </button>
              )}

              {proUser && <FramesPanel
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
                  onReorderFrames={reorderTimelineFrames}
                  onUpdateFrame={updateTimelineFrameMeta}
                  onUpdateFrameElementAnimation={updateFrameElementAnimation}
                  onUpdateFrameAudio={updateFrameAudio}
                  onRemoveFrameAudio={removeFrameAudio}
                  onUndoFrameAction={undoLastFrameAction}
                  canUndoFrameAction={frameActionUndoStackRef.current.length > 0}
                  onPlayCurrent={() => openAnimationPlayer("current")}
                  onPlayAll={() => openAnimationPlayer("all")}
                  playbackSpeed={animationPlayerSpeed}
                  onPlaybackSpeedChange={updateTimelinePlaybackSpeed}
                  exportResolution={animationExportResolution}
                  onExportResolutionChange={updateAnimationExportResolution}
                  exportZoomPercent={animationExportZoomPercent}
                  onExportZoomPercentChange={updateAnimationExportZoomPercent}
                  onToggleElementHidden={toggleFrameElementHidden}
                  onMoveFrameElementOrder={moveFrameElementOrder}
                  onApplyFrameObjectOrderTiming={applyFrameObjectOrderTiming}
                  onUpdateFrameElementAnimation={updateFrameElementAnimation}
                  onPreviewTimeChange={(timeMs) => { setFrameAnimationPlaying(false); setFrameAnimationTimeMs(Math.max(0, Number(timeMs) || 0)); }}
                  onMergeFrameWithNext={mergeFrameWithNextAt}
                  onMergeAllFrames={mergeAllTimelineFrames}
              />}


              {proUser && <FramePlayerScreen
                  open={animationPlayerOpen}
                  frame={animationPlayerFrame}
                  exportFrames={timelineFrames}
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
                  onPlaybackSpeedChange={updateTimelinePlaybackSpeed}
                  exportResolution={animationExportResolution}
                  onExportResolutionChange={updateAnimationExportResolution}
                  exportZoomPercent={animationExportZoomPercent}
                  onExportZoomPercentChange={updateAnimationExportZoomPercent}
                  exportFitContent={animationExportFitContent}
                  onExportFitContentChange={updateAnimationExportFitContent}
                  exportCameraPan={animationExportPan}
                  onExportCameraPanChange={updateAnimationExportPan}
                  exportTextScalePercent={animationExportTextScalePercent}
                  onExportTextScalePercentChange={updateAnimationExportTextScalePercent}
                  onClose={closeAnimationPlayer}
                  onRestart={restartAnimationPlayerFrame}
                  onRestartAll={restartAllAnimationPlayerFrames}
                  onNext={advanceAnimationPlayerFrame}
                  onAdvanceModeChange={setFrameAdvanceMode}
                  onExportGIF={exportGif}
                  onExportVideo={exportVideoFromPlayer}
                  gifExporting={gifExporting}
                  gifExportProgress={gifExportProgress}
                  audioDataUrl={animationPlayerFrame?.audioDataUrl || ""}
                  audioName={animationPlayerFrame?.audioName || ""}
              />}
            </div>

          </div>
        </div>
      </>
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
  const rawPath = window.location.pathname || "/";
  const path = rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;

  if (SEO_PAGES[path]) {
    return <SeoLandingPage page={SEO_PAGES[path]} path={path} />;
  }

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
