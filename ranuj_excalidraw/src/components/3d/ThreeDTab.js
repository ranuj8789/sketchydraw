import React from "react";
import ThreeDPrimitivePalette from "./ThreeDPrimitivePalette";
import ThreeDPropertiesSection from "./ThreeDPropertiesSection";
import { is3DElement } from "./threeDConstants";
import "./ThreeD.css";

export default function ThreeDTab({ selectedElement, onInsert, onPatch }) {
    const selected3D = is3DElement(selectedElement) ? selectedElement : null;

    return (
        <div className="left-tab-panel three-d-tab-panel">
            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>3D · Experimental</strong>
                    <span>3D primitives stay isolated from the normal release workflow.</span>
                </div>
                <ThreeDPrimitivePalette onInsert={onInsert} />
            </div>

            {selected3D ? (
                <div className="left-tool-card three-d-selected-card">
                    <div className="left-card-heading">
                        <strong>Selected 3D object</strong>
                        <span>Drag it directly on canvas. Fine tune it here.</span>
                    </div>
                    <ThreeDPropertiesSection element={selected3D} onPatch={onPatch} />
                </div>
            ) : (
                <div className="left-tool-card three-d-empty-card">
                    <div className="left-card-heading">
                        <strong>No 3D object selected</strong>
                        <span>Insert one above or select an existing 3D object on the canvas.</span>
                    </div>
                </div>
            )}
        </div>
    );
}
