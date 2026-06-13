import React, { useMemo, useState } from "react";
import {
    Pencil,
    Square,
    Circle,
    Slash,
    MousePointer2,
    Eraser,
    Type,
    MoveRight,
    Diamond,
    Hand,
    Image as ImageIcon,
} from "lucide-react";
import PropertiesPanel from "../PropertiesPanel/PropertiesPanel";
import "./Sidebar.css";

const TOOLS = [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "hand", label: "Hand", icon: Hand },
    { id: "pencil", label: "Pencil", icon: Pencil },
    { id: "line", label: "Line", icon: Slash },
    { id: "arrow", label: "Arrow", icon: MoveRight },
    { id: "rect", label: "Rectangle", icon: Square },
    { id: "diamond", label: "Diamond", icon: Diamond },
    { id: "ellipse", label: "Ellipse", icon: Circle },
    { id: "text", label: "Text", icon: Type },
    { id: "image", label: "Image", icon: ImageIcon },
    { id: "eraser", label: "Eraser", icon: Eraser },
];

const QUICK_EMOJIS = [
    "🔥",
    "⭐",
    "✅",
    "🚀",
    "💡",
    "❤️",
    "👉",
    "🎯",
    "⚡",
    "📌",
    "😊",
    "🏆",
];

const ORDER_DELAY_STEP_OPTIONS = [250, 500, 750, 1000];

function getCurrentFrame(frames = [], currentFrameIndex = 0) {
    return frames[currentFrameIndex] || frames[0] || null;
}

function countAnimatedObjects(frame) {
    return (frame?.elements || []).filter(
        (element) => element?.animation?.type && element.animation.type !== "none"
    ).length;
}

function PrimitiveButton({ title, subtitle, primary = false, onClick }) {
    return (
        <button
            type="button"
            className={primary ? "left-primitive-btn primary" : "left-primitive-btn"}
            onClick={onClick}
        >
            <strong>{title}</strong>
            <span>{subtitle}</span>
        </button>
    );
}

