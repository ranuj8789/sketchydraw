import React, { useEffect, useMemo, useRef, useState } from "react";
import { measureTextBox } from "../canvas/textMetrics";
import {
    buildTextEditorFont,
    normalizeTextStyle,
} from "../canvas/textRenderStyle";
import { worldToScreen } from "../canvas/canvasViewport";

const INLINE_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 84, 96];
const INLINE_FONT_FAMILIES = [
    { label: "Hand", value: '"Caveat", cursive' },
    { label: "Sans", value: 'Arial, sans-serif' },
    { label: "Serif", value: 'Georgia, serif' },
    { label: "Mono", value: '"Courier New", monospace' },
    { label: "Comic", value: '"Comic Sans MS", cursive' },
];

function rangeCoversSelection(range, start, end, key, expectedValue) {
    return (
        Number(range.start) <= start &&
        Number(range.end) >= end &&
        range[key] === expectedValue
    );
}

function applyRangePatch(ranges, start, end, patch) {
    const next = [];

    (Array.isArray(ranges) ? ranges : []).forEach((range) => {
        const rangeStart = Number(range.start) || 0;
        const rangeEnd = Number(range.end) || 0;

        if (rangeEnd <= start || rangeStart >= end) {
            next.push(range);
            return;
        }

        if (rangeStart < start) {
            next.push({ ...range, end: start });
        }

        const overlapStart = Math.max(rangeStart, start);
        const overlapEnd = Math.min(rangeEnd, end);
        next.push({ ...range, ...patch, start: overlapStart, end: overlapEnd });

        if (rangeEnd > end) {
            next.push({ ...range, start: end });
        }
    });

    const hasOverlap = (Array.isArray(ranges) ? ranges : []).some(
        (range) => Number(range.start) < end && Number(range.end) > start
    );

    if (!hasOverlap) {
        next.push({ start, end, ...patch });
    }

    return next
        .filter((range) => Number(range.end) > Number(range.start))
        .sort((a, b) => Number(a.start) - Number(b.start));
}

