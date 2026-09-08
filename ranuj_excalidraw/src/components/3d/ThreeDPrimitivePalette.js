import React from "react";
import { THREE_D_PRIMITIVES } from "./threeDConstants";
import "./ThreeD.css";

export default function ThreeDPrimitivePalette({ onInsert }) {
    const groups = THREE_D_PRIMITIVES.reduce((result, primitive) => {
        (result[primitive.group] ||= []).push(primitive);
        return result;
    }, {});

    return (
        <div className="property-section webgl-primitive-section">
            {Object.entries(groups).map(([group, primitives]) => (
                <div className="webgl-palette-group" key={group}>
                    <label>{group}</label>
                    <div className="webgl-primitive-grid">
                        {primitives.map(({ value, label }) => (
                            <button key={value} type="button" onClick={() => onInsert?.(value)}>
                                <strong>{label}</strong><span>3D</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
            <small className="property-help">
                All objects remain editable, animatable, frame-aware and exportable.
            </small>
        </div>
    );
}
