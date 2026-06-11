import React, { useCallback, useMemo, useState, useEffect } from "react";
import "./App.css";

import Toolbar from "./components/Toolbar/Toolbar";
import Sidebar from "./components/Sidebar/Sidebar";
import CanvasBoard from "./components/CanvasBoard/CanvasBoard";
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
  pattern: "notebook",
  cornerRadius: 16,

  // Notebook module props
  pageMode: true,
  pageCount: 1,
  pageViewMode: "single",
  currentPageIndex: 0,
  pageWidth: 794,
  pageHeight: 1123,
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
                createNewDrawing={createNewDrawing}
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