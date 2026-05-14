import React from "react";

export default function Toolbar({ undo, redo, clearCanvas, canUndo, canRedo }) {
    return (
        <div className="topbar">
            <div>
                <h1>Sketchy</h1>
                <p>Simple online whiteboard for sketches and diagrams</p>
            </div>

            <div className="topbar-actions">
                <button onClick={undo} disabled={!canUndo}>Undo</button>
                <button onClick={redo} disabled={!canRedo}>Redo</button>
                <button onClick={clearCanvas} className="danger">Clear</button>
            </div>
        </div>
    );
}