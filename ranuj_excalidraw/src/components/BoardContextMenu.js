import React from "react";

export default function BoardContextMenu({
                                             visible,
                                             x,
                                             y,
                                             onClose,

                                             onExportPDF,
                                             onExportSVG,
                                             onExportPNG,

                                             onCopyWholePNG,
                                             onCopyWholeJPEG,
                                             onCopyWholeSVG,

                                             onCopySelectedPNG,
                                             onCopySelectedJPEG,
                                             onCopySelectedSVG,

                                             hasSelection = false,
                                         }) {
    if (!visible) return null;

    const runAndClose = async (handler) => {
        try {
            await handler?.();
        } finally {
            onClose?.();
        }
    };

    return (
        <>
            <div onClick={onClose} style={overlayStyle} />

            <div
                style={{
                    ...menuStyle,
                    top: y,
                    left: x,
                }}
            >
                <MenuButton onClick={() => runAndClose(onExportPDF)}>
                    Export to PDF
                </MenuButton>

                <MenuButton onClick={() => runAndClose(onExportSVG)}>
                    Export to SVG
                </MenuButton>

                <MenuButton onClick={() => runAndClose(onExportPNG)}>
                    Export to PNG
                </MenuButton>

                <div style={dividerStyle} />

                <div style={sectionTitleStyle}>Copy whole canvas</div>

                <MenuButton onClick={() => runAndClose(onCopyWholePNG)}>
                    Copy PNG
                </MenuButton>

                <MenuButton onClick={() => runAndClose(onCopyWholeJPEG)}>
                    Copy JPEG
                </MenuButton>

                <MenuButton onClick={() => runAndClose(onCopyWholeSVG)}>
                    Copy SVG
                </MenuButton>

                <div style={dividerStyle} />

                <div style={sectionTitleStyle}>Copy selected</div>

                <MenuButton
                    disabled={!hasSelection}
                    onClick={() => runAndClose(onCopySelectedPNG)}
                >
                    Copy PNG
                </MenuButton>

                <MenuButton
                    disabled={!hasSelection}
                    onClick={() => runAndClose(onCopySelectedJPEG)}
                >
                    Copy JPEG
                </MenuButton>

                <MenuButton
                    disabled={!hasSelection}
                    onClick={() => runAndClose(onCopySelectedSVG)}
                >
                    Copy SVG
                </MenuButton>
            </div>
        </>
    );
}

function MenuButton({ children, onClick, disabled = false }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            style={{
                ...menuButtonStyle,
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
            }}
        >
            {children}
        </button>
    );
}

const overlayStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 999,
};

const menuStyle = {
    position: "fixed",
    zIndex: 1000,
    minWidth: 240,
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 12,
    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
    padding: 8,
};

const menuButtonStyle = {
    width: "100%",
    border: "none",
    background: "transparent",
    textAlign: "left",
    padding: "9px 12px",
    borderRadius: 8,
    fontSize: 14,
};

const sectionTitleStyle = {
    padding: "6px 12px 4px",
    fontSize: 12,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
};

const dividerStyle = {
    height: 1,
    background: "#e5e7eb",
    margin: "6px 4px",
};