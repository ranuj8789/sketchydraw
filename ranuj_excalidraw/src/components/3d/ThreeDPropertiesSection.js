import React from "react";
import { THREE_D_PRIMITIVES } from "./threeDConstants";
import "./ThreeD.css";

function NumberField({ label, value, onChange, min, step }) {
    return (
        <label>
            <span>{label}</span>
            <input
                type="number"
                value={Number(value || 0)}
                min={min}
                step={step}
                onChange={(event) => onChange?.(Number(event.target.value) || 0)}
            />
        </label>
    );
}

export default function ThreeDPropertiesSection({ element, onPatch }) {
    if (!element) return null;

    const primitive = element.primitive3d || "box";
    const dsaPrimitive = primitive === "array3d" || primitive === "matrix3d";
    const characterPrimitive = ["boywalk3d", "boyrun3d", "girlwalk3d", "girlrun3d"].includes(primitive);

    return (
        <>
            <div className="property-section">
                <label>3D primitive</label>
                <select
                    value={primitive}
                    onChange={(event) => onPatch?.({ primitive3d: event.target.value })}
                >
                    {THREE_D_PRIMITIVES.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </div>

            <div className="property-section">
                <label>3D position</label>
                <div className="webgl-number-grid">
                    <NumberField label="X" value={element.x} onChange={(value) => onPatch?.({ x: value })} />
                    <NumberField label="Y" value={element.y} onChange={(value) => onPatch?.({ y: value })} />
                    <NumberField label="Z" value={element.z} onChange={(value) => onPatch?.({ z: value })} />
                </div>
            </div>

            <div className="property-section">
                <label>Rotation</label>
                <div className="webgl-number-grid">
                    <NumberField label="X°" value={element.rotationX} step="1" onChange={(value) => onPatch?.({ rotationX: value })} />
                    <NumberField label="Y°" value={element.rotationY} step="1" onChange={(value) => onPatch?.({ rotationY: value })} />
                    <NumberField label="Z°" value={element.rotationZ} step="1" onChange={(value) => onPatch?.({ rotationZ: value })} />
                </div>
            </div>

            <div className="property-section">
                <label>Geometry</label>
                <div className="webgl-number-grid">
                    <NumberField label="Depth" value={element.depth || 70} min="1" onChange={(value) => onPatch?.({ depth: Math.max(1, value || 1) })} />
                    <NumberField label="Scale" value={element.scale3d || 1} min="0.1" step="0.1" onChange={(value) => onPatch?.({ scale3d: Math.max(0.1, value || 1) })} />
                    <NumberField label="Gap" value={element.gap || 0} min="0" onChange={(value) => onPatch?.({ gap: Math.max(0, value || 0) })} />
                </div>
            </div>


            {characterPrimitive && (
                <div className="property-section">
                    <label>Character animation</label>
                    <div className="webgl-character-grid">
                        <label>
                            <span>Action</span>
                            <select
                                value={element.characterAction || "idle"}
                                onChange={(event) => onPatch?.({ characterAction: event.target.value })}
                            >
                                <option value="idle">Idle</option>
                                <option value="walk">Walk</option>
                                <option value="run">Run</option>
                            </select>
                        </label>
                        <NumberField
                            label="Speed"
                            value={element.characterSpeed || 1}
                            min="0.1"
                            step="0.1"
                            onChange={(value) => onPatch?.({ characterSpeed: Math.max(0.1, value || 1) })}
                        />
                    </div>
                </div>
            )}

            {dsaPrimitive && (
                <div className="property-section">
                    <label>DSA data</label>
                    <textarea
                        rows="3"
                        value={Array.isArray(element.values) ? JSON.stringify(element.values) : "[]"}
                        onChange={(event) => {
                            try {
                                onPatch?.({ values: JSON.parse(event.target.value) });
                            } catch (_) {
                                // Keep the current object unchanged while the JSON is temporarily invalid.
                            }
                        }}
                    />
                </div>
            )}
        </>
    );
}
