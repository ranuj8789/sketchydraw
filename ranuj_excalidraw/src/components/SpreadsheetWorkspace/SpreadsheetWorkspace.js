import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SaveDrawingPopup from "../SaveDrawingPopup/SaveDrawingPopup";
import { saveLocalDrawing } from "../DrawingGroupStore/localDrawingStore";
import { upsertDrawingGroup, DEFAULT_GROUP } from "../DrawingGroupStore/drawingGroupStore";
import { getUser, isLoggedIn } from "../../utils/auth";
import { requireProAccess } from "../../utils/proAccess";
import { saveDrawing } from "../../api/drawingApi";
import "./SpreadsheetWorkspace.css";

const DEFAULT_ROWS = 30;
const DEFAULT_COLS = 12;
const cellKey = (row, col) => `${row}:${col}`;
const columnName = (index) => {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};

const normalizeSpreadsheet = (value = {}) => ({
  rows: Math.max(DEFAULT_ROWS, Number(value.rows || value.rowCount) || DEFAULT_ROWS),
  cols: Math.max(DEFAULT_COLS, Number(value.cols || value.columnCount) || DEFAULT_COLS),
  cells: value.cells && typeof value.cells === "object" ? value.cells : {},
  selected: value.selected || value.activeCell || { row: 0, col: 0 },
  fileName: value.fileName || value.title || "Untitled Excel",
  currentMeta: value.currentMeta || null,
});

