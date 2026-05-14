import React, { useMemo, useState } from "react";
import "./App.css";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import CanvasBoard from "./components/CanvasBoard";

const COLORS = ["#111827", "#ef4444", "#2563eb", "#16a34a", "#ca8a04", "#9333ea"];

export default function App() {
  const [tool, setTool] = useState("select");
  const [stroke, setStroke] = useState("#111827");
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

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

  const commitHistory = (nextElements) => {
    const snapshot = JSON.parse(JSON.stringify(nextElements));
    const trimmed = history.slice(0, historyIndex + 1);
    trimmed.push(snapshot);
    setHistory(trimmed);
    setHistoryIndex(trimmed.length - 1);
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

  const exportPNG = (canvas) => {
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "drawing-board.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
      <div className="app-shell">
        <Toolbar
            undo={undo}
            redo={redo}
            clearCanvas={clearCanvas}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
        />

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
          />
        </div>
      </div>
  );
}