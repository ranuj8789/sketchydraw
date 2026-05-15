import React from "react";
import { FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS } from "../../canvas/textStyle";
import {
    Pencil,
    Square,
    Circle,
    Slash,
    MousePointer2,
    Eraser,
    Type,
    MoveRight,
    Diamond,
    Hand,
} from "lucide-react";
import "./Sidebar.css";

const TOOLS = [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "hand", label: "Hand", icon: Hand },
    { id: "pencil", label: "Pencil", icon: Pencil },
    { id: "line", label: "Line", icon: Slash },
    { id: "arrow", label: "Arrow", icon: MoveRight },
    { id: "rect", label: "Rectangle", icon: Square },
    { id: "diamond", label: "Diamond", icon: Diamond },
    { id: "ellipse", label: "Ellipse", icon: Circle },
    { id: "text", label: "Text", icon: Type },
    { id: "eraser", label: "Eraser", icon: Eraser },
];

export default function Sidebar({
                                    tool,
                                    setTool,
                                    stroke,
                                    setStroke,
                                    colors,
                                    selectedElement,
                                    deleteSelected,
                                    toggleSelectedLineCurve,
                                    updateSelectedElementStyle,
                                }) {
    const isLineLike =
        selectedElement &&
        (selectedElement.type === "line" || selectedElement.type === "arrow");

    const isCurved = selectedElement?.lineStyle === "curved";

    const isTextSelected = selectedElement?.type === "text";

    return (
        <div className="sidebar">
            <div className="sidebar-logo-box">
                <div className="sidebar-logo-text">
                    <strong>SketchyDraw</strong>
                    <span>Draw ideas fast</span>
                </div>
            </div>

            <div className="panel">
                <h3>Sketchydraw Toolbar</h3>

                <div className="tool-grid">
                    {TOOLS.map((item) => {
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={`tool-btn ${tool === item.id ? "active" : ""}`}
                                onClick={() => setTool(item.id)}
                            >
                                <Icon size={16} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="panel">
                <h3>Stroke Color</h3>

                <div className="color-row">
                    {colors.map((color) => (
                        <button
                            key={color}
                            type="button"
                            className={`color-dot ${stroke === color ? "selected" : ""}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setStroke(color)}
                            aria-label={`Select ${color}`}
                        />
                    ))}
                </div>
            </div>

            <div className="panel">
                <h3>Selected</h3>

                {selectedElement ? (
                    <>
                        <p>Type: {selectedElement.type}</p>
                        <p>Color: {selectedElement.stroke}</p>

                        {isLineLike && (
                            <div className="text-format-panel">
                                <h4>Line Style</h4>

                                <div className="text-format-row">
                                    <button
                                        type="button"
                                        className={!isCurved ? "active" : ""}
                                        onClick={toggleSelectedLineCurve}
                                    >
                                        Straight
                                    </button>

                                    <button
                                        type="button"
                                        className={isCurved ? "active" : ""}
                                        onClick={toggleSelectedLineCurve}
                                    >
                                        Curved
                                    </button>
                                </div>
                            </div>
                        )}

                        {isTextSelected && (
                            <div className="text-format-panel">
                                <h4>Text Formatting</h4>

                                <p>Bold</p>
                                <div className="text-format-row">
                                    <button
                                        type="button"
                                        className={selectedElement.bold ? "active" : ""}
                                        onClick={() =>
                                            updateSelectedElementStyle?.({
                                                bold: !selectedElement.bold,
                                            })
                                        }
                                    >
                                        B
                                    </button>
                                </div>

                                <p>Font family</p>
                                <div className="text-format-row">
                                    {FONT_FAMILY_OPTIONS.map((font) => (
                                        <button
                                            type="button"
                                            key={font.id}
                                            title={font.label}
                                            className={
                                                selectedElement.fontFamily === font.value
                                                    ? "active"
                                                    : ""
                                            }
                                            style={{
                                                fontFamily: font.value,
                                            }}
                                            onClick={() =>
                                                updateSelectedElementStyle?.({
                                                    fontFamily: font.value,
                                                })
                                            }
                                        >
                                            A
                                        </button>
                                    ))}
                                </div>

                                <p>Font size</p>
                                <div className="text-format-row">
                                    {Object.entries(FONT_SIZE_OPTIONS).map(([key, option]) => (
                                        <button
                                            type="button"
                                            key={key}
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
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            className="delete-selected-btn"
                            onClick={deleteSelected}
                        >
                            Delete Selected
                        </button>
                    </>
                ) : (
                    <p>Nothing selected</p>
                )}
            </div>
        </div>
    );
}