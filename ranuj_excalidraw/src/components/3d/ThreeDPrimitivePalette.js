import React from "react";
import { THREE_D_PRIMITIVES } from "./threeDConstants";
import "./ThreeD.css";

export default function ThreeDPrimitivePalette({ onInsert }) {
    return (
        <div className="property-section webgl-primitive-section">
            <label>3D primitives · WebGL</label>
            <div className="webgl-primitive-grid">
                {THREE_D_PRIMITIVES.map(({ value, label, group }) => (
                    <button key={value} type="button" onClick={() => onInsert?.(value)}>
                        <strong>{label}</strong>
                        <span>{group}</span>
                    </button>
                ))}
            </div>
            <small className="property-help">
                Experimental 3D objects. Kept in a separate module so they can stay out of release builds.
            </small>
        </div>
    );
}
