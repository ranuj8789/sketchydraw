import React from "react";
import { FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS } from "../canvas/textStyle";
import {
    Pencil,
    Square,
    Circle,
    Slash,
    MousePointer2,
    Eraser,
    Type,
    Trash2,
    MoveRight,
    Diamond,
    Spline,
} from "lucide-react";

const TOOLS = [
    { id: "select", label: "Select", icon: MousePointer2 },
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
            <div className="panel">
                <h3>Tools</h3>

                <div className="tool-grid">
                    {TOOLS.map((item) => {
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.id}
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
                            className={`color-dot ${stroke === color ? "selected" : ""}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setStroke(color)}
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
                                    {Object.entries(FONT_SIZE_OPTIONS).map(
                                        ([key, option]) => (
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
                                        )
                                    )}
                                </div>
                            </div>
                        )}

                        {isLineLike && (
                            <button onClick={toggleSelectedLineCurve}>
                                <Spline size={14} />
                                {isCurved ? "Convert to Straight" : "Convert to Curved"}
                            </button>
                        )}

                        <button onClick={deleteSelected}>
                            <Trash2 size={14} />
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