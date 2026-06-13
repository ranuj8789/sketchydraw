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

    const tick = (now) => {
      const elapsed = now - startedAt;

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
            }, 650);
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

    if (primitiveType === "rectangle") {
      nextElement = {
        id: makeObjectId("gif_rect"),
        type: "rect",
        x: center.x - 80,
        y: center.y - 45,
        w: 160,
        h: 90,
        stroke: baseStroke,
        fill: "transparent",
        strokeWidth: 2,
        strokeDash: "solid",
        cornerRadius: Number(canvasProps?.cornerRadius) || 0,
        pageIndex,
        gifPrimitive: true,
        animation: {
          type: animationType === "none" ? "none" : animationType,
          durationMs: 1000,
          delayMs: 0,
        },
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
        animation: {
          type: animationType === "none" ? "none" : animationType,
          durationMs: 1000,
          delayMs: 0,
        },
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
                openFramesPanel={() => setFramesPanelOpen(false)}
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