export default function SpreadsheetWorkspace({ onClose, initialData, onDataChange }) {
  const initial = useMemo(() => normalizeSpreadsheet(initialData), [initialData]);
  const [rows, setRows] = useState(initial.rows);
  const [cols, setCols] = useState(initial.cols);
  const [cells, setCells] = useState(initial.cells);
  const [selected, setSelected] = useState(initial.selected);
  const [editing, setEditing] = useState(null);
  const [fileName, setFileName] = useState(initial.fileName);
  const [currentMeta, setCurrentMeta] = useState(initial.currentMeta);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [selectionAnchor, setSelectionAnchor] = useState(initial.selected);
  const [selectionEnd, setSelectionEnd] = useState(initial.selected);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRows, setFilterRows] = useState(false);
  const fileInputRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    const next = normalizeSpreadsheet(initialData);
    setRows(next.rows);
    setCols(next.cols);
    setCells(next.cells);
    setSelected(next.selected);
    setSelectionAnchor(next.selected);
    setSelectionEnd(next.selected);
    setFileName(next.fileName);
    setCurrentMeta(next.currentMeta);
    setEditing(null);
  }, [initialData]);

  useEffect(() => {
    onDataChange?.({ rows, cols, cells, selected, fileName, currentMeta });
  }, [rows, cols, cells, selected, fileName, currentMeta, onDataChange]);

  const selectedKey = cellKey(selected.row, selected.col);
  const selectedValue = cells[selectedKey] ?? "";

  const selectionBounds = useMemo(() => ({
    top: Math.min(selectionAnchor.row, selectionEnd.row),
    bottom: Math.max(selectionAnchor.row, selectionEnd.row),
    left: Math.min(selectionAnchor.col, selectionEnd.col),
    right: Math.max(selectionAnchor.col, selectionEnd.col),
  }), [selectionAnchor, selectionEnd]);

  const isCellSelected = useCallback((row, col) => (
      row >= selectionBounds.top && row <= selectionBounds.bottom &&
      col >= selectionBounds.left && col <= selectionBounds.right
  ), [selectionBounds]);

  const visibleRows = useMemo(() => {
    const allRows = Array.from({ length: rows }, (_, row) => row);
    const query = searchQuery.trim().toLowerCase();
    if (!filterRows || !query) return allRows;
    return allRows.filter((row) =>
        Array.from({ length: cols }, (_, col) => String(cells[cellKey(row, col)] ?? "").toLowerCase())
            .some((value) => value.includes(query))
    );
  }, [rows, cols, cells, searchQuery, filterRows]);

  const setCellValue = useCallback((row, col, value) => {
    setCells((previous) => {
      const next = { ...previous };
      const key = cellKey(row, col);
      if (value === "") delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const focusCell = useCallback((row, col) => {
    const next = {
      row: Math.max(0, Math.min(rows - 1, row)),
      col: Math.max(0, Math.min(cols - 1, col)),
    };
    setSelected(next);
    setSelectionAnchor(next);
    setSelectionEnd(next);
    setEditing(null);
    requestAnimationFrame(() => {
      gridRef.current?.querySelector(`[data-cell="${next.row}:${next.col}"]`)?.focus();
    });
  }, [rows, cols]);

  const selectionToText = useCallback(() => {
    const lines = [];
    for (let row = selectionBounds.top; row <= selectionBounds.bottom; row += 1) {
      const line = [];
      for (let col = selectionBounds.left; col <= selectionBounds.right; col += 1) {
        line.push(String(cells[cellKey(row, col)] ?? ""));
      }
      lines.push(line.join("\t"));
    }
    return lines.join("\n");
  }, [cells, selectionBounds]);

  const copySelection = useCallback(async (cut = false) => {
    const text = selectionToText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    if (cut) {
      setCells((previous) => {
        const next = { ...previous };
        for (let row = selectionBounds.top; row <= selectionBounds.bottom; row += 1) {
          for (let col = selectionBounds.left; col <= selectionBounds.right; col += 1) {
            delete next[cellKey(row, col)];
          }
        }
        return next;
      });
    }
  }, [selectionBounds, selectionToText]);

  const applyPastedText = useCallback((text) => {
    if (!text) return;
    const matrix = text.replace(/\r/g, "").split("\n")
        .filter((line, index, arr) => !(index === arr.length - 1 && line === ""))
        .map((line) => line.split("\t"));
    setCells((previous) => {
      const next = { ...previous };
      matrix.forEach((line, rowOffset) => line.forEach((value, colOffset) => {
        const targetRow = selected.row + rowOffset;
        const targetCol = selected.col + colOffset;
        if (targetRow < rows && targetCol < cols) {
          const key = cellKey(targetRow, targetCol);
          if (value === "") delete next[key];
          else next[key] = value;
        }
      }));
      return next;
    });
    setSelectionAnchor(selected);
    setSelectionEnd({
      row: Math.min(rows - 1, selected.row + Math.max(0, matrix.length - 1)),
      col: Math.min(cols - 1, selected.col + Math.max(0, ...matrix.map((line) => line.length - 1))),
    });
  }, [selected, rows, cols]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      applyPastedText(await navigator.clipboard.readText());
    } catch {
      // Browser may block clipboard reads; Cmd/Ctrl+V still works through the paste event.
    }
  }, [applyPastedText]);

  const clearSelection = useCallback(() => {
    setCells((previous) => {
      const next = { ...previous };
      for (let row = selectionBounds.top; row <= selectionBounds.bottom; row += 1) {
        for (let col = selectionBounds.left; col <= selectionBounds.right; col += 1) {
          delete next[cellKey(row, col)];
        }
      }
      return next;
    });
  }, [selectionBounds]);

  const handleKeyDown = (event) => {
    if (editing) return;
    const { row, col } = selected;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "c") { event.preventDefault(); copySelection(false); return; }
    if (command && event.key.toLowerCase() === "x") { event.preventDefault(); copySelection(true); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); focusCell(row - 1, col); }
    else if (event.key === "ArrowDown" || event.key === "Enter") { event.preventDefault(); focusCell(row + 1, col); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); focusCell(row, col - 1); }
    else if (event.key === "ArrowRight" || event.key === "Tab") { event.preventDefault(); focusCell(row, col + (event.shiftKey ? -1 : 1)); }
    else if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); clearSelection(); }
    else if (event.key.length === 1 && !command && !event.altKey) {
      event.preventDefault();
      setCellValue(row, col, event.key);
      setSelectionAnchor({ row, col });
      setSelectionEnd({ row, col });
      setEditing({ row, col });
    }
  };

  useEffect(() => {
    const paste = (event) => {
      if (!gridRef.current?.contains(document.activeElement)) return;
      const text = event.clipboardData?.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      applyPastedText(text);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [applyPastedText]);

  const importFile = async (file) => {
    if (!file) return;
    const extension = file.name.toLowerCase();
    let matrix = [];
    if (extension.endsWith(".csv")) {
      matrix = (await file.text()).replace(/\r/g, "").split("\n").filter(Boolean).map((line) => line.split(","));
    } else {
      if (!window.XLSX) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      matrix = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false, defval: "" });
    }
    const next = {};
    matrix.forEach((line, row) => line.forEach((value, col) => { if (value !== "") next[cellKey(row, col)] = String(value ?? ""); }));
    setCells(next);
    setRows(Math.max(DEFAULT_ROWS, matrix.length + 5));
    setCols(Math.max(DEFAULT_COLS, Math.max(0, ...matrix.map((line) => line.length)) + 3));
    setSelected({ row: 0, col: 0 });
    setSelectionAnchor({ row: 0, col: 0 });
    setSelectionEnd({ row: 0, col: 0 });
    setFileName(file.name.replace(/\.(xlsx|xls|csv)$/i, ""));
    setCurrentMeta(null);
  };

  const exportCsv = () => {
    const data = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => {
      const value = cells[cellKey(row, col)] ?? "";
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
    link.download = `${fileName || "spreadsheet"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const buildPayload = ({ title, groupName }) => ({
    version: 1,
    app: "SketchyDraw",
    documentType: "excel",
    workspaceType: "excel",
    title,
    groupName,
    workspace: groupName,
    savedAt: new Date().toISOString(),
    data: {
      documentType: "excel",
      workspaceType: "excel",
      spreadsheet: {
        rows,
        cols,
        rowCount: rows,
        columnCount: cols,
        cells,
        selected,
        activeCell: selected,
        fileName: title,
      },
    },
  });

  const handleSave = async ({ title, groupName }) => {
    if (saving) return;
    const finalTitle = String(title || fileName || "Untitled Excel").trim() || "Untitled Excel";
    const finalGroup = String(groupName || currentMeta?.groupName || DEFAULT_GROUP).trim() || DEFAULT_GROUP;
    const payload = buildPayload({ title: finalTitle, groupName: finalGroup });
    const user = getUser();

    const localRow = saveLocalDrawing({
      id: currentMeta?.id,
      title: finalTitle,
      groupName: finalGroup,
      description: "Excel spreadsheet",
      drawingJson: JSON.stringify(payload),
      userEmail: user?.email || "",
    });

    setFileName(finalTitle);
    setCurrentMeta({ id: localRow?.id || currentMeta?.id || null, title: finalTitle, groupName: finalGroup });
    upsertDrawingGroup(finalGroup);
    setSaveMessage("Saved in My Drawings.");

    if (!isLoggedIn()) {
      setTimeout(() => { setSaveOpen(false); setSaveMessage(""); }, 700);
      return;
    }

    const allowed = await requireProAccess("Save Excel");
    if (!allowed) {
      setTimeout(() => { setSaveOpen(false); setSaveMessage(""); }, 700);
      return;
    }

    setSaving(true);
    setSaveMessage("Saved locally. Syncing...");
    try {
      const serverId = currentMeta?.id && !String(currentMeta.id).startsWith("local_") ? currentMeta.id : undefined;
      const saved = await saveDrawing({
        id: serverId,
        title: finalTitle,
        groupName: finalGroup,
        workspace: finalGroup,
        description: "Excel spreadsheet",
        drawingJson: JSON.stringify(payload),
      });
      const savedId = saved?.id || saved?.drawingId || serverId || localRow?.id || null;
      setCurrentMeta({ id: savedId, title: finalTitle, groupName: finalGroup });
      saveLocalDrawing({
        id: savedId,
        title: finalTitle,
        groupName: finalGroup,
        description: "Excel spreadsheet",
        drawingJson: JSON.stringify({ ...payload, id: savedId }),
        userEmail: user?.email || "",
      });
      setSaveMessage("Excel saved successfully.");
      setTimeout(() => { setSaveOpen(false); setSaveMessage(""); }, 700);
    } catch (error) {
      console.error("Excel sync failed", error);
      setSaveMessage("Saved locally. Server sync failed.");
    } finally {
      setSaving(false);
    }
  };

  const gridTemplateColumns = useMemo(() => `52px repeat(${cols}, 180px)`, [cols]);

  return (
      <section className="sheet-workspace">
        <header className="sheet-toolbar">
          <input className="sheet-title" value={fileName} onChange={(event) => setFileName(event.target.value)} />
          <div className="sheet-actions">
            <div className="sheet-search">
              <span aria-hidden="true">⌕</span>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search data" />
              <label><input type="checkbox" checked={filterRows} onChange={(event) => setFilterRows(event.target.checked)} /> Filter rows</label>
            </div>
            <button onClick={() => copySelection(false)}>Copy</button>
            <button onClick={() => copySelection(true)}>Cut</button>
            <button onClick={pasteFromClipboard}>Paste</button>
            <button className="sheet-save-button" onClick={() => { setSaveMessage(""); setSaveOpen(true); }}>Save</button>
            <button onClick={() => fileInputRef.current?.click()}>Import Excel/CSV</button>
            <button onClick={exportCsv}>Export CSV</button>
            <button onClick={() => setRows((value) => value + 10)}>+ 10 rows</button>
            <button onClick={() => setCols((value) => value + 3)}>+ 3 columns</button>
            <button onClick={onClose}>Back to canvas</button>
          </div>
          <input ref={fileInputRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => importFile(event.target.files?.[0])} />
        </header>
        <div className="sheet-formula-bar"><strong>{columnName(selected.col)}{selected.row + 1}</strong><input value={selectedValue} onChange={(event) => setCellValue(selected.row, selected.col, event.target.value)} /><span className="sheet-selection-summary">{selectionBounds.bottom - selectionBounds.top + 1} × {selectionBounds.right - selectionBounds.left + 1}</span></div>
        <div className="sheet-scroll" ref={gridRef} onKeyDown={handleKeyDown}>
          <div className="sheet-grid" style={{ gridTemplateColumns }}>
            <div className="sheet-corner" />
            {Array.from({ length: cols }, (_, col) => <div className={`sheet-column-header ${selected.col === col ? "active" : ""}`} key={`h-${col}`}>{columnName(col)}</div>)}
            {visibleRows.map((row) => (
                <React.Fragment key={`r-${row}`}>
                  <div className={`sheet-row-header ${selected.row === row ? "active" : ""}`}>{row + 1}</div>
                  {Array.from({ length: cols }, (_, col) => {
                    const key = cellKey(row, col);
                    const active = selected.row === row && selected.col === col;
                    const inSelection = isCellSelected(row, col);
                    const matchesSearch = searchQuery.trim() && String(cells[key] ?? "").toLowerCase().includes(searchQuery.trim().toLowerCase());
                    const isEditing = editing?.row === row && editing?.col === col;
                    return <div key={key} data-cell={key} tabIndex={active ? 0 : -1} className={`sheet-cell ${inSelection ? "range-selected" : ""} ${active ? "selected" : ""} ${matchesSearch ? "search-match" : ""}`} onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      const point = { row, col };
                      setSelected(point);
                      if (event.shiftKey) setSelectionEnd(point);
                      else { setSelectionAnchor(point); setSelectionEnd(point); }
                    }} onClick={(event) => {
                      const point = { row, col };
                      setSelected(point);
                      if (event.shiftKey) setSelectionEnd(point);
                      else { setSelectionAnchor(point); setSelectionEnd(point); }
                      setEditing(null);
                    }} onMouseEnter={(event) => { if (event.buttons === 1) { const point = { row, col }; setSelected(point); setSelectionEnd(point); } }} onDoubleClick={() => { setSelected({ row, col }); setEditing({ row, col }); }}>
                      {isEditing ? <input autoFocus value={cells[key] ?? ""} onChange={(event) => setCellValue(row, col, event.target.value)} onBlur={() => setEditing(null)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); focusCell(row + 1, col); } }} /> : <span>{cells[key] ?? ""}</span>}
                    </div>;
                  })}
                </React.Fragment>
            ))}
          </div>
        </div>

        <SaveDrawingPopup
            open={saveOpen}
            onClose={() => !saving && setSaveOpen(false)}
            onSave={handleSave}
            initialValues={{ title: fileName, groupName: currentMeta?.groupName || DEFAULT_GROUP }}
            loading={saving}
            message={saveMessage}
        />
      </section>
  );
}
