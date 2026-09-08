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
                                             object = null,
                                             animationPresets = [],
                                             onSetAnimation,
                                             onAnimateAfter,
                                             onToggleAnimationLoop,
                                             onRemoveAnimation,
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
                {object && (
                    <>
                        <div style={sectionTitleStyle}>Object animation</div>

                        <div style={effectGridStyle}>
                            {animationPresets.map((preset) => (
                                <button
                                    type="button"
                                    key={preset.type}
                                    title={preset.description}
                                    onClick={() => runAndClose(() => onSetAnimation?.(preset.type))}
                                    style={{
                                        ...effectButtonStyle,
                                        ...(object?.animation?.type === preset.type ? activeEffectButtonStyle : {}),
                                    }}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        <MenuButton
                            disabled={!object?.animation?.type || object.animation.type === "none"}
                            onClick={() => runAndClose(onAnimateAfter)}
                        >
                            Animate after…
                        </MenuButton>

                        <MenuButton
                            disabled={!object?.animation?.type || object.animation.type === "none"}
                            onClick={() => runAndClose(onToggleAnimationLoop)}
                        >
                            {object?.animation?.loop ? "✓ Loop animation" : "Loop animation"}
                        </MenuButton>

                        <MenuButton
                            disabled={!object?.animation?.type || object.animation.type === "none"}
                            onClick={() => runAndClose(onRemoveAnimation)}
                        >
                            Remove animation
                        </MenuButton>

                        <div style={dividerStyle} />
                    </>
                )}

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
    maxHeight: "min(680px, calc(100vh - 24px))",
    overflowY: "auto",
};

const effectGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 6,
    padding: "4px 8px 8px",
};

const effectButtonStyle = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
    borderRadius: 8,
    padding: "8px 9px",
    textAlign: "left",
    fontSize: 12,
    cursor: "pointer",
};

const activeEffectButtonStyle = {
    borderColor: "#8b5cf6",
    background: "#f5f3ff",
    color: "#6d28d9",
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
