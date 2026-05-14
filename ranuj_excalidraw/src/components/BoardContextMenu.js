import React from "react";

export default function BoardContextMenu({
                                             visible,
                                             x,
                                             y,
                                             onClose,
                                             onExportPDF,
                                             onExportSVG,
                                             onExportPNG,
                                         }) {
    if (!visible) return null;

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 999,
                }}
            />

            <div
                style={{
                    position: "fixed",
                    top: y,
                    left: x,
                    zIndex: 1000,
                    minWidth: 220,
                    background: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                    padding: 8,
                }}
            >
                <button
                    onClick={() => {
                        onExportPDF();
                        onClose();
                    }}
                    style={menuButtonStyle}
                >
                    Export to PDF
                </button>

                <button
                    onClick={() => {
                        onExportSVG();
                        onClose();
                    }}
                    style={menuButtonStyle}
                >
                    Export to SVG
                </button>

                <button
                    onClick={() => {
                        onExportPNG();
                        onClose();
                    }}
                    style={menuButtonStyle}
                >
                    Export to PNG
                </button>
            </div>
        </>
    );
}

const menuButtonStyle = {
    width: "100%",
    border: "none",
    background: "transparent",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
};