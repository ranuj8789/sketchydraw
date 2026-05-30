import React, { useCallback, useMemo, useState, useEffect } from "react";
import "./App.css";

import Toolbar from "./components/Toolbar/Toolbar";
import Sidebar from "./components/Sidebar/Sidebar";
import CanvasBoard from "./components/CanvasBoard/CanvasBoard";
import FramesPanel from "./components/FramesPanel/FramesPanel";
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
import {
  saveHistoryStackAsync,
  loadHistoryStack,
  clearHistoryStackNow,
  resetVideoFramesNow,
} from "./utils/indexedDbStorage";

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
};

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

const MAX_VIDEO_STEPS = 150;

function areElementStatesEqual(a, b) {
  try {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
  } catch {
    return false;
  }
}

function getVideoStackStats(history, historyIndex, elements) {
  const safeHistory = Array.isArray(history) ? history : [];
  const safeElements = Array.isArray(elements) ? elements : [];

  const hasAnyContent =
      safeElements.length > 0 ||
      safeHistory.some((state) => Array.isArray(state) && state.length > 0);

  if (!hasAnyContent) {
    return {
      currentStep: 0,
      totalSteps: 0,
      undoCount: 0,
      redoCount: 0,
      videoFramesCount: 0,
      rawVideoFramesCount: 0,
      maxVideoSteps: MAX_VIDEO_STEPS,
      isVideoFramesCapped: false,
    };
  }

  const currentStep = Math.max(0, historyIndex + 1);
  const totalSteps = safeHistory.length;
  const undoCount = Math.max(0, historyIndex);
  const redoCount = Math.max(0, safeHistory.length - historyIndex - 1);

  const uniqueFrames = safeHistory
      .filter((state) => Array.isArray(state))
      .map(cloneElements)
      .filter((state, index, arr) => {
        if (index === 0) return true;
        return !areElementStatesEqual(state, arr[index - 1]);
      });

  const currentFrame = cloneElements(safeElements);
  const frames = uniqueFrames.length > 0 ? [...uniqueFrames] : [currentFrame];

  const lastFrame = frames[frames.length - 1] || [];
  if (!areElementStatesEqual(lastFrame, currentFrame)) {
    frames.push(currentFrame);
  }

  const rawVideoFramesCount = frames.length;
  const videoFramesCount = Math.min(MAX_VIDEO_STEPS, rawVideoFramesCount);

  return {
    currentStep,
    totalSteps,
    undoCount,
    redoCount,
    videoFramesCount,
    rawVideoFramesCount,
    maxVideoSteps: MAX_VIDEO_STEPS,
    isVideoFramesCapped: rawVideoFramesCount > MAX_VIDEO_STEPS,
  };
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
  const [historyStorageReady, setHistoryStorageReady] = useState(false);
  const [sketchyAlert, setSketchyAlert] = useState(null);
  const [framesPanelOpen, setFramesPanelOpen] = useState(false);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);

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
      const currentSnapshot = prevHistory[historyIndex];

      if (areElementStatesEqual(currentSnapshot, snapshot)) {
        return prevHistory;
      }

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

  useEffect(() => {
    let cancelled = false;

    loadHistoryStack()
        .then((record) => {
          if (cancelled) return;

          const storedHistory = Array.isArray(record?.history)
              ? record.history.filter((state) => Array.isArray(state))
              : [];

          if (!storedHistory.length) return;

          const safeIndex = Math.max(
              0,
              Math.min(
                  Number.isFinite(record?.historyIndex) ? record.historyIndex : storedHistory.length - 1,
                  storedHistory.length - 1
              )
          );

          const restoredHistory = storedHistory.map(cloneElements);
          const restoredElements = cloneElements(restoredHistory[safeIndex] || []);

          setHistory(restoredHistory);
          setHistoryIndex(safeIndex);
          setElements(restoredElements);
          setSelectedIds([]);
        })
        .finally(() => {
          if (!cancelled) {
            setHistoryStorageReady(true);
          }
        });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!historyStorageReady) return;

    saveHistoryStackAsync({
      history,
      historyIndex,
    });
  }, [historyStorageReady, history, historyIndex]);
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

  const clearCanvas = () => {
    showSketchyAlert({
      type: "confirm",
      icon: "🧹",
      title: "Clear whole canvas?",
      message: "All canvas steps/history will be cleared and the whole canvas will become empty.",
      confirmText: "Clear canvas",
      onConfirm: () => {
        clearHistoryStackNow();
        resetVideoFramesNow();
        setSlideshowPlaying(false);
        setElements([]);
        setSelectedIds([]);
        setHistory([[]]);
        setHistoryIndex(0);
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
  };

  const videoStackStats = useMemo(
      () => getVideoStackStats(history, historyIndex, elements),
      [history, historyIndex, elements]
  );

  const selectFrame = useCallback((index) => {
    const safeIndex = Math.max(0, Math.min(index, history.length - 1));
    const nextElements = cloneElements(history[safeIndex] || []);

    setHistoryIndex(safeIndex);
    setElements(nextElements);
    setSelectedIds([]);
  }, [history]);

  const deleteFrame = useCallback((index) => {
    setHistory((prevHistory) => {
      if (!Array.isArray(prevHistory) || prevHistory.length <= 1) {
        setHistoryIndex(0);
        setElements([]);
        setSelectedIds([]);
        return [[]];
      }

      const nextHistory = prevHistory.filter((_, frameIndex) => frameIndex !== index);
      const nextIndex = Math.max(0, Math.min(historyIndex >= index ? historyIndex - 1 : historyIndex, nextHistory.length - 1));
      const nextElements = cloneElements(nextHistory[nextIndex] || []);

      setHistoryIndex(nextIndex);
      setElements(nextElements);
      setSelectedIds([]);
      return nextHistory;
    });
  }, [historyIndex]);

  const addCurrentFrameAfter = useCallback((index) => {
    const snapshot = cloneElements(elements);

    setHistory((prevHistory) => {
      const safeHistory = Array.isArray(prevHistory) && prevHistory.length ? prevHistory : [[]];
      const insertIndex = Math.max(0, Math.min(index + 1, safeHistory.length));
      const nextHistory = [
        ...safeHistory.slice(0, insertIndex),
        snapshot,
        ...safeHistory.slice(insertIndex),
      ];

      const limited =
          nextHistory.length > maxHistoryLength
              ? nextHistory.slice(nextHistory.length - maxHistoryLength)
              : nextHistory;

      const nextIndex = Math.max(0, Math.min(insertIndex, limited.length - 1));

      setHistoryIndex(nextIndex);
      setElements(cloneElements(limited[nextIndex] || []));
      setSelectedIds([]);
      return limited;
    });
  }, [elements, maxHistoryLength]);

  useEffect(() => {
    if (!slideshowPlaying) return undefined;

    if (!Array.isArray(history) || history.length <= 1) {
      setSlideshowPlaying(false);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setHistoryIndex((prevIndex) => {
        const nextIndex = prevIndex >= history.length - 1 ? 0 : prevIndex + 1;
        setElements(cloneElements(history[nextIndex] || []));
        setSelectedIds([]);
        return nextIndex;
      });
    }, 850);

    return () => window.clearInterval(timer);
  }, [slideshowPlaying, history]);

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
                videoStackStats={videoStackStats}
                openFramesPanel={() => setFramesPanelOpen(true)}
            />

            <FramesPanel
                open={framesPanelOpen}
                frames={history}
                currentIndex={historyIndex}
                canvasProps={canvasProps}
                slideshowPlaying={slideshowPlaying}
                onClose={() => setFramesPanelOpen(false)}
                onSelectFrame={selectFrame}
                onDeleteFrame={deleteFrame}
                onAddFrameAfter={addCurrentFrameAfter}
                onToggleSlideshow={() => setSlideshowPlaying((value) => !value)}
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
            />
          </div>
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