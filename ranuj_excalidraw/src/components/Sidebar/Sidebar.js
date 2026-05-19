import React from "react";
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
import PropertiesPanel from "../PropertiesPanel/PropertiesPanel";
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
    return (
        <div className="sidebar">
            <div className="sidebar-logo-box">
                <div className="sidebar-logo-text">
                    <strong>SketchyDraw</strong>
                    <span>Draw ideas fast</span>
                </div>
            </div>

            <div className="panel">
                <h3>Tools</h3>

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

            <PropertiesPanel
                selectedElement={selectedElement}
                colors={colors}
                updateSelectedElementStyle={updateSelectedElementStyle}
                deleteSelected={deleteSelected}
                toggleSelectedLineCurve={toggleSelectedLineCurve}
            />
        </div>
    );
}