function GifToolsTab({
    frames = [],
    currentFrameIndex = 0,
    animationPlaying = false,
    animationTimeMs = 0,
    advanceMode = "enter",
    onAdvanceModeChange,
    onOpenPlayer,
    onAddFrameAfter,
    onToggleFrameAnimation,
    onApplyFrameObjectOrderTiming,
    onMergeFrameWithNext,
    onMergeAllFrames,
    onInsertGifPrimitive,
}) {
    const [orderDelayStep, setOrderDelayStep] = useState(500);

    const currentFrame = useMemo(
        () => getCurrentFrame(frames, currentFrameIndex),
        [frames, currentFrameIndex]
    );

    const objectCount = currentFrame?.elements?.length || 0;
    const animatedCount = countAnimatedObjects(currentFrame);
    const canMergeNext = currentFrameIndex < frames.length - 1;
    const canMergeAll = frames.length > 1;

    const insertPrimitive = (type, options = {}) => {
        onInsertGifPrimitive?.({
            type,
            animated: !!options.animated,
            animationType: options.animationType || (options.animated ? "draw" : "none"),
        });
    };

    const applyOrderTiming = () => {
        onApplyFrameObjectOrderTiming?.(currentFrameIndex, {
            delayStepMs: Number(orderDelayStep) || 500,
        });
    };

    return (
        <div className="left-tab-panel">
            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>GIF Tools</strong>
                    <span>
                        Frame {currentFrameIndex + 1}/{Math.max(frames.length, 1)} · {objectCount} objects · {animatedCount} animated
                    </span>
                </div>

                <div className="left-tool-grid two">
                    <button type="button" className="left-primary-btn" onClick={() => onOpenPlayer?.("current")}>
                        Play screen
                    </button>
                    <button type="button" className="left-primary-btn blue" onClick={() => onOpenPlayer?.("all")}>
                        Play all
                    </button>
                </div>

                <div className="left-tool-grid two">
                    <button type="button" onClick={onAddFrameAfter}>+ Frame</button>
                    <button type="button" onClick={onToggleFrameAnimation}>
                        {animationPlaying ? "Stop preview" : "Preview"}
                    </button>
                </div>
            </div>

            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Animated primitives</strong>
                    <span>These create GIF objects directly on the current desktop view.</span>
                </div>

                <div className="left-primitive-grid">
                    <PrimitiveButton
                        title="Line"
                        subtitle="static"
                        onClick={() => insertPrimitive("line")}
                    />
                    <PrimitiveButton
                        title="Line"
                        subtitle="draws itself"
                        primary
                        onClick={() => insertPrimitive("line", { animated: true, animationType: "draw" })}
                    />
                    <PrimitiveButton
                        title="Arrow"
                        subtitle="static"
                        onClick={() => insertPrimitive("arrow")}
                    />
                    <PrimitiveButton
                        title="Arrow"
                        subtitle="moving draw"
                        primary
                        onClick={() => insertPrimitive("arrow", { animated: true, animationType: "draw" })}
                    />
                    <PrimitiveButton
                        title="Rectangle"
                        subtitle="static"
                        onClick={() => insertPrimitive("rectangle")}
                    />
                    <PrimitiveButton
                        title="Rectangle"
                        subtitle="fade in"
                        primary
                        onClick={() => insertPrimitive("rectangle", { animated: true, animationType: "fadeIn" })}
                    />
                </div>
            </div>

            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Flow</strong>
                    <span>Order timing uses object order from the right Frames panel.</span>
                </div>

                <label className="left-field">
                    After screen ends
                    <select value={advanceMode} onChange={(event) => onAdvanceModeChange?.(event.target.value)}>
                        <option value="enter">Wait for Enter</option>
                        <option value="auto">Auto next</option>
                    </select>
                </label>

                <label className="left-field">
                    Order delay
                    <select value={orderDelayStep} onChange={(event) => setOrderDelayStep(Number(event.target.value) || 500)}>
                        {ORDER_DELAY_STEP_OPTIONS.map((value) => (
                            <option value={value} key={value}>{value}ms</option>
                        ))}
                    </select>
                </label>

                <button type="button" className="left-full-btn" onClick={applyOrderTiming} disabled={!animatedCount}>
                    Apply order timing
                </button>

                <div className="left-tool-grid two">
                    <button type="button" onClick={onMergeFrameWithNext} disabled={!canMergeNext}>Merge next</button>
                    <button type="button" onClick={onMergeAllFrames} disabled={!canMergeAll}>Merge all</button>
                </div>

                <span className="left-muted-status">Preview time: {Math.round(animationTimeMs)}ms</span>
            </div>
        </div>
    );
}

