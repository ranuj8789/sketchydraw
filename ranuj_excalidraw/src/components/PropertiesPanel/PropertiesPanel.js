import React, { useEffect, useState } from "react";
import {
    FONT_FAMILY_OPTIONS,
    FONT_SIZE_OPTIONS,
    getLineHeightForFontSize,
} from "../../canvas/textStyle";
import "./PropertiesPanel.css";
import { isSystemDesignType } from "../../canvas/canvasConstants";

const LINE_WIDTHS = [1, 2, 3, 4, 6, 8];

const CORNER_RADIUS_OPTIONS = [0, 6, 10, 14, 20, 28];

const CANVAS_RADIUS_OPTIONS = [0, 8, 16, 24, 32];

const CANVAS_PATTERNS = [
    { label: "Blank", value: "blank" },
    { label: "Grid", value: "grid" },
    { label: "Notebook", value: "notebook" },
    { label: "Dots", value: "dots" },
    { label: "Blocks", value: "blocks" },
];

const DASH_OPTIONS = [
    { label: "Solid", value: "solid" },
    { label: "Dashed", value: "dashed" },
    { label: "Dotted", value: "dotted" },
];

const ARROW_OPTIONS = [
    { label: "None", value: "none" },
    { label: "End", value: "end" },
    { label: "Start", value: "start" },
    { label: "Both", value: "both" },
];

const BASE_ANIMATION_OPTIONS = [
    { label: "None", value: "none" },
    { label: "Fade in", value: "fadeIn" },
    { label: "Slide up", value: "slideUp" },
    { label: "Scale in", value: "scaleIn" },
];

const TEXT_ONLY_ANIMATION_OPTIONS = [
    { label: "Typewriter", value: "typewriter" },
];

const DRAW_ANIMATION_OPTIONS = [
    { label: "Draw", value: "draw" },
];

const ANIMATION_SPEED_OPTIONS = [
    { label: "Fast", durationMs: 600 },
    { label: "Normal", durationMs: 1000 },
    { label: "Slow", durationMs: 1600 },
    { label: "Very slow", durationMs: 2400 },
];

const ANIMATION_DELAY_OPTIONS = [
    { label: "No delay", delayMs: 0 },
    { label: "0.3s", delayMs: 300 },
    { label: "0.5s", delayMs: 500 },
    { label: "1s", delayMs: 1000 },
    { label: "1.5s", delayMs: 1500 },
];

function getSupportedAnimationOptions(element) {
    if (!element) return BASE_ANIMATION_OPTIONS;

    const options = [...BASE_ANIMATION_OPTIONS];

    if (element.type === "text") {
        options.push(...TEXT_ONLY_ANIMATION_OPTIONS);
    }

    if (
        element.type === "line" ||
        element.type === "arrow" ||
        element.type === "pencil"
    ) {
        options.push(...DRAW_ANIMATION_OPTIONS);
    }

    return options;
}

function getAnimation(element) {
    return {
        type: element?.animation?.type || "none",
        durationMs: Number(element?.animation?.durationMs) || 1000,
        delayMs: Number(element?.animation?.delayMs) || 0,
    };
}

function getArrowValue(element) {
    const start = !!element?.arrowStart;
    const end =
        element?.type === "arrow"
            ? element.arrowEnd !== false
            : !!element?.arrowEnd;

    if (start && end) return "both";
    if (start) return "start";
    if (end) return "end";
    return "none";
}

function arrowPatch(value) {
    if (value === "both") {
        return {
            arrowStart: true,
            arrowEnd: true,
        };
    }

    if (value === "start") {
        return {
            arrowStart: true,
            arrowEnd: false,
        };
    }

    if (value === "end") {
        return {
            arrowStart: false,
            arrowEnd: true,
        };
    }

    return {
        arrowStart: false,
        arrowEnd: false,
    };
}