export default function TextEditor({
                                       editor,
                                       setEditor,
                                       updateTextElement,
                                       createTextElement,
                                       viewport,
                                       onCommitStart,
                                   }) {
    const inputRef = useRef(null);
    const finishingRef = useRef(false);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const selectionRef = useRef({ start: 0, end: 0 });
    const style = normalizeTextStyle(editor || {});

    useEffect(() => {
        if (!editor || !inputRef.current) return;

        const input = inputRef.current;
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
        input.scrollTop = 0;
        input.scrollLeft = 0;
        selectionRef.current = { start: len, end: len };
        setSelection({ start: len, end: len });
    }, [editor?.id, editor?.mode]);

    useEffect(() => {
        finishingRef.current = false;
    }, [editor?.id, editor?.mode]);

    const selectionStyle = useMemo(() => {
        if (!editor || selection.end <= selection.start) return null;

        const ranges = Array.isArray(editor.richText) ? editor.richText : [];
        const base = normalizeTextStyle(editor);
        const { start, end } = selection;

        return {
            bold:
                ranges.some((range) => rangeCoversSelection(range, start, end, "bold", true)) ||
                (base.bold && !ranges.some((range) => Number(range.start) < end && Number(range.end) > start && range.bold === false)),
            italic:
                ranges.some((range) => rangeCoversSelection(range, start, end, "italic", true)) ||
                (base.italic && !ranges.some((range) => Number(range.start) < end && Number(range.end) > start && range.italic === false)),
            underline:
                ranges.some((range) => rangeCoversSelection(range, start, end, "underline", true)) ||
                (base.underline && !ranges.some((range) => Number(range.start) < end && Number(range.end) > start && range.underline === false)),
            strike: ranges.some((range) => rangeCoversSelection(range, start, end, "strike", true)),
            stroke:
                ranges.find((range) => Number(range.start) <= start && Number(range.end) >= end && range.stroke)?.stroke || base.stroke,
            fontFamily:
                ranges.find((range) => Number(range.start) <= start && Number(range.end) >= end && range.fontFamily)?.fontFamily || base.fontFamily,
            fontSize:
                ranges.find((range) =>
                    Number(range.start) <= start &&
                    Number(range.end) >= end &&
                    Number(range.fontSize) > 0
                )?.fontSize || base.fontSize,
        };
    }, [editor, selection]);

    const zoom = viewport?.zoom || 1;
    const screenPoint = worldToScreen(
        { x: editor?.x || 0, y: editor?.y || 0 },
        viewport || { zoom: 1, offsetX: 0, offsetY: 0 }
    );

    const liveBox = measureTextBox(editor?.value || " ", style);
    const editorBox = {
        w: Math.max(editor?.w || liveBox.w, liveBox.w, 40),
        h: Math.max(editor?.h || liveBox.h, liveBox.h, style.lineHeight),
    };

    const finishEditing = () => {
        if (finishingRef.current) return;
        finishingRef.current = true;
        onCommitStart?.();

        const rawValue = editor.value ?? "";
        const hasText = rawValue.trim().length > 0;
        const payload = {
            stroke: style.stroke,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            fontFamily: style.fontFamily,
            bold: style.bold,
            italic: style.italic,
            underline: style.underline,
            textAlign: style.textAlign,
            richText: editor.richText || [],
        };

        if (editor.mode === "create") {
            if (!hasText) {
                setEditor(null);
                return;
            }
            createTextElement({
                x: editor.x,
                y: editor.y,
                text: rawValue,
                parentId: editor.parentId || null,
                ...payload,
            });
        } else if (editor.mode === "edit") {
            updateTextElement(editor.id, hasText ? rawValue : "", payload);
        }

        setEditor(null);
    };

    const updateSelection = () => {
        const input = inputRef.current;
        if (!input) return;
        const nextSelection = {
            start: input.selectionStart ?? 0,
            end: input.selectionEnd ?? 0,
        };
        selectionRef.current = nextSelection;
        setSelection(nextSelection);
    };

    const restoreSelection = (start, end) => {
        requestAnimationFrame(() => {
            const input = inputRef.current;
            if (!input) return;
            input.focus();
            input.setSelectionRange(start, end);
            selectionRef.current = { start, end };
            setSelection({ start, end });
        });
    };

    const applyInlinePatch = (patch) => {
        const input = inputRef.current;
        if (!input) return;

        const savedSelection = selectionRef.current;
        const liveStart = input.selectionStart ?? savedSelection.start;
        const liveEnd = input.selectionEnd ?? savedSelection.end;
        const hasLiveSelection = liveEnd > liveStart;
        const start = hasLiveSelection ? liveStart : savedSelection.start;
        const end = hasLiveSelection ? liveEnd : savedSelection.end;
        if (end <= start) return;

        setEditor((prev) => ({
            ...prev,
            richText: applyRangePatch(prev.richText, start, end, patch),
        }));
        restoreSelection(start, end);
    };

    const toggleInlineStyle = (key) => {
        const active = !!selectionStyle?.[key];
        applyInlinePatch({ [key]: !active });
    };


    const selectionVisible = selection.end > selection.start;

    if (!editor) return null;

    const onKeyDown = (e) => {
        e.stopPropagation();

        if (e.key === "Escape") {
            setEditor(null);
            return;
        }

        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            finishEditing();
        }
    };

    return (
        <>
            {selectionVisible && (
                <div
                    className="canvas-rich-text-toolbar"
                    style={{
                        position: "absolute",
                        left: `${screenPoint.x}px`,
                        top: `${Math.max(8, screenPoint.y - 48)}px`,
                        zIndex: 82,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "5px 6px",
                        border: "1px solid rgba(15, 23, 42, 0.14)",
                        borderRadius: 8,
                        background: "#ffffff",
                        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)",
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <select
                        aria-label="Selected text size"
                        title="Font size"
                        value={Number(selectionStyle?.fontSize || style.fontSize)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => applyInlinePatch({ fontSize: Number(e.target.value) })}
                        style={{
                            height: 28,
                            minWidth: 56,
                            border: "1px solid #d7dce5",
                            borderRadius: 5,
                            background: "#fff",
                            padding: "0 5px",
                            fontSize: 12,
                        }}
                    >
                        {INLINE_FONT_SIZES.map((size) => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>

                    <select
                        aria-label="Selected text font"
                        title="Font family"
                        value={selectionStyle?.fontFamily || style.fontFamily}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => applyInlinePatch({ fontFamily: e.target.value })}
                        style={{ height: 28, maxWidth: 92, border: "1px solid #d7dce5", borderRadius: 5, background: "#fff", fontSize: 12 }}
                    >
                        {INLINE_FONT_FAMILIES.map((font) => (
                            <option key={font.label} value={font.value}>{font.label}</option>
                        ))}
                    </select>

                    <label title="Text colour" style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid #d7dce5", overflow: "hidden", cursor: "pointer" }}>
                        <input
                            type="color"
                            aria-label="Selected text colour"
                            value={selectionStyle?.stroke || style.stroke}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => applyInlinePatch({ stroke: e.target.value })}
                            style={{ width: 36, height: 36, border: 0, padding: 0, margin: -4, cursor: "pointer" }}
                        />
                    </label>

                    {[
                        ["bold", "B", "Bold"],
                        ["italic", "I", "Italic"],
                        ["underline", "U", "Underline"],
                        ["strike", "S", "Strikethrough"],
                    ].map(([key, label, title]) => {
                        const active = !!selectionStyle?.[key];
                        return (
                            <button
                                key={key}
                                type="button"
                                title={title}
                                aria-pressed={active}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleInlineStyle(key);
                                }}
                                style={{
                                    width: 30,
                                    height: 28,
                                    border: "none",
                                    borderRadius: 5,
                                    background: active ? "#2563eb" : "transparent",
                                    color: active ? "#fff" : "#111827",
                                    cursor: "pointer",
                                    fontWeight: key === "bold" ? 800 : 600,
                                    fontStyle: key === "italic" ? "italic" : "normal",
                                    textDecoration: key === "underline" ? "underline" : key === "strike" ? "line-through" : "none",
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            )}


            <textarea
                ref={inputRef}
                className="canvas-text-editor"
                style={{
                    position: "absolute",
                    left: `${screenPoint.x}px`,
                    top: `${screenPoint.y}px`,
                    width: `${editorBox.w}px`,
                    height: `${editorBox.h}px`,
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                    minWidth: 0,
                    minHeight: 0,
                    color: "transparent",
                    zIndex: 81,
                    caretColor: style.stroke,
                    font: buildTextEditorFont(style, 1),
                    fontSize: `${style.fontSize}px`,
                    lineHeight: `${style.lineHeight}px`,
                    fontFamily: style.fontFamily,
                    fontWeight: style.bold ? 700 : 400,
                    fontStyle: style.italic ? "italic" : "normal",
                    textAlign: style.textAlign,
                    textDecoration: style.underline ? "underline" : "none",
                    padding: 0,
                    margin: 0,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    resize: "none",
                    overflow: "hidden",
                    boxSizing: "border-box",
                    whiteSpace: "pre",
                    tabSize: 4,
                    display: "block",
                    appearance: "none",
                    WebkitAppearance: "none",
                    borderRadius: 0,
                    verticalAlign: "top",
                    letterSpacing: "normal",
                    wordSpacing: "normal",
                    textTransform: "none",
                    textIndent: 0,
                    textShadow: "none",
                    fontKerning: "normal",
                    fontVariantLigatures: "normal",
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                }}
                value={editor.value}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); updateSelection(); }}
                onSelect={updateSelection}
                onKeyUp={updateSelection}
                onChange={(e) => {
                    const value = e.target.value;
                    e.target.scrollTop = 0;
                    e.target.scrollLeft = 0;
                    const nextBox = measureTextBox(value || " ", style);
                    setEditor((prev) => ({ ...prev, value, w: nextBox.w, h: nextBox.h }));
                    requestAnimationFrame(updateSelection);
                }}
                onBlur={(e) => {
                    if (e.relatedTarget?.closest?.(".canvas-rich-text-toolbar")) return;
                    finishEditing();
                }}
                onKeyDown={onKeyDown}
                rows={1}
                spellCheck={false}
            />
        </>
    );
}
