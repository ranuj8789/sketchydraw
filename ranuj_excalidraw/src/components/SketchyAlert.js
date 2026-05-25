import React from "react";
import "./SketchyAlert.css";

export default function SketchyAlert({ alert, onClose, onConfirm }) {
    if (!alert?.open) return null;

    const isConfirm = alert.type === "confirm";

    return (
        <div className="sketchy-alert-backdrop" onMouseDown={onClose}>
            <div className="sketchy-alert-card" onMouseDown={(e) => e.stopPropagation()}>
                <div className="sketchy-alert-icon">{alert.icon || "✏️"}</div>

                <div className="sketchy-alert-content">
                    <h3>{alert.title || "SketchyDraw"}</h3>
                    <p>{alert.message}</p>
                </div>

                <div className="sketchy-alert-actions">
                    {isConfirm && (
                        <button type="button" className="sketchy-alert-secondary" onClick={onClose}>
                            Cancel
                        </button>
                    )}

                    <button
                        type="button"
                        className={isConfirm ? "sketchy-alert-danger" : "sketchy-alert-primary"}
                        onClick={isConfirm ? onConfirm : onClose}
                    >
                        {alert.confirmText || "OK"}
                    </button>
                </div>
            </div>
        </div>
    );
}
