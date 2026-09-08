import React from "react";
import { THREE_D_MOTIONS, THREE_D_PRIMITIVES } from "./threeDConstants";
import { ANIME_3D_EASINGS } from "./anime3dEngine";
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
    const dsaPrimitive = ["array3d", "matrix3d", "linkedlist3d", "stack3d", "queue3d", "tree3d", "heap3d", "minheap3d", "maxheap3d", "graph3d", "intervals3d", "hashtable3d", "trie3d", "sorting3d"].includes(primitive);
    const aiPrimitive = ["neuron3d", "neuralnetwork3d", "tensor3d", "embedding3d", "attention3d", "transformer3d", "tokenflow3d", "convnet3d", "modelpipeline3d", "rnn3d", "autoencoder3d", "gan3d", "diffusion3d", "rag3d", "vectordb3d", "losslandscape3d"].includes(primitive);
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
                <div className="webgl-character-grid">
                    <label>
                        <span>Anime easing</span>
                        <select value={element.motionEasing || "inOut"} onChange={(event) => onPatch?.({ motionEasing: event.target.value })}>
                            {ANIME_3D_EASINGS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Direction</span>
                        <select value={element.motionDirection || "alternate"} onChange={(event) => onPatch?.({ motionDirection: event.target.value })}>
                            <option value="normal">Normal</option>
                            <option value="reverse">Reverse</option>
                            <option value="alternate">Alternate</option>
                        </select>
                    </label>
                </div>
                <NumberField label="Motion duration (ms)" value={element.motionDurationMs || 2400} min="100" step="100" onChange={(value) => onPatch?.({ motionDurationMs: Math.max(100, value || 2400) })} />
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

            <div className="property-section three-d-motion-section">
                <label>Live 3D motion</label>
                <div className="webgl-character-grid">
                    <label>
                        <span>Motion</span>
                        <select value={element.motion3d || "none"} onChange={(event) => onPatch?.({ motion3d: event.target.value })}>
                            {THREE_D_MOTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <NumberField label="Speed" value={element.motionSpeed || 1} min="0.05" step="0.1" onChange={(value) => onPatch?.({ motionSpeed: Math.max(.05, value || 1) })} />
                </div>
                <div className="webgl-number-grid">
                    <NumberField label="Perspective" value={element.perspective || 720} min="180" step="20" onChange={(value) => onPatch?.({ perspective: Math.max(180, value || 720) })} />
                    <NumberField label="Camera pitch" value={element.cameraPitch || 12} step="1" onChange={(value) => onPatch?.({ cameraPitch: value })} />
                    <NumberField label="Camera yaw" value={element.cameraYaw || 0} step="1" onChange={(value) => onPatch?.({ cameraYaw: value })} />
                </div>
                <label className="three-d-check-row">
                    <input type="checkbox" checked={element.showLabels !== false} onChange={(event) => onPatch?.({ showLabels: event.target.checked })} />
                    <span>Show labels and values</span>
                </label>
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
                    {primitive === "graph3d" && (
                        <>
                            <textarea rows="4" value={JSON.stringify(element.graphNodes || [], null, 2)} onChange={(event) => { try { onPatch?.({ graphNodes: JSON.parse(event.target.value) }); } catch (_) { /* Keep current graph until JSON is valid. */ } }} />
                            <textarea rows="3" value={JSON.stringify(element.graphEdges || [])} onChange={(event) => { try { onPatch?.({ graphEdges: JSON.parse(event.target.value) }); } catch (_) { /* Keep current graph until JSON is valid. */ } }} />
                            <textarea rows="2" value={JSON.stringify(element.traversalOrder || [])} onChange={(event) => { try { onPatch?.({ traversalOrder: JSON.parse(event.target.value) }); } catch (_) { /* Keep current graph until JSON is valid. */ } }} />
                            <select value={element.traversalMode || "BFS"} onChange={(event) => onPatch?.({ traversalMode: event.target.value })}>
                                <option value="BFS">BFS traversal</option>
                                <option value="DFS">DFS traversal</option>
                            </select>
                        </>
                    )}
                    {primitive === "intervals3d" && (
                        <textarea rows="3" value={JSON.stringify(element.intervals || [[1, 4], [2, 6], [5, 8]])} onChange={(event) => { try { onPatch?.({ intervals: JSON.parse(event.target.value) }); } catch (_) { /* Keep current intervals until JSON is valid. */ } }} />
                    )}
                    {["heap3d", "minheap3d", "maxheap3d"].includes(primitive) && (
                        <textarea rows="3" value={JSON.stringify(element.heapValues || element.values || [])} onChange={(event) => { try { onPatch?.({ heapValues: JSON.parse(event.target.value) }); } catch (_) { /* Keep current heap until JSON is valid. */ } }} />
                    )}
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

            {aiPrimitive && (
                <div className="property-section">
                    <label>AI structure data</label>
                    {primitive === "neuralnetwork3d" && (
                        <textarea rows="2" value={JSON.stringify(element.layers || [3, 5, 5, 2])} onChange={(event) => { try { onPatch?.({ layers: JSON.parse(event.target.value) }); } catch (_) { /* Keep current value until JSON is valid. */ } }} />
                    )}
                    {primitive === "tensor3d" && (
                        <textarea rows="2" value={JSON.stringify(element.tensorShape || [4, 4, 3])} onChange={(event) => { try { onPatch?.({ tensorShape: JSON.parse(event.target.value) }); } catch (_) { /* Keep current value until JSON is valid. */ } }} />
                    )}
                    {primitive === "tokenflow3d" && (
                        <textarea rows="2" value={JSON.stringify(element.tokens || ["The", "model", "learns", "patterns"])} onChange={(event) => { try { onPatch?.({ tokens: JSON.parse(event.target.value) }); } catch (_) { /* Keep current value until JSON is valid. */ } }} />
                    )}
                    {(primitive === "attention3d" || primitive === "embedding3d") && (
                        <NumberField label={primitive === "attention3d" ? "Matrix size" : "Point count"} value={primitive === "attention3d" ? element.rows || 6 : element.nodes || 30} min="3" step="1" onChange={(value) => onPatch?.(primitive === "attention3d" ? { rows: value, cols: value } : { nodes: value })} />
                    )}
                    <small className="property-help">Use JSON arrays to change layers, tensor shape, tokens, or values.</small>
                </div>
            )}
        </>
    );
}