function cleanFontName(fontFamily) {
    return String(fontFamily || "")
        .split(",")[0]
        .replace(/['"]/g, "")
        .trim();
}

function toFontFamily(fontName) {
    const clean = cleanFontName(fontName);

    if (!clean) {
        return '"Caveat", cursive';
    }

    return `"${clean}", cursive`;
}

function loadGoogleFont(fontName) {
    if (typeof document === "undefined") return;

    const clean = cleanFontName(fontName);

    if (!clean) return;

    const id = `google-font-${clean.replace(/\s+/g, "-").toLowerCase()}`;

    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${clean.replace(
        /\s+/g,
        "+"
    )}&display=swap`;

    document.head.appendChild(link);
}

export default function PropertiesPanel({
                                            selectedElement,
                                            colors,
                                            updateSelectedElementStyle,
                                            deleteSelected,
                                            toggleSelectedLineCurve,

                                            canvasProps = {},
                                            updateCanvasProps,
                                            frames = [],
                                            currentFrameIndex = 0,
                                        }) {
    const isText = selectedElement?.type === "text";

    const [customFontFamily, setCustomFontFamily] = useState("Caveat");
    const [customFontSize, setCustomFontSize] = useState(
        String(FONT_SIZE_OPTIONS.M.fontSize)
    );
    const [activeInspectorTab, setActiveInspectorTab] = useState("properties");

    useEffect(() => {
        if (!selectedElement && activeInspectorTab === "animation") {
            setActiveInspectorTab("properties");
        }
    }, [selectedElement, activeInspectorTab]);

    useEffect(() => {
        if (!isText) return;

        const fontName = cleanFontName(
            selectedElement?.fontFamily || '"Caveat", cursive'
        );

        setCustomFontFamily(fontName || "Caveat");
        setCustomFontSize(
            String(selectedElement?.fontSize || FONT_SIZE_OPTIONS.M.fontSize)
        );

        loadGoogleFont(fontName || "Caveat");
    }, [isText, selectedElement?.id]);

    const isLineLike =
        selectedElement?.type === "line" ||
        selectedElement?.type === "arrow" ||
        selectedElement?.type === "pencil";

    const isShape =
        selectedElement?.type === "rect" ||
        selectedElement?.type === "rectangle" ||
        selectedElement?.type === "ellipse" ||
        selectedElement?.type === "diamond" ||
        isSystemDesignType(selectedElement?.type);

    const supportsCornerRadius =
        selectedElement?.type === "rect" ||
        selectedElement?.type === "rectangle";

    const isCurved = selectedElement?.lineStyle === "curved";

    const animation = getAnimation(selectedElement);
    const supportedAnimationOptions = getSupportedAnimationOptions(selectedElement);
    const currentFrame = frames[currentFrameIndex] || frames[0] || null;
    const frameElements = currentFrame?.elements || [];
    const dependencyCandidates = frameElements.filter((item) => item?.id && item.id !== selectedElement?.id);

    const getObjectLabel = (item, index) => {
        if (!item) return `Object ${index + 1}`;
        if (item.type === "text") {
            const text = String(item.text || "Text").replace(/\s+/g, " ").trim();
            return text ? `Text: ${text.slice(0, 28)}` : "Text";
        }
        if (item.type === "image") return item.fileName ? `Image: ${item.fileName}` : "Image";
        return `${item.type || "Object"} ${index + 1}`;
    };

    const canvasBackgroundColor = canvasProps.backgroundColor || "#ffffff";
    const canvasPattern = canvasProps.pattern || "blank";
    const canvasCornerRadius = canvasProps.cornerRadius ?? 16;

    return (
        <div className="properties-panel">
            <div className="properties-header">
                <div>
                    <h3>Properties</h3>
                    <p>
                        {selectedElement
                            ? `Selected: ${selectedElement.type}`
                            : "Canvas settings"}
                    </p>
                </div>
            </div>

            <div className="properties-mode-tabs" role="tablist" aria-label="Inspector mode">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeInspectorTab === "properties"}
                    className={activeInspectorTab === "properties" ? "active" : ""}
                    onClick={() => setActiveInspectorTab("properties")}
                >
                    Properties
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeInspectorTab === "animation"}
                    className={activeInspectorTab === "animation" ? "active" : ""}
                    onClick={() => selectedElement && setActiveInspectorTab("animation")}
                    disabled={!selectedElement}
                    title={!selectedElement ? "Select an object to animate it" : "Object animation settings"}
                >
                    Animation
                </button>
            </div>

            {activeInspectorTab === "properties" && (
                <div className="properties-tab-content">

                    {!selectedElement && (
                        <>
                            <div className="property-section">
                                <label>Canvas color</label>

                                <div className="custom-color-row">
                                    <input
                                        type="color"
                                        value={canvasBackgroundColor}
                                        onChange={(e) =>
                                            updateCanvasProps?.({
                                                backgroundColor: e.target.value,
                                            })
                                        }
                                    />

                                    <input
                                        type="text"
                                        value={canvasBackgroundColor}
                                        onChange={(e) =>
                                            updateCanvasProps?.({
                                                backgroundColor: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                            </div>

                            <div className="property-section">
                                <label>Canvas pattern</label>

                                <div className="segmented-row">
                                    {CANVAS_PATTERNS.map((item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            className={canvasPattern === item.value ? "active" : ""}
                                            onClick={() =>
                                                updateCanvasProps?.({
                                                    pattern: item.value,
                                                })
                                            }
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="property-section">
                                <label>Canvas round corner</label>

                                <div className="segmented-row">
                                    {CANVAS_RADIUS_OPTIONS.map((radius) => (
                                        <button
                                            key={radius}
                                            type="button"
                                            className={canvasCornerRadius === radius ? "active" : ""}
                                            onClick={() =>
                                                updateCanvasProps?.({
                                                    cornerRadius: radius,
                                                })
                                            }
                                        >
                                            {radius === 0 ? "Sharp" : radius}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="property-section">
                                <label>Quick canvas colors</label>

                                <div className="property-color-row">
                                    {[
                                        "#ffffff",
                                        "#f8fafc",
                                        "#fff7ed",
                                        "#fefce8",
                                        "#ecfeff",
                                        "#f0fdf4",
                                        "#fdf2f8",
                                        "#111827",
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`property-color ${
                                                canvasBackgroundColor === color ? "selected" : ""
                                            }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() =>
                                                updateCanvasProps?.({
                                                    backgroundColor: color,
                                                })
                                            }
                                            aria-label={`Set canvas color ${color}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {selectedElement && (
                        <>
                            <div className="property-section">
                                <label>{isText ? "Text color" : "Stroke color"}</label>

                                <div className="custom-color-row">
                                    <input
                                        type="color"
                                        value={selectedElement.stroke || "#111827"}
                                        onChange={(e) =>
                                            updateSelectedElementStyle?.({
                                                stroke: e.target.value,
                                            })
                                        }
                                    />

                                    <input
                                        type="text"
                                        value={selectedElement.stroke || "#111827"}
                                        onChange={(e) =>
                                            updateSelectedElementStyle?.({
                                                stroke: e.target.value,
                                            })
                                        }
                                    />
                                </div>

                                <div className="property-color-row property-color-row-spaced">
                                    {colors.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`property-color ${
                                                selectedElement.stroke === color ? "selected" : ""
                                            }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() =>
                                                updateSelectedElementStyle?.({
                                                    stroke: color,
                                                })
                                            }
                                            aria-label={`Set color ${color}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            {isShape && (
                                <div className="property-section">
                                    <label>Fill color</label>

                                    <div className="custom-color-row">
                                        <input
                                            type="color"
                                            value={
                                                selectedElement.fill &&
                                                selectedElement.fill !== "transparent"
                                                    ? selectedElement.fill
                                                    : "#ffffff"
                                            }
                                            onChange={(e) =>
                                                updateSelectedElementStyle?.({
                                                    fill: e.target.value,
                                                })
                                            }
                                        />

                                        <button
                                            type="button"
                                            className="mini-action-btn"
                                            onClick={() =>
                                                updateSelectedElementStyle?.({
                                                    fill: "transparent",
                                                })
                                            }
                                        >
                                            Transparent
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(isLineLike || isShape) && (
                                <>
                                    <div className="property-section">
                                        <label>Line width</label>

                                        <div className="segmented-row">
                                            {LINE_WIDTHS.map((width) => (
                                                <button
                                                    key={width}
                                                    type="button"
                                                    className={
                                                        (selectedElement.strokeWidth || 2) === width
                                                            ? "active"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        updateSelectedElementStyle?.({
                                                            strokeWidth: width,
                                                        })
                                                    }
                                                >
                                                    {width}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="property-section">
                                        <label>Dash</label>

                                        <div className="segmented-row">
                                            {DASH_OPTIONS.map((item) => (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    className={
                                                        (selectedElement.strokeDash || "solid") === item.value
                                                            ? "active"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        updateSelectedElementStyle?.({
                                                            strokeDash: item.value,
                                                        })
                                                    }
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {supportsCornerRadius && (
                                <div className="property-section">
                                    <label>Round corner</label>

                                    <div className="segmented-row">
                                        {CORNER_RADIUS_OPTIONS.map((radius) => (
                                            <button
                                                key={radius}
                                                type="button"
                                                className={
                                                    (selectedElement.cornerRadius ?? 0) === radius
                                                        ? "active"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    updateSelectedElementStyle?.({
                                                        cornerRadius: radius,
                                                    })
                                                }
                                            >
                                                {radius === 0 ? "Sharp" : radius}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(selectedElement.type === "line" ||
                                selectedElement.type === "arrow") && (
                                <>
                                    <div className="property-section">
                                        <label>Arrow type</label>

                                        <div className="segmented-row">
                                            {ARROW_OPTIONS.map((item) => (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    className={
                                                        getArrowValue(selectedElement) === item.value
                                                            ? "active"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        updateSelectedElementStyle?.(
                                                            arrowPatch(item.value)
                                                        )
                                                    }
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="property-section">
                                        <label>Line style</label>

                                        <div className="segmented-row">
                                            <button
                                                type="button"
                                                className={!isCurved ? "active" : ""}
                                                onClick={() => {
                                                    if (isCurved) {
                                                        toggleSelectedLineCurve?.();
                                                    }
                                                }}
                                            >
                                                Straight
                                            </button>

                                            <button
                                                type="button"
                                                className={isCurved ? "active" : ""}
                                                onClick={() => {
                                                    if (!isCurved) {
                                                        toggleSelectedLineCurve?.();
                                                    }
                                                }}
                                            >
                                                Curved
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {isText && (
                                <>
                                    <div className="property-section">
                                        <label>Text style</label>

                                        <div className="segmented-row">
                                            <button
                                                type="button"
                                                className={selectedElement.bold ? "active" : ""}
                                                onClick={() =>
                                                    updateSelectedElementStyle?.({
                                                        bold: !selectedElement.bold,
                                                    })
                                                }
                                            >
                                                Bold
                                            </button>

                                            <button
                                                type="button"
                                                className={selectedElement.italic ? "active" : ""}
                                                onClick={() =>
                                                    updateSelectedElementStyle?.({
                                                        italic: !selectedElement.italic,
                                                    })
                                                }
                                            >
                                                Italic
                                            </button>

                                            <button
                                                type="button"
                                                className={selectedElement.underline ? "active" : ""}
                                                onClick={() =>
                                                    updateSelectedElementStyle?.({
                                                        underline: !selectedElement.underline,
                                                    })
                                                }
                                            >
                                                Underline
                                            </button>
                                        </div>
                                    </div>

                                    <div className="property-section">
                                        <label>Font</label>

                                        <select
                                            value={
                                                FONT_FAMILY_OPTIONS.some(
                                                    (font) => font.value === selectedElement.fontFamily
                                                )
                                                    ? selectedElement.fontFamily
                                                    : "__CUSTOM__"
                                            }
                                            onChange={(e) => {
                                                const value = e.target.value;

                                                if (value === "__CUSTOM__") {
                                                    return;
                                                }

                                                const fontName = cleanFontName(value);
                                                setCustomFontFamily(fontName);
                                                loadGoogleFont(fontName);

                                                updateSelectedElementStyle?.({
                                                    fontFamily: value,
                                                });
                                            }}
                                        >
                                            {FONT_FAMILY_OPTIONS.map((font) => (
                                                <option key={font.id} value={font.value}>
                                                    {font.label}
                                                </option>
                                            ))}

                                            <option value="__CUSTOM__">Custom Font</option>
                                        </select>

                                        <input
                                            className="custom-font-input"
                                            type="text"
                                            value={customFontFamily}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setCustomFontFamily(value);

                                                if (!value.trim()) return;

                                                loadGoogleFont(value);

                                                updateSelectedElementStyle?.({
                                                    fontFamily: toFontFamily(value),
                                                });
                                            }}
                                            placeholder="Custom Google font, e.g. Caveat"
                                        />
                                    </div>

                                    <div className="property-section">
                                        <label>Size</label>

                                        <div className="segmented-row">
                                            {Object.entries(FONT_SIZE_OPTIONS).map(
                                                ([key, option]) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        className={
                                                            selectedElement.fontSize === option.fontSize
                                                                ? "active"
                                                                : ""
                                                        }
                                                        onClick={() => {
                                                            setCustomFontSize(String(option.fontSize));

                                                            updateSelectedElementStyle?.({
                                                                fontSize: option.fontSize,
                                                                lineHeight: option.lineHeight,
                                                            });
                                                        }}
                                                    >
                                                        {option.label}
                                                    </button>
                                                )
                                            )}
                                        </div>

                                        <div className="custom-font-size-row">
                                            <span>Custom</span>

                                            <input
                                                type="number"
                                                min="8"
                                                max="120"
                                                step="1"
                                                value={customFontSize}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setCustomFontSize(value);

                                                    if (value === "") return;

                                                    const parsed = Number(value);

                                                    if (!Number.isFinite(parsed)) return;

                                                    const fontSize = Math.min(
                                                        120,
                                                        Math.max(8, parsed)
                                                    );

                                                    updateSelectedElementStyle?.({
                                                        fontSize,
                                                        lineHeight: getLineHeightForFontSize(fontSize),
                                                    });
                                                }}
                                                onBlur={() => {
                                                    if (customFontSize === "") {
                                                        const fallback = FONT_SIZE_OPTIONS.M.fontSize;
                                                        setCustomFontSize(String(fallback));

                                                        updateSelectedElementStyle?.({
                                                            fontSize: fallback,
                                                            lineHeight: getLineHeightForFontSize(fallback),
                                                        });
                                                    }
                                                }}
                                            />

                                            <em>px</em>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                </div>
            )}

            {activeInspectorTab === "animation" && selectedElement && (
                <div className="animation-inspector">
                    <section className="animation-card animation-card-hero">
                        <div className="animation-section-heading">
                            <div>
                                <span className="animation-eyebrow">Frame {currentFrameIndex + 1} · selected object</span>
                                <label>Animation & timing</label>
                                <small>Choose when this object appears, what it follows, and when it hides.</small>
                            </div>
                            <strong>{(animation.delayMs / 1000).toFixed(2)}s → {((animation.delayMs + animation.durationMs) / 1000).toFixed(2)}s</strong>
                        </div>

                        <label className="animation-field wide">
                            <span>Entrance animation</span>
                            <select
                                value={animation.type}
                                onChange={(event) => updateSelectedElementStyle?.({ animation: { ...animation, type: event.target.value } })}
                            >
                                {supportedAnimationOptions.map((item) => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                            </select>
                        </label>
                    </section>

                    <section className="animation-card">
                        <div className="animation-card-title">
                            <strong>When should it start?</strong>
                            <span>Use an exact time or make it follow another object.</span>
                        </div>

                        <label className="animation-field wide">
                            <span>Start rule</span>
                            <select
                                value={animation.dependencyMode || "absolute"}
                                onChange={(event) => {
                                    const dependencyMode = event.target.value;
                                    updateSelectedElementStyle?.({
                                        animation: {
                                            ...animation,
                                            dependencyMode,
                                            ...(dependencyMode === "absolute" ? { dependsOnId: "" } : {}),
                                        },
                                    });
                                }}
                            >
                                <option value="absolute">At an exact time</option>
                                <option value="afterStart">After another object starts</option>
                                <option value="afterEnd">After another object finishes</option>
                            </select>
                        </label>

                        {(animation.dependencyMode === "afterStart" || animation.dependencyMode === "afterEnd") && (
                            <label className="animation-field wide">
                                <span>Depends on</span>
                                <select
                                    value={animation.dependsOnId || ""}
                                    onChange={(event) => updateSelectedElementStyle?.({ animation: { ...animation, dependsOnId: event.target.value } })}
                                >
                                    <option value="">Choose an object</option>
                                    {dependencyCandidates.map((item, index) => (
                                        <option key={item.id} value={item.id}>{getObjectLabel(item, index)}</option>
                                    ))}
                                </select>
                            </label>
                        )}

                        <div className="animation-settings-grid">
                            <label className="animation-field">
                                <span>{animation.dependencyMode && animation.dependencyMode !== "absolute" ? "Pause after dependency" : "Start at"}</span>
                                <div className="animation-number-input">
                                    <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={animation.dependencyMode && animation.dependencyMode !== "absolute" ? (animation.dependencyOffsetMs || 0) : (animation.delayMs || 0)}
                                        onChange={(event) => {
                                            const value = Math.max(0, Number(event.target.value) || 0);
                                            const patch = animation.dependencyMode && animation.dependencyMode !== "absolute"
                                                ? { dependencyOffsetMs: value }
                                                : { delayMs: value };
                                            updateSelectedElementStyle?.({ animation: { ...animation, ...patch } });
                                        }}
                                    />
                                    <em>ms</em>
                                </div>
                            </label>

                            <label className="animation-field">
                                <span>Duration</span>
                                <div className="animation-number-input">
                                    <input
                                        type="number"
                                        min="50"
                                        step="50"
                                        value={animation.durationMs}
                                        onChange={(event) => updateSelectedElementStyle?.({ animation: { ...animation, durationMs: Math.max(50, Number(event.target.value) || 50) } })}
                                    />
                                    <em>ms</em>
                                </div>
                            </label>
                        </div>

                        <div className="animation-preset-row">
                            <button type="button" onClick={() => updateSelectedElementStyle?.({ animation: { ...animation, durationMs: 700 } })}>Fast</button>
                            <button type="button" onClick={() => updateSelectedElementStyle?.({ animation: { ...animation, durationMs: 1200 } })}>Natural</button>
                            <button type="button" onClick={() => updateSelectedElementStyle?.({ animation: { ...animation, durationMs: 2000 } })}>Explain slowly</button>
                        </div>
                    </section>

                    <section className="animation-card">
                        <div className="animation-card-title">
                            <strong>Visibility in this frame</strong>
                            <span>Control whether it exists before and after its animation.</span>
                        </div>
                        <div className="animation-settings-grid">
                            <label className="animation-field">
                                <span>Before its turn</span>
                                <select
                                    value={animation.beforeStart || "hidden"}
                                    onChange={(event) => updateSelectedElementStyle?.({ animation: { ...animation, beforeStart: event.target.value } })}
                                >
                                    <option value="hidden">Hidden</option>
                                    <option value="visible">Already visible</option>
                                </select>
                            </label>
                            <label className="animation-field">
                                <span>After animation</span>
                                <select
                                    value={animation.afterEnd || "visible"}
                                    onChange={(event) => updateSelectedElementStyle?.({ animation: { ...animation, afterEnd: event.target.value } })}
                                >
                                    <option value="visible">Keep visible</option>
                                    <option value="hidden">Hide it</option>
                                </select>
                            </label>
                        </div>
                        <div className="animation-help-note">
                            <strong>Recommended for explainers</strong>
                            <span>Hidden before its turn, then keep visible so the diagram builds step by step.</span>
                        </div>
                    </section>

                    <div className="animation-timing-preview">
                        <span style={{ width: `${Math.min(65, (animation.dependencyMode && animation.dependencyMode !== "absolute" ? (animation.dependencyOffsetMs || 0) : animation.delayMs) / 80)}%` }} />
                        <b style={{ width: `${Math.max(8, Math.min(80, animation.durationMs / 40))}%` }} />
                    </div>
                </div>
            )}

            {activeInspectorTab === "properties" && selectedElement && (
                <button
                    type="button"
                    className="delete-selected-btn"
                    onClick={deleteSelected}
                >
                    Delete Selected
                </button>
            )}
        </div>
    );
}