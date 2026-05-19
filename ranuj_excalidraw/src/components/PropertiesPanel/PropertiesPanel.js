import React from "react";
import { FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS } from "../../canvas/textStyle";
import "./PropertiesPanel.css";

const LINE_WIDTHS = [1, 2, 3, 4, 6, 8];

const CORNER_RADIUS_OPTIONS = [0, 6, 10, 14, 20, 28];

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

    return (
        <div className="properties-panel">
            <div className="properties-header">
                <div>
                    <h3>Properties</h3>
                    <p>
                        {selectedElement
                            ? `Selected: ${selectedElement.type}`
                            : "Select one item to edit"}
                    </p>
                </div>
            </div>

            {!selectedElement && (
                <div className="empty-properties">
                    Select text, line, arrow, pencil, or shape.
                </div>
            )}

            {selectedElement && (
                <>
                    <div className="property-section">
                        <label>Color</label>

                        <div className="property-color-row">
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
                                                    selectedElement.fontSize ===
                                                    option.fontSize
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