function RichTextTab({ onInsertEmoji, onInsertRichText }) {
    const [emojiValue, setEmojiValue] = useState("🔥");
    const [plainText, setPlainText] = useState("Rich text box");
    const [fontSize, setFontSize] = useState(22);
    const [stroke, setStroke] = useState("#111827");
    const [bold, setBold] = useState(true);
    const [italic, setItalic] = useState(false);
    const [underline, setUnderline] = useState(false);

    const insertEmoji = (value = emojiValue) => {
        onInsertEmoji?.(value);
    };

    const insertRichText = () => {
        const safeText = String(plainText || "Rich text box").trim() || "Rich text box";

        onInsertRichText?.({
            plainText: safeText,
            html: safeText,
            fontSize,
            stroke,
            bold,
            italic,
            underline,
        });
    };

    return (
        <div className="left-tab-panel">
            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Emoji</strong>
                    <span>Insert emoji as editable text object.</span>
                </div>

                <div className="emoji-grid">
                    {QUICK_EMOJIS.map((emoji) => (
                        <button
                            type="button"
                            key={emoji}
                            className={emojiValue === emoji ? "active" : ""}
                            onClick={() => {
                                setEmojiValue(emoji);
                                insertEmoji(emoji);
                            }}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>

                <div className="left-tool-grid two">
                    <input
                        className="emoji-input"
                        value={emojiValue}
                        onChange={(event) => setEmojiValue(event.target.value)}
                        maxLength={4}
                    />
                    <button type="button" onClick={() => insertEmoji()}>Insert emoji</button>
                </div>
            </div>

            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Rich text toolbar</strong>
                    <span>Creates a separate rich text object without changing old text logic.</span>
                </div>

                <label className="left-field">
                    Text
                    <textarea
                        value={plainText}
                        onChange={(event) => setPlainText(event.target.value)}
                        rows={4}
                    />
                </label>

                <div className="left-tool-grid two">
                    <label className="left-field compact">
                        Size
                        <input
                            type="number"
                            min="8"
                            max="96"
                            value={fontSize}
                            onChange={(event) => setFontSize(Number(event.target.value) || 22)}
                        />
                    </label>

                    <label className="left-field compact">
                        Color
                        <input
                            type="color"
                            value={stroke}
                            onChange={(event) => setStroke(event.target.value)}
                        />
                    </label>
                </div>

                <div className="rich-toggle-row">
                    <button type="button" className={bold ? "active" : ""} onClick={() => setBold((value) => !value)}>B</button>
                    <button type="button" className={italic ? "active" : ""} onClick={() => setItalic((value) => !value)}>I</button>
                    <button type="button" className={underline ? "active" : ""} onClick={() => setUnderline((value) => !value)}>U</button>
                </div>

                <button type="button" className="left-primary-btn wide" onClick={insertRichText}>
                    Insert rich text
                </button>
            </div>
        </div>
    );
}

export default function Sidebar({
    tool,
    setTool,
    stroke,
    setStroke,
    colors,
    selectedElement,
    deleteSelected,
    toggleSelectedLineCurve,
    updateSelectedElementStyle,
    canvasProps,
    updateCanvasProps,

    frames = [],
    currentFrameIndex = 0,
    animationPlaying = false,
    animationTimeMs = 0,
    advanceMode = "enter",
    onAdvanceModeChange,
    onOpenPlayer,
    onAddFrameAfter,
    onToggleFrameAnimation,
    onApplyFrameObjectOrderTiming,
    onMergeFrameWithNext,
    onMergeAllFrames,
    onInsertGifPrimitive,
    onInsertEmoji,
    onInsertRichText,
}) {
    const [activeTab, setActiveTab] = useState("draw");

    return (
        <div className="sidebar">
            <div className="sidebar-logo-box">
                <div className="sidebar-logo-text">
                    <strong>SketchyDraw</strong>
                    <span>Draw ideas fast</span>
                </div>
            </div>

            <div className="left-toolbar-tabs">
                <button
                    type="button"
                    className={activeTab === "draw" ? "active" : ""}
                    onClick={() => setActiveTab("draw")}
                >
                    Draw
                </button>
                <button
                    type="button"
                    className={activeTab === "gif" ? "active" : ""}
                    onClick={() => setActiveTab("gif")}
                >
                    GIF
                </button>
                <button
                    type="button"
                    className={activeTab === "rich" ? "active" : ""}
                    onClick={() => setActiveTab("rich")}
                >
                    Rich
                </button>
            </div>

            {activeTab === "draw" && (
                <>
                    <div className="panel">
                        <h3>Tools</h3>

                        <div className="tool-grid">
                            {TOOLS.map((item) => {
                                const Icon = item.icon;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`tool-btn ${tool === item.id ? "active" : ""}`}
                                        onClick={() => setTool(item.id)}
                                    >
                                        <Icon size={16} />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <PropertiesPanel
                        selectedElement={selectedElement}
                        colors={colors}
                        updateSelectedElementStyle={updateSelectedElementStyle}
                        deleteSelected={deleteSelected}
                        toggleSelectedLineCurve={toggleSelectedLineCurve}
                        canvasProps={canvasProps}
                        updateCanvasProps={updateCanvasProps}
                    />
                </>
            )}

            {activeTab === "gif" && (
                <GifToolsTab
                    frames={frames}
                    currentFrameIndex={currentFrameIndex}
                    animationPlaying={animationPlaying}
                    animationTimeMs={animationTimeMs}
                    advanceMode={advanceMode}
                    onAdvanceModeChange={onAdvanceModeChange}
                    onOpenPlayer={onOpenPlayer}
                    onAddFrameAfter={onAddFrameAfter}
                    onToggleFrameAnimation={onToggleFrameAnimation}
                    onApplyFrameObjectOrderTiming={onApplyFrameObjectOrderTiming}
                    onMergeFrameWithNext={onMergeFrameWithNext}
                    onMergeAllFrames={onMergeAllFrames}
                    onInsertGifPrimitive={onInsertGifPrimitive}
                />
            )}

            {activeTab === "rich" && (
                <RichTextTab
                    onInsertEmoji={onInsertEmoji}
                    onInsertRichText={onInsertRichText}
                />
            )}
        </div>
    );
}
