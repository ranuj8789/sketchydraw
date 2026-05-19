import React from "react";
import { FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS } from "../../canvas/textStyle";
import "./PropertiesPanel.css";

const LINE_WIDTHS = [1, 2, 3, 4, 6, 8];

const CORNER_RADIUS_OPTIONS = [0, 6, 10, 14, 20, 28];

const CANVAS_RADIUS_OPTIONS = [0, 8, 16, 24, 32];

const CANVAS_PATTERNS = [
    { label: "Blank", value: "blank" },
    { label: "Grid", value: "grid" },
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

export default function PropertiesPanel({
                                            selectedElement,
                                            colors,
                                            updateSelectedElementStyle,
                                            deleteSelected,
                                            toggleSelectedLineCurve,

                                            canvasProps = {},
                                            updateCanvasProps,
                                        }) {
    const isText = selectedElement?.type === "text";

    const isLineLike =
        selectedElement?.type === "line" ||
        selectedElement?.type === "arrow" ||
        selectedElement?.type === "pencil";

    const isShape =
        selectedElement?.type === "rect" ||
        selectedElement?.type === "rectangle" ||
        selectedElement?.type === "ellipse" ||
        selectedElement?.type === "diamond";

    const supportsCornerRadius =
        selectedElement?.type === "rect" ||
        selectedElement?.type === "rectangle";

    const isCurved = selectedElement?.lineStyle === "curved";

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
                                            (selectedElement.cornerRadius ?? 14) === radius
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
                                </div>
                            </div>

                            <div className="property-section">
                                <label>Font</label>

                                <select
                                    value={
                                        selectedElement.fontFamily ||
                                        FONT_FAMILY_OPTIONS[0].value
                                    }
                                    onChange={(e) =>
                                        updateSelectedElementStyle?.({
                                            fontFamily: e.target.value,
                                        })
                                    }
                                >
                                    {FONT_FAMILY_OPTIONS.map((font) => (
                                        <option key={font.id} value={font.value}>
                                            {font.label}
                                        </option>
                                    ))}
                                </select>
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
                                                onClick={() =>
                                                    updateSelectedElementStyle?.({
                                                        fontSize: option.fontSize,
                                                        lineHeight: option.lineHeight,
                                                    })
                                                }
                                            >
                                                {option.label}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <button
                        type="button"
                        className="delete-selected-btn"
                        onClick={deleteSelected}
                    >
                        Delete Selected
                    </button>
                </>
            )}
        </div>
    );
}