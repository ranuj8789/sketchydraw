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
        dependencyMode: element?.animation?.dependencyMode || "absolute",
        dependsOnId: element?.animation?.dependsOnId || "",
        dependencyOffsetMs: Number(element?.animation?.dependencyOffsetMs) || 0,
        beforeStart: element?.animation?.beforeStart || "hidden",
        afterEnd: element?.animation?.afterEnd || "visible",
    };
}

function ObjectDiagram({ element, compact = false }) {
    const type = element?.type || "object";
    const className = `object-diagram object-diagram-${type} ${compact ? "compact" : ""}`;

    if (type === "text") {
        return <span className={className}><i /><i /><i /></span>;
    }
    if (type === "image") {
        return <span className={className}><i className="sun" /><i className="mountain" /></span>;
    }
    if (type === "ellipse") return <span className={className} />;
    if (type === "diamond") return <span className={className} />;
    if (type === "line" || type === "arrow" || type === "pencil") {
        return <span className={className}><i /></span>;
    }
    if (type === "user") {
        return <span className={className}><i className="head" /><i className="body" /></span>;
    }
    if (isSystemDesignType(type)) {
        return <span className={className}><i /><b>{String(type).slice(0, 2).toUpperCase()}</b></span>;
    }
    return <span className={className}><i /></span>;
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
    const isImage = selectedElement?.type === "image";

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

                            {isImage && (
                                <>
                                    <div className="property-section">
                                        <label>Photo adjustments</label>
                                        {[['Brightness','brightness',0,200],['Contrast','contrast',0,200],['Saturation','saturation',0,200],['Blur','blur',0,12]].map(([label,key,min,max]) => (
                                            <div className="photo-adjust-row" key={key}>
                                                <span>{label}</span>
                                                <input
                                                    type="range"
                                                    min={min}
                                                    max={max}
                                                    value={selectedElement[key] ?? (key === 'blur' ? 0 : 100)}
                                                    onChange={(event) => updateSelectedElementStyle?.({ [key]: Number(event.target.value) })}
                                                />
                                                <em>{selectedElement[key] ?? (key === 'blur' ? 0 : 100)}{key === 'blur' ? 'px' : '%'}</em>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="property-section">
                                        <label>Photo tools</label>
                                        <div className="segmented-row wrap-row">
                                            <button type="button" className={selectedElement.grayscale ? 'active' : ''} onClick={() => updateSelectedElementStyle?.({ grayscale: !selectedElement.grayscale })}>B&amp;W</button>
                                            <button type="button" className={selectedElement.sepia ? 'active' : ''} onClick={() => updateSelectedElementStyle?.({ sepia: !selectedElement.sepia })}>Sepia</button>
                                            <button type="button" onClick={() => updateSelectedElementStyle?.({ rotation: ((Number(selectedElement.rotation) || 0) + 90) % 360 })}>Rotate 90°</button>
                                            <button type="button" className={selectedElement.flipX ? 'active' : ''} onClick={() => updateSelectedElementStyle?.({ flipX: !selectedElement.flipX })}>Flip H</button>
                                            <button type="button" className={selectedElement.flipY ? 'active' : ''} onClick={() => updateSelectedElementStyle?.({ flipY: !selectedElement.flipY })}>Flip V</button>
                                            <button type="button" onClick={() => updateSelectedElementStyle?.({ brightness:100, contrast:100, saturation:100, blur:0, grayscale:false, sepia:false, rotation:0, flipX:false, flipY:false })}>Reset</button>
                                        </div>
                                    </div>
                                    <div className="property-section">
                                        <label>Opacity</label>
                                        <input type="range" min="5" max="100" value={Math.round((selectedElement.opacity ?? 1) * 100)} onChange={(event) => updateSelectedElementStyle?.({ opacity: Number(event.target.value) / 100 })} />
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
                    <section className="animation-selected-object">
                        <ObjectDiagram element={selectedElement} />
                        <div>
                            <span>Selected object</span>
                            <strong>{getObjectLabel(selectedElement, 0)}</strong>
                            <small>Only this object will be changed below.</small>
                        </div>
                    </section>

                    <div className="animation-group-label">
                        <span>1</span>
                        <div><strong>Object animation</strong><small>How this selected object enters the frame.</small></div>
                    </div>

                    <section className="animation-card animation-card-hero">
                        <div className="animation-section-heading">
                            <div>
                                <span className="animation-eyebrow">Frame {currentFrameIndex + 1}</span>
                                <label>Entrance effect</label>
                                <small>Click the object on canvas, then choose its effect here.</small>
                            </div>
                            <strong>{(animation.delayMs / 1000).toFixed(2)}s → {((animation.delayMs + animation.durationMs) / 1000).toFixed(2)}s</strong>
                        </div>

                        <div className="animation-effect-grid">
                            {supportedAnimationOptions.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={animation.type === item.value ? "active" : ""}
                                    onClick={() => updateSelectedElementStyle?.({ animation: { ...animation, type: item.value } })}
                                >
                                    <span className={`effect-preview effect-${item.value}`}><ObjectDiagram element={selectedElement} compact /></span>
                                    <b>{item.label}</b>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="animation-card">
                        <div className="animation-card-title">
                            <strong>When should this object appear?</strong>
                            <span>Start by time, or visually choose which diagram object it should follow.</span>
                        </div>

                        <div className="animation-start-rule-grid">
                            {[{value:"absolute",label:"At a time",hint:"Use the frame clock"},{value:"afterStart",label:"Start together",hint:"Follow another object"},{value:"afterEnd",label:"Start after",hint:"Wait until it finishes"}].map((rule) => (
                                <button
                                    key={rule.value}
                                    type="button"
                                    className={(animation.dependencyMode || "absolute") === rule.value ? "active" : ""}
                                    onClick={() => updateSelectedElementStyle?.({ animation: { ...animation, dependencyMode: rule.value, ...(rule.value === "absolute" ? { dependsOnId: "" } : {}) } })}
                                >
                                    <i className={`start-rule-icon ${rule.value}`} />
                                    <strong>{rule.label}</strong>
                                    <small>{rule.hint}</small>
                                </button>
                            ))}
                        </div>

                        {(animation.dependencyMode === "afterStart" || animation.dependencyMode === "afterEnd") && (
                            <div className="dependency-picker">
                                <span className="dependency-picker-title">Click the diagram object to follow</span>
                                <div className="dependency-object-grid">
                                    {dependencyCandidates.map((item, index) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={animation.dependsOnId === item.id ? "active" : ""}
                                            onClick={() => updateSelectedElementStyle?.({ animation: { ...animation, dependsOnId: item.id } })}
                                            title={getObjectLabel(item, index)}
                                        >
                                            <ObjectDiagram element={item} />
                                            <span>{getObjectLabel(item, index)}</span>
                                            {animation.dependsOnId === item.id && <b>✓</b>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="animation-settings-grid">
                            <label className="animation-field">
                                <span>{animation.dependencyMode !== "absolute" ? "Extra pause" : "Start at"}</span>
                                <div className="animation-number-input">
                                    <input type="number" min="0" step="100"
                                           value={animation.dependencyMode !== "absolute" ? animation.dependencyOffsetMs : animation.delayMs}
                                           onChange={(event) => {
                                               const value = Math.max(0, Number(event.target.value) || 0);
                                               const patch = animation.dependencyMode !== "absolute" ? { dependencyOffsetMs: value } : { delayMs: value };
                                               updateSelectedElementStyle?.({ animation: { ...animation, ...patch } });
                                           }} />
                                    <em>ms</em>
                                </div>
                            </label>
                            <label className="animation-field">
                                <span>Animation duration</span>
                                <div className="animation-number-input">
                                    <input type="number" min="50" step="50" value={animation.durationMs}
                                           onChange={(event) => updateSelectedElementStyle?.({ animation: { ...animation, durationMs: Math.max(50, Number(event.target.value) || 50) } })} />
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

                    <div className="animation-group-label frame-level">
                        <span>2</span>
                        <div><strong>Frame visibility</strong><small>Separate from animation: decide when this object is visible in this frame.</small></div>
                    </div>

                    <section className="animation-card frame-visibility-card">
                        <div className="visibility-choice-grid">
                            <button type="button" className={animation.beforeStart === "visible" && animation.afterEnd === "visible" ? "active" : ""}
                                    onClick={() => updateSelectedElementStyle?.({ animation: { ...animation, beforeStart: "visible", afterEnd: "visible" } })}>
                                <span className="visibility-diagram always"><ObjectDiagram element={selectedElement} compact /><i /><ObjectDiagram element={selectedElement} compact /></span>
                                <strong>Show all the time</strong><small>Visible before and after</small>
                            </button>
                            <button type="button" className={animation.beforeStart === "hidden" && animation.afterEnd === "visible" ? "active" : ""}
                                    onClick={() => updateSelectedElementStyle?.({ animation: { ...animation, beforeStart: "hidden", afterEnd: "visible" } })}>
                                <span className="visibility-diagram reveal"><em /><i /><ObjectDiagram element={selectedElement} compact /></span>
                                <strong>Show after its turn</strong><small>Best for step-by-step diagrams</small>
                            </button>
                            <button type="button" className={animation.beforeStart === "hidden" && animation.afterEnd === "hidden" ? "active" : ""}
                                    onClick={() => updateSelectedElementStyle?.({ animation: { ...animation, beforeStart: "hidden", afterEnd: "hidden" } })}>
                                <span className="visibility-diagram moment"><em /><ObjectDiagram element={selectedElement} compact /><em /></span>
                                <strong>Show only while animating</strong><small>Hide again when finished</small>
                            </button>
                        </div>
                    </section>

                    <div className="animation-timing-preview">
                        <span style={{ width: `${Math.min(65, (animation.dependencyMode !== "absolute" ? animation.dependencyOffsetMs : animation.delayMs) / 80)}%` }} />
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