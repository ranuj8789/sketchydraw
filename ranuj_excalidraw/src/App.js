import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

import Toolbar from "./components/Toolbar/Toolbar";
import Sidebar from "./components/Sidebar/Sidebar";
import CanvasBoard from "./components/CanvasBoard/CanvasBoard";
import { verifyEmail, resetPassword } from "./api/authApi";
import {
  TermsPage,
  PrivacyPolicyPage,
  RefundPolicyPage,
  CancellationPolicyPage,
  DeliveryPolicyPage,
  ContactUsPage,
} from "./components/LegalPages/LegalPages";
import { useSketchyBoardActions } from "./hooks/useSketchyBoardActions";

const COLORS = ["#111827", "#ef4444", "#2563eb", "#16a34a", "#ca8a04", "#9333ea"];

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
          setStatus(data?.message || "Email verified successfully. You can now login.");
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

function SketchyDrawPage() {
  const [showGrid, setShowGrid] = useState(true);
  const [tool, setTool] = useState("select");
  const [stroke, setStroke] = useState("#111827");
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 700 });

  const [viewport, setViewport] = useState({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const commitHistory = (nextElements) => {
    const snapshot = JSON.parse(JSON.stringify(nextElements));
    const trimmed = history.slice(0, historyIndex + 1);
    trimmed.push(snapshot);
    setHistory(trimmed);
    setHistoryIndex(trimmed.length - 1);
  };

  const {
    canvasRef,
    jsonInputRef,
    exportPNG,
    importDrawingJson,
    openJsonPicker,
  } = useSketchyBoardActions({
    setElements,
    setSelectedIds,
    setViewport,
    setCanvasSize,
    commitHistory,
  });

  const selectedElements = useMemo(
      () => elements.filter((el) => selectedIds.includes(el.id)),
      [elements, selectedIds]
  );

  const selectedElement =
      selectedElements.length === 1 ? selectedElements[0] : null;

  const updateSelectedElementStyle = (patch) => {
    if (!selectedElement) return;

    const next = elements.map((el) =>
        el.id === selectedElement.id
            ? {
              ...el,
              ...patch,
            }
            : el
    );

    setElements(next);
    commitHistory(next);
  };

  const undo = () => {
    if (historyIndex === 0) return;

    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setElements(JSON.parse(JSON.stringify(history[nextIndex])));
    setSelectedIds([]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;

    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setElements(JSON.parse(JSON.stringify(history[nextIndex])));
    setSelectedIds([]);
  };

  const changeSelectedColor = (color) => {
    setStroke(color);

    if (selectedIds.length === 0) return;

    const next = elements.map((el) =>
        selectedIds.includes(el.id)
            ? { ...el, stroke: color }
            : el
    );

    setElements(next);
    commitHistory(next);
  };

  const clearCanvas = () => {
    setElements([]);
    setSelectedIds([]);
    commitHistory([]);
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
    if (selectedElement.type !== "line" && selectedElement.type !== "arrow") return;

    const next = elements.map((el) => {
      if (el.id !== selectedElement.id) return el;

      const isCurved = el.lineStyle === "curved";

      if (isCurved) {
        const points = el.points || [];
        const first = points[0] || { x: el.x1, y: el.y1 };
        const last = points[points.length - 1] || { x: el.x2, y: el.y2 };

        return {
          ...el,
          lineStyle: "straight",
          x1: first.x,
          y1: first.y,
          x2: last.x,
          y2: last.y,
          points: undefined,
        };
      }

      const start = { x: el.x1, y: el.y1 };
      const end = { x: el.x2, y: el.y2 };
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2 - 60;

      return {
        ...el,
        lineStyle: "curved",
        points: [start, { x: midX, y: midY }, end],
      };
    });

    setElements(next);
    commitHistory(next);
  };

  return (
      <div className="app-shell">
        <div className="layout">
          <Sidebar
              tool={tool}
              setTool={setTool}
              stroke={stroke}
              setStroke={changeSelectedColor}
              colors={COLORS}
              selectedElement={selectedElement}
              deleteSelected={deleteSelected}
              toggleSelectedLineCurve={toggleSelectedLineCurve}
              updateSelectedElementStyle={updateSelectedElementStyle}
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
                onExport={exportPNG}
                openJsonPicker={openJsonPicker}
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

      setStatus(data?.message || "Password reset successfully. You can now login.");
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