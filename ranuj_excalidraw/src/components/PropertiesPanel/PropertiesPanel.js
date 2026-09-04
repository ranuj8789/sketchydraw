import React, { useEffect, useState } from "react";
import {
    DEFAULT_TEXT_STYLE,
    FONT_FAMILY_OPTIONS,
    FONT_SIZE_OPTIONS,
    getLineHeightForFontSize,
} from "../../canvas/textStyle";
import "./PropertiesPanel.css";
import { isSystemDesignType } from "../../canvas/canvasConstants";
import { getAnimationPresetsForElement } from "../../canvas/animationRegistry";
import { TIMELINE_PLAYBACK_SPEED_OPTIONS } from "../../canvas/animationTimeline";
import { loadCanvasFont } from "../../canvas/fontLoader";

const LINE_WIDTHS = [1, 2, 3, 4, 6, 8];

const CORNER_RADIUS_OPTIONS = [0, 6, 10, 14, 20, 28];

const CANVAS_RADIUS_OPTIONS = [0, 8, 16, 24, 32];

const CANVAS_PATTERNS = [
    { label: "Blank", value: "blank" },
    { label: "Grid", value: "grid" },
    { label: "Notebook", value: "notebook" },
    { label: "Dots", value: "dots" },
    { label: "Blocks", value: "blocks" },
];

const DASH_OPTIONS = [
    { label: "Solid", value: "solid" },
    { label: "Dashed", value: "dashed" },
    { label: "Dotted", value: "dotted" },
];

const ARROW_OPTIONS = [
    { label: "None", value: "none" },
    { label: "End", value: "end" },
    { label: "Start", value: "start" },
    { label: "Both", value: "both" },
];

const BASE_ANIMATION_OPTIONS = [
    { label: "None", value: "none" },
    { label: "Fade in", value: "fadeIn" },
    { label: "Slide up", value: "slideUp" },
    { label: "Scale in", value: "scaleIn" },
];

const TEXT_ONLY_ANIMATION_OPTIONS = [
    { label: "Typewriter", value: "typewriter" },
];

const DRAW_ANIMATION_OPTIONS = [
    { label: "Draw", value: "draw" },
];

const ANIMATION_SPEED_OPTIONS = [
    { label: "Fast", durationMs: 600 },
    { label: "Normal", durationMs: 1000 },
    { label: "Slow", durationMs: 1600 },
    { label: "Very slow", durationMs: 2400 },
];

const ANIMATION_DELAY_OPTIONS = [
    { label: "No delay", delayMs: 0 },
    { label: "0.3s", delayMs: 300 },
    { label: "0.5s", delayMs: 500 },
    { label: "1s", delayMs: 1000 },
    { label: "1.5s", delayMs: 1500 },
];

function getSupportedAnimationOptions(element) {
    if (!element) return BASE_ANIMATION_OPTIONS;

    const options = [...BASE_ANIMATION_OPTIONS];

    if (element.type === "text") {
        options.push(...TEXT_ONLY_ANIMATION_OPTIONS);
    }

    if (
        element.type === "line" ||
        element.type === "arrow" ||
        element.type === "pencil"
    ) {
        options.push(...DRAW_ANIMATION_OPTIONS);
    }

    return options;
}

function getAnimation(element) {
    return {
        type: element?.animation?.type || "none",
        durationMs: Number(element?.animation?.durationMs) || 1000,
        delayMs: Number(element?.animation?.delayMs) || 0,
        dependencyMode: element?.animation?.dependencyMode || "absolute",
        dependsOnId: element?.animation?.dependsOnId || "",
        dependencyOffsetMs: Number(element?.animation?.dependencyOffsetMs) || 0,
        beforeStart: element?.animation?.beforeStart || "hidden",
        afterEnd: element?.animation?.afterEnd || "visible",
    };
}

function ObjectDiagram({ element, compact = false }) {
    const type = element?.type || "object";
    const className = `object-diagram object-diagram-${type} ${compact ? "compact" : ""}`;

    if (type === "text") {
        return <span className={className}><i /><i /><i /></span>;
    }
    if (type === "image") {
        return <span className={className}><i className="sun" /><i className="mountain" /></span>;
    }
    if (type === "ellipse") return <span className={className} />;
    if (type === "diamond") return <span className={className} />;
    if (type === "line" || type === "arrow" || type === "pencil") {
        return <span className={className}><i /></span>;
    }
    if (type === "user") {
        return <span className={className}><i className="head" /><i className="body" /></span>;
    }
    if (isSystemDesignType(type)) {
        return <span className={className}><i /><b>{String(type).slice(0, 2).toUpperCase()}</b></span>;
    }
    return <span className={className}><i /></span>;
}

function getArrowValue(element) {
    const start = !!element?.arrowStart;
    const end =
        element?.type === "arrow"
            ? element.arrowEnd !== false
            : !!element?.arrowEnd;

    if (start && end) return "both";
    if (start) return "start";
    if (end) return "end";
    return "none";
}

function arrowPatch(value) {
    if (value === "both") {
        return {
            arrowStart: true,
            arrowEnd: true,
        };
    }

    if (value === "start") {
        return {
            arrowStart: true,
            arrowEnd: false,
        };
    }

    if (value === "end") {
        return {
            arrowStart: false,
            arrowEnd: true,
        };
    }

    return {
        arrowStart: false,
        arrowEnd: false,
    };
}

function cleanFontName(fontFamily) {
    return String(fontFamily || "")
        .split(",")[0]
        .replace(/['"]/g, "")
        .trim();
}

function toFontFamily(fontName) {
    const clean = cleanFontName(fontName);

    if (!clean) {
        return DEFAULT_TEXT_STYLE.fontFamily;
    }

    return `"${clean}", cursive`;
}

function SidebarFrameAudioRecorder({ frame, frameIndex, onAudioSaved, onAudioRemoved }) {
    const recorderRef = React.useRef(null);
    const streamRef = React.useRef(null);
    const chunksRef = React.useRef([]);
    const startedAtRef = React.useRef(0);
    const [recording, setRecording] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => () => {
        streamRef.current?.getTracks?.().forEach((track) => track.stop());
    }, []);

    const start = async () => {
        setError("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            chunksRef.current = [];
            const recorder = new MediaRecorder(stream);
            recorderRef.current = recorder;
            startedAtRef.current = Date.now();
            recorder.ondataavailable = (event) => {
                if (event.data?.size) chunksRef.current.push(event.data);
            };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });
                const reader = new FileReader();
                reader.onloadend = () =>
                    onAudioSaved?.(frameIndex, String(reader.result || ""), {
                        name: `Frame ${frameIndex + 1} narration`,
                        durationMs: Math.max(0, Date.now() - startedAtRef.current),
                    });
                reader.readAsDataURL(blob);
                streamRef.current?.getTracks?.().forEach((track) => track.stop());
                streamRef.current = null;
            };
            recorder.start();
            setRecording(true);
        } catch (err) {
            setError(err?.message || "Microphone permission failed.");
        }
    };

    const stop = () => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        setRecording(false);
    };

    return (
        <div className="sidebar-frame-audio">
            <div>
                <strong>Frame narration</strong>
                <small>Record audio for the current frame.</small>
            </div>
            {frame?.audioDataUrl ? (
                <>
                    <audio controls src={frame.audioDataUrl} />
                    <div className="sidebar-frame-audio-actions">
                        <button type="button" onClick={start}>Replace</button>
                        <button type="button" onClick={() => onAudioRemoved?.(frameIndex)}>Remove</button>
                    </div>
                </>
            ) : (
                <button type="button" className={recording ? "recording" : ""} onClick={recording ? stop : start}>
                    {recording ? "Stop recording" : "Record narration"}
                </button>
            )}
            {error && <small className="sidebar-frame-audio-error">{error}</small>}
        </div>
    );
}

export default function PropertiesPanel({
                                            selectedElement,
                                            colors,
                                            updateSelectedElementStyle,
                                            deleteSelected,
                                            toggleSelectedLineCurve,

                                            canvasProps = {},
                                            updateCanvasProps,
                                            frames = [],
                                            currentFrameIndex = 0,
                                            onUpdateFrameAudio,
                                            onRemoveFrameAudio,
                                            playbackSpeed = 0.5,
                                            onPlaybackSpeedChange,
                                            forcedMode = null,
                                            hideModeTabs = false,
                                            compactHeader = false,
                                        }) {
    const isText = selectedElement?.type === "text";
    const isImage = selectedElement?.type === "image";

    const [customFontFamily, setCustomFontFamily] = useState("Kalam");
    const [customFontSize, setCustomFontSize] = useState(
        String(FONT_SIZE_OPTIONS.M.fontSize)
    );
    const [activeInspectorTab, setActiveInspectorTab] = useState(
        forcedMode || "properties"
    );
    const [animationCategory, setAnimationCategory] = useState("entrance");
    const [advancedSequenceOpen, setAdvancedSequenceOpen] = useState(false);

    const inspectorTab = forcedMode || activeInspectorTab;

    useEffect(() => {
        if (forcedMode) {
            setActiveInspectorTab(forcedMode);
            return;
        }

        if (!selectedElement && activeInspectorTab === "animation") {
            setActiveInspectorTab("properties");
        }
    }, [selectedElement, activeInspectorTab, forcedMode]);

    useEffect(() => {
        if (!isText) return;

        const fontName = cleanFontName(
            selectedElement?.fontFamily || DEFAULT_TEXT_STYLE.fontFamily
        );

        setCustomFontFamily(fontName || "Kalam");
        setCustomFontSize(
            String(selectedElement?.fontSize || FONT_SIZE_OPTIONS.M.fontSize)
        );

        loadCanvasFont(selectedElement?.fontFamily || DEFAULT_TEXT_STYLE.fontFamily);
    }, [isText, selectedElement?.id]);

    const isLineLike =
        selectedElement?.type === "line" ||
        selectedElement?.type === "arrow" ||
        selectedElement?.type === "pencil";

    const isShape =
        selectedElement?.type === "rect" ||
        selectedElement?.type === "rectangle" ||
        selectedElement?.type === "ellipse" ||
        selectedElement?.type === "diamond" ||
        isSystemDesignType(selectedElement?.type);

    const supportsCornerRadius =
        selectedElement?.type === "rect" ||
        selectedElement?.type === "rectangle";

    const isCurved = selectedElement?.lineStyle === "curved";

    const animation = getAnimation(selectedElement);

    const supportedAnimationOptions = getAnimationPresetsForElement(
        selectedElement
    ).map((preset) => ({
        label: preset.label,
        value: preset.type,
        durationMs: preset.durationMs,
        loop: !!preset.loop,
        description: preset.description || "",
    }));

    const animationGroups = {
        entrance: supportedAnimationOptions.filter((item) =>
            [
                "none",
                "appear",
                "fadeIn",
                "flyInLeft",
                "flyInRight",
                "flyInTop",
                "flyInBottom",
                "zoomIn",
                "floatIn",
                "slideUp",
                "scaleIn",
                "typewriter",
                "draw",
            ].includes(item.value)
        ),
        emphasis: supportedAnimationOptions.filter((item) =>
            [
                "pulse",
                "glow",
                "pulseRing",
                "spotlight",
                "blink",
                "movingHead",
                "movingDashes",
            ].includes(item.value)
        ),
    };

    const visibleAnimationOptions =
        animationGroups[animationCategory] || animationGroups.entrance;

    const applyAnimationPreset = (item) => {
        updateSelectedElementStyle?.({
            animation: {
                ...animation,
                type: item.value,
                durationMs:
                    item.value === "none"
                        ? animation.durationMs
                        : item.durationMs || animation.durationMs,
                loop: !!item.loop,
            },
        });
    };
    const currentFrame = frames[currentFrameIndex] || frames[0] || null;
    const frameElements = currentFrame?.elements || [];
    const dependencyCandidates = frameElements.filter((item) => item?.id && item.id !== selectedElement?.id);

    const getObjectLabel = (item, index) => {
        if (!item) return `Object ${index + 1}`;
        if (item.type === "text") {
            const text = String(item.text || "Text").replace(/\s+/g, " ").trim();
            return text ? `Text: ${text.slice(0, 28)}` : "Text";
        }
        if (item.type === "image") return item.fileName ? `Image: ${item.fileName}` : "Image";
        return `${item.type || "Object"} ${index + 1}`;
    };

    const canvasBackgroundColor = canvasProps.backgroundColor || "#ffffff";
    const canvasPattern = canvasProps.pattern || "blank";
    const canvasCornerRadius = canvasProps.cornerRadius ?? 16;

    return (
        <div className={`properties-panel ${compactHeader ? "compact-animation-panel" : ""}`}>
            <div className="properties-header">
                <div>
                    <h3>{forcedMode === "animation" ? "Animation" : "Properties"}</h3>
                    <p>
                        {selectedElement
                            ? `Selected: ${selectedElement.type}`
                            : forcedMode === "animation"
                                ? "Select an object to animate it"
                                : "Canvas settings"}
                    </p>
                </div>
            </div>

            {!hideModeTabs && (
                <div className="properties-mode-tabs" role="tablist" aria-label="Inspector mode">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeInspectorTab === "properties"}
                        className={activeInspectorTab === "properties" ? "active" : ""}
                        onClick={() => setActiveInspectorTab("properties")}
                    >
                        Properties
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeInspectorTab === "animation"}
                        className={activeInspectorTab === "animation" ? "active" : ""}
                        onClick={() => selectedElement && setActiveInspectorTab("animation")}
                        disabled={!selectedElement}
                        title={!selectedElement ? "Select an object to animate it" : "Object animation settings"}
                    >
                        Animation
                    </button>
                </div>
            )}

            {inspectorTab === "properties" && (
                <div className="properties-tab-content">

                    {!selectedElement && (
                        <>
                            <div className="property-section">
                                <label>Canvas color</label>

                                <div className="custom-color-row">
                                    <input
                                        type="color"
                                        value={canvasBackgroundColor}
                                        onChange={(e) =>
                                            updateCanvasProps?.({
                                                backgroundColor: e.target.value,
                                            })
                                        }
                                    />

                                    <input
                                        type="text"
                                        value={canvasBackgroundColor}
                                        onChange={(e) =>
                                            updateCanvasProps?.({
                                                backgroundColor: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                            </div>

                            <div className="property-section">
                                <label>Canvas pattern</label>

                                <div className="segmented-row">
                                    {CANVAS_PATTERNS.map((item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            className={canvasPattern === item.value ? "active" : ""}
                                            onClick={() =>
                                                updateCanvasProps?.({
                                                    pattern: item.value,
                                                })
                                            }
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="property-section">
                                <label>Canvas round corner</label>

                                <div className="segmented-row">
                                    {CANVAS_RADIUS_OPTIONS.map((radius) => (
                                        <button
                                            key={radius}
                                            type="button"
                                            className={canvasCornerRadius === radius ? "active" : ""}
                                            onClick={() =>
                                                updateCanvasProps?.({
                                                    cornerRadius: radius,
                                                })
                                            }
                                        >
                                            {radius === 0 ? "Sharp" : radius}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="property-section">
                                <label>Quick canvas colors</label>

                                <div className="property-color-row">
                                    {[
                                        "#ffffff",
                                        "#f8fafc",
                                        "#fff7ed",
                                        "#fefce8",
                                        "#ecfeff",
                                        "#f0fdf4",
                                        "#fdf2f8",
                                        "#111827",
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`property-color ${
                                                canvasBackgroundColor === color ? "selected" : ""
                                            }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() =>
                                                updateCanvasProps?.({
                                                    backgroundColor: color,
                                                })
                                            }
                                            aria-label={`Set canvas color ${color}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {selectedElement && (
                        <>
                            <div className="property-section">
                                <label>{isText ? "Text color" : "Stroke color"}</label>

                                <div className="custom-color-row">
                                    <input
                                        type="color"
                                        value={selectedElement.stroke || "#111827"}
                                        onChange={(e) =>
                                            updateSelectedElementStyle?.({
                                                stroke: e.target.value,
                                            })
                                        }
                                    />

                                    <input
                                        type="text"
                                        value={selectedElement.stroke || "#111827"}
                                        onChange={(e) =>
                                            updateSelectedElementStyle?.({
                                                stroke: e.target.value,
                                            })
                                        }
                                    />
                                </div>

                                <div className="property-color-row property-color-row-spaced">
                                    {colors.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`property-color ${
                                                selectedElement.stroke === color ? "selected" : ""
                                            }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() =>
                                                updateSelectedElementStyle?.({
                                                    stroke: color,
                                                })
                                            }
                                            aria-label={`Set color ${color}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            {isShape && (
                                <div className="property-section">
                                    <label>Fill color</label>

                                    <div className="custom-color-row">
                                        <input
                                            type="color"
                                            value={
                                                selectedElement.fill &&
                                                selectedElement.fill !== "transparent"
                                                    ? selectedElement.fill
                                                    : "#ffffff"
                                            }
                                            onChange={(e) =>
                                                updateSelectedElementStyle?.({
                                                    fill: e.target.value,
                                                })
                                            }
                                        />

                                        <button
                                            type="button"
                                            className="mini-action-btn"
                                            onClick={() =>
                                                updateSelectedElementStyle?.({
                                                    fill: "transparent",
                                                })
                                            }
                                        >
                                            Transparent
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(isLineLike || isShape) && (
                                <>
                                    <div className="property-section">
                                        <label>Line width</label>

                                        <div className="segmented-row">
                                            {LINE_WIDTHS.map((width) => (
                                                <button
                                                    key={width}
                                                    type="button"
                                                    className={
                                                        (selectedElement.strokeWidth || 2) === width
                                                            ? "active"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        updateSelectedElementStyle?.({
                                                            strokeWidth: width,
                                                        })
                                                    }
                                                >
                                                    {width}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="property-section">
                                        <label>Dash</label>

                                        <div className="segmented-row">
                                            {DASH_OPTIONS.map((item) => (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    className={
                                                        (selectedElement.strokeDash || "solid") === item.value
                                                            ? "active"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        updateSelectedElementStyle?.({
                                                            strokeDash: item.value,
                                                        })
                                                    }
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {supportsCornerRadius && (
                                <div className="property-section">
                                    <label>Round corner</label>

                                    <div className="segmented-row">
                                        {CORNER_RADIUS_OPTIONS.map((radius) => (
                                            <button
                                                key={radius}
                                                type="button"
                                                className={
                                                    (selectedElement.cornerRadius ?? 0) === radius
                                                        ? "active"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    updateSelectedElementStyle?.({
                                                        cornerRadius: radius,
                                                    })
                                                }
                                            >
                                                {radius === 0 ? "Sharp" : radius}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(selectedElement.type === "line" ||
                                selectedElement.type === "arrow") && (
                                <>
                                    <div className="property-section">
                                        <label>Arrow type</label>

                                        <div className="segmented-row">
                                            {ARROW_OPTIONS.map((item) => (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    className={
                                                        getArrowValue(selectedElement) === item.value
                                                            ? "active"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        updateSelectedElementStyle?.(
                                                            arrowPatch(item.value)
                                                        )
                                                    }
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="property-section">
                                        <label>Line style</label>

                                        <div className="segmented-row">
                                            <button
                                                type="button"
                                                className={!isCurved ? "active" : ""}
                                                onClick={() => {
                                                    if (isCurved) {
                                                        toggleSelectedLineCurve?.();
                                                    }
                                                }}
                                            >
                                                Straight
                                            </button>

                                            <button
                                                type="button"
                                                className={isCurved ? "active" : ""}
                                                onClick={() => {
                                                    if (!isCurved) {
                                                        toggleSelectedLineCurve?.();
                                                    }
                                                }}
                                            >
                                                Curved
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {isImage && (
                                <>
                                    <div className="property-section">
                                        <label>Photo adjustments</label>
                                        {[['Brightness','brightness',0,200],['Contrast','contrast',0,200],['Saturation','saturation',0,200],['Blur','blur',0,12]].map(([label,key,min,max]) => (
                                            <div className="photo-adjust-row" key={key}>
                                                <span>{label}</span>
                                                <input
                                                    type="range"
                                                    min={min}
                                                    max={max}
                                                    value={selectedElement[key] ?? (key === 'blur' ? 0 : 100)}
                                                    onChange={(event) => updateSelectedElementStyle?.({ [key]: Number(event.target.value) })}
                                                />
                                                <em>{selectedElement[key] ?? (key === 'blur' ? 0 : 100)}{key === 'blur' ? 'px' : '%'}</em>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="property-section">
                                        <label>Photo tools</label>
                                        <div className="segmented-row wrap-row">
                                            <button type="button" className={selectedElement.grayscale ? 'active' : ''} onClick={() => updateSelectedElementStyle?.({ grayscale: !selectedElement.grayscale })}>B&amp;W</button>
                                            <button type="button" className={selectedElement.sepia ? 'active' : ''} onClick={() => updateSelectedElementStyle?.({ sepia: !selectedElement.sepia })}>Sepia</button>
                                            <button type="button" onClick={() => updateSelectedElementStyle?.({ rotation: ((Number(selectedElement.rotation) || 0) + 90) % 360 })}>Rotate 90°</button>
                                            <button type="button" className={selectedElement.flipX ? 'active' : ''} onClick={() => updateSelectedElementStyle?.({ flipX: !selectedElement.flipX })}>Flip H</button>
                                            <button type="button" className={selectedElement.flipY ? 'active' : ''} onClick={() => updateSelectedElementStyle?.({ flipY: !selectedElement.flipY })}>Flip V</button>
                                            <button type="button" onClick={() => updateSelectedElementStyle?.({ brightness:100, contrast:100, saturation:100, blur:0, grayscale:false, sepia:false, rotation:0, flipX:false, flipY:false })}>Reset</button>
                                        </div>
                                    </div>
                                    <div className="property-section">
                                        <label>Opacity</label>
                                        <input type="range" min="5" max="100" value={Math.round((selectedElement.opacity ?? 1) * 100)} onChange={(event) => updateSelectedElementStyle?.({ opacity: Number(event.target.value) / 100 })} />
                                    </div>
                                </>
                            )}

                            {isText && (
                                <>
                                    <div className="property-section">
                                        <label>Text style</label>

                                        <div className="segmented-row">
                                            <button
                                                type="button"
                                                className={selectedElement.bold ? "active" : ""}
                                                onClick={() =>
                                                    updateSelectedElementStyle?.({
                                                        bold: !selectedElement.bold,
                                                    })
                                                }
                                            >
                                                Bold
                                            </button>

                                            <button
                                                type="button"
                                                className={selectedElement.italic ? "active" : ""}
                                                onClick={() =>
                                                    updateSelectedElementStyle?.({
                                                        italic: !selectedElement.italic,
                                                    })
                                                }
                                            >
                                                Italic
                                            </button>

                                            <button
                                                type="button"
                                                className={selectedElement.underline ? "active" : ""}
                                                onClick={() =>
                                                    updateSelectedElementStyle?.({
                                                        underline: !selectedElement.underline,
                                                    })
                                                }
                                            >
                                                Underline
                                            </button>
                                        </div>
                                    </div>

                                    <div className="property-section">
                                        <label>Font</label>

                                        <select
                                            value={
                                                FONT_FAMILY_OPTIONS.some(
                                                    (font) => font.value === selectedElement.fontFamily
                                                )
                                                    ? selectedElement.fontFamily
                                                    : "__CUSTOM__"
                                            }
                                            onChange={(e) => {
                                                const value = e.target.value;

                                                if (value === "__CUSTOM__") {
                                                    return;
                                                }

                                                const fontName = cleanFontName(value);
                                                setCustomFontFamily(fontName);
                                                loadCanvasFont(value);

                                                updateSelectedElementStyle?.({
                                                    fontFamily: value,
                                                });
                                            }}
                                        >
                                            {FONT_FAMILY_OPTIONS.map((font) => (
                                                <option key={font.id} value={font.value}>
                                                    {font.label}
                                                </option>
                                            ))}

                                            <option value="__CUSTOM__">Custom Font</option>
                                        </select>

                                        <input
                                            className="custom-font-input"
                                            type="text"
                                            value={customFontFamily}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setCustomFontFamily(value);

                                                if (!value.trim()) return;

                                                loadCanvasFont(toFontFamily(value));

                                                updateSelectedElementStyle?.({
                                                    fontFamily: toFontFamily(value),
                                                });
                                            }}
                                            placeholder="Custom Google font, e.g. Kalam"
                                        />
                                    </div>

                                    <div className="property-section">
                                        <label>Size</label>

                                        <div className="segmented-row">
                                            {Object.entries(FONT_SIZE_OPTIONS).map(
                                                ([key, option]) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        className={
                                                            selectedElement.fontSize === option.fontSize
                                                                ? "active"
                                                                : ""
                                                        }
                                                        onClick={() => {
                                                            setCustomFontSize(String(option.fontSize));

                                                            updateSelectedElementStyle?.({
                                                                fontSize: option.fontSize,
                                                                lineHeight: option.lineHeight,
                                                            });
                                                        }}
                                                    >
                                                        {option.label}
                                                    </button>
                                                )
                                            )}
                                        </div>

                                        <div className="custom-font-size-row">
                                            <span>Custom</span>

                                            <input
                                                type="number"
                                                min="8"
                                                max="120"
                                                step="1"
                                                value={customFontSize}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setCustomFontSize(value);

                                                    if (value === "") return;

                                                    const parsed = Number(value);

                                                    if (!Number.isFinite(parsed)) return;

                                                    const fontSize = Math.min(
                                                        120,
                                                        Math.max(8, parsed)
                                                    );

                                                    updateSelectedElementStyle?.({
                                                        fontSize,
                                                        lineHeight: getLineHeightForFontSize(fontSize),
                                                    });
                                                }}
                                                onBlur={() => {
                                                    if (customFontSize === "") {
                                                        const fallback = FONT_SIZE_OPTIONS.M.fontSize;
                                                        setCustomFontSize(String(fallback));

                                                        updateSelectedElementStyle?.({
                                                            fontSize: fallback,
                                                            lineHeight: getLineHeightForFontSize(fallback),
                                                        });
                                                    }
                                                }}
                                            />

                                            <em>px</em>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                </div>
            )}

            {inspectorTab === "animation" && !selectedElement && (
                <div className="animation-empty-state">
                    <strong>Select an object</strong>
                    <span>
                        Click a shape, arrow, text or image on the canvas. Its
                        PowerPoint-style animation controls will appear here.
                    </span>
                </div>
            )}

            {inspectorTab === "animation" && selectedElement && (
                <div className="animation-inspector intuitive-animation-inspector">
                    <section className="animation-card simple-animation-settings">
                        <div className="animation-card-title">
                            <strong>Common timeline speed</strong>
                            <span>This same speed is used by preview, GIF and video export.</span>
                        </div>
                        <label className="animation-simple-field">
                            <span>Playback</span>
                            <select
                                value={playbackSpeed}
                                onChange={(event) => onPlaybackSpeedChange?.(Number(event.target.value))}
                            >
                                {TIMELINE_PLAYBACK_SPEED_OPTIONS.map((speed) => (
                                    <option key={speed} value={speed}>{speed}×{speed === 0.5 ? " · Slow (default)" : ""}</option>
                                ))}
                            </select>
                        </label>
                    </section>

                    <section className="animation-summary-card">
                        <div className="animation-summary-object">
                            <ObjectDiagram element={selectedElement} />
                            <div>
                                <span>Selected</span>
                                <strong>{getObjectLabel(selectedElement, 0)}</strong>
                            </div>
                        </div>

                        <div className="animation-summary-effect">
                            <span>Animation</span>
                            <strong>
                                {
                                    supportedAnimationOptions.find(
                                        (item) => item.value === animation.type
                                    )?.label || "None"
                                }
                            </strong>
                            <small>
                                {animation.dependencyMode === "afterStart"
                                    ? "With previous"
                                    : animation.dependencyMode === "afterEnd"
                                        ? "After previous"
                                        : "On timeline"}
                                {" · "}
                                {(animation.durationMs / 1000).toFixed(1)} sec
                            </small>
                        </div>

                        <div className="animation-summary-actions">
                            <button
                                type="button"
                                className="animation-replay-button"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new Event(
                                            "sketchydraw:open-animation-storyboard"
                                        )
                                    )
                                }
                                disabled={animation.type === "none"}
                            >
                                ▶ Preview frame
                            </button>

                            <button
                                type="button"
                                className="animation-storyboard-button"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new Event(
                                            "sketchydraw:open-animation-storyboard"
                                        )
                                    )
                                }
                            >
                                Storyboard
                            </button>
                        </div>
                    </section>

                    <section className="animation-card animation-card-hero">
                        <div className="animation-card-title">
                            <strong>How should this object animate?</strong>
                            <span>
                                Choose an effect, then use Preview frame to review it safely.
                            </span>
                        </div>

                        <div className="animation-category-tabs" role="tablist">
                            <button
                                type="button"
                                className={animationCategory === "entrance" ? "active" : ""}
                                onClick={() => setAnimationCategory("entrance")}
                            >
                                Entrance
                            </button>
                            <button
                                type="button"
                                className={animationCategory === "emphasis" ? "active" : ""}
                                onClick={() => setAnimationCategory("emphasis")}
                            >
                                Emphasis
                            </button>
                        </div>

                        <div className="animation-effect-grid intuitive-effect-grid">
                            {visibleAnimationOptions.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={animation.type === item.value ? "active" : ""}
                                    onClick={() => applyAnimationPreset(item)}
                                    title={item.description || item.label}
                                >
                                    <span className={`effect-preview effect-${item.value}`}>
                                        <ObjectDiagram element={selectedElement} compact />
                                    </span>
                                    <b>
                                        {animation.type === item.value && item.value !== "none"
                                            ? `✓ ${item.label}`
                                            : item.label}
                                    </b>
                                    <small>
                                        {item.value === "none"
                                            ? "Remove animation"
                                            : "Click to apply"}
                                    </small>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="animation-card simple-animation-settings">
                        <div className="animation-card-title">
                            <strong>Timing</strong>
                            <span>Use familiar PowerPoint-style controls.</span>
                        </div>

                        <label className="animation-simple-field">
                            <span>Start</span>
                            <select
                                value={animation.dependencyMode || "absolute"}
                                onChange={(event) =>
                                    updateSelectedElementStyle?.({
                                        animation: {
                                            ...animation,
                                            dependencyMode: event.target.value,
                                            ...(event.target.value === "absolute"
                                                ? { dependsOnId: "" }
                                                : {}),
                                        },
                                    })
                                }
                            >
                                <option value="absolute">On timeline</option>
                                <option value="afterStart">With previous</option>
                                <option value="afterEnd">After previous</option>
                            </select>
                        </label>

                        <div className="animation-speed-row">
                            <span>Speed</span>
                            <div>
                                <button
                                    type="button"
                                    className={animation.durationMs <= 700 ? "active" : ""}
                                    onClick={() => {
                                        updateSelectedElementStyle?.({
                                            animation: { ...animation, durationMs: 600 },
                                        });
                                    }}
                                >
                                    Fast
                                </button>
                                <button
                                    type="button"
                                    className={
                                        animation.durationMs > 700 &&
                                        animation.durationMs <= 1300
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => {
                                        updateSelectedElementStyle?.({
                                            animation: { ...animation, durationMs: 1000 },
                                        });
                                    }}
                                >
                                    Normal
                                </button>
                                <button
                                    type="button"
                                    className={animation.durationMs > 1300 ? "active" : ""}
                                    onClick={() => {
                                        updateSelectedElementStyle?.({
                                            animation: { ...animation, durationMs: 1800 },
                                        });
                                    }}
                                >
                                    Slow
                                </button>
                            </div>
                        </div>

                        <label className="animation-simple-field">
                            <span>Delay</span>
                            <div className="animation-delay-seconds">
                                <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    step="0.1"
                                    value={(
                                        (animation.dependencyMode === "absolute"
                                            ? animation.delayMs
                                            : animation.dependencyOffsetMs) / 1000
                                    ).toFixed(1)}
                                    onChange={(event) => {
                                        const milliseconds =
                                            Math.max(0, Number(event.target.value) || 0) * 1000;

                                        updateSelectedElementStyle?.({
                                            animation: {
                                                ...animation,
                                                ...(animation.dependencyMode === "absolute"
                                                    ? { delayMs: milliseconds }
                                                    : { dependencyOffsetMs: milliseconds }),
                                            },
                                        });
                                    }}
                                />
                                <em>sec</em>
                            </div>
                        </label>

                        {(animation.dependencyMode === "afterStart" ||
                            animation.dependencyMode === "afterEnd") && (
                            <label className="animation-simple-field">
                                <span className="animation-field-title-with-info">
                                    Select previous object
                                    <button
                                        type="button"
                                        className="animation-info-button"
                                        title="Choose the object whose animation should play before this object."
                                        aria-label="About previous object"
                                    >
                                        i
                                    </button>
                                </span>
                                <small className="animation-field-help">
                                    This animation starts relative to the object you select.
                                </small>
                                <select
                                    value={animation.dependsOnId || ""}
                                    onChange={(event) =>
                                        updateSelectedElementStyle?.({
                                            animation: {
                                                ...animation,
                                                dependsOnId: event.target.value,
                                            },
                                        })
                                    }
                                >
                                    <option value="">Select previous object…</option>
                                    {dependencyCandidates.map((item, index) => (
                                        <option key={item.id} value={item.id}>
                                            {getObjectLabel(item, index)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        {String(process.env.REACT_APP_SHOW_AUDIO || "false").toLowerCase() === "true" && (
                            <SidebarFrameAudioRecorder
                                frame={currentFrame}
                                frameIndex={currentFrameIndex}
                                onAudioSaved={onUpdateFrameAudio}
                                onAudioRemoved={onRemoveFrameAudio}
                            />
                        )}

                        <div className="animation-sidebar-actions">
                            <button
                                type="button"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new CustomEvent("sketchydraw:open-frame-animation-manager", {
                                            detail: { frameIndex: currentFrameIndex },
                                        })
                                    )
                                }
                            >
                                Manage frame animations
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new Event("sketchydraw:open-animation-storyboard")
                                    )
                                }
                            >
                                Preview frame
                            </button>
                            {!!currentFrame?.audioDataUrl && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        window.dispatchEvent(
                                            new CustomEvent("sketchydraw:export-video", {
                                                detail: {
                                                    timelineFrames: [currentFrame],
                                                    frameFrom: currentFrameIndex + 1,
                                                    frameTo: currentFrameIndex + 1,
                                                    totalFrames: 1,
                                                    mode: "server",
                                                    gapSeconds: 0,
                                                    preAnimationDelaySeconds: 0,
                                                    fileName: `sketchydraw-frame-${currentFrameIndex + 1}.mp4`,
                                                },
                                            })
                                        )
                                    }
                                >
                                    Export frame video
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            className="animation-advanced-toggle"
                            onClick={() => setAdvancedSequenceOpen((value) => !value)}
                        >
                            {advancedSequenceOpen ? "Hide advanced timing" : "Advanced timing"}
                            <span>{advancedSequenceOpen ? "⌃" : "⌄"}</span>
                        </button>

                        {advancedSequenceOpen && (
                            <div className="animation-advanced-panel">
                                <label className="animation-field">
                                    <span>Exact duration</span>
                                    <div className="animation-number-input">
                                        <input
                                            type="number"
                                            min="50"
                                            step="50"
                                            value={animation.durationMs}
                                            onChange={(event) =>
                                                updateSelectedElementStyle?.({
                                                    animation: {
                                                        ...animation,
                                                        durationMs: Math.max(
                                                            50,
                                                            Number(event.target.value) || 50
                                                        ),
                                                    },
                                                })
                                            }
                                        />
                                        <em>ms</em>
                                    </div>
                                </label>

                                <div className="visibility-choice-grid compact-visibility-grid">
                                    <button
                                        type="button"
                                        className={
                                            animation.beforeStart === "visible" &&
                                            animation.afterEnd === "visible"
                                                ? "active"
                                                : ""
                                        }
                                        onClick={() =>
                                            updateSelectedElementStyle?.({
                                                animation: {
                                                    ...animation,
                                                    beforeStart: "visible",
                                                    afterEnd: "visible",
                                                },
                                            })
                                        }
                                    >
                                        <strong>Always visible</strong>
                                    </button>
                                    <button
                                        type="button"
                                        className={
                                            animation.beforeStart === "hidden" &&
                                            animation.afterEnd === "visible"
                                                ? "active"
                                                : ""
                                        }
                                        onClick={() =>
                                            updateSelectedElementStyle?.({
                                                animation: {
                                                    ...animation,
                                                    beforeStart: "hidden",
                                                    afterEnd: "visible",
                                                },
                                            })
                                        }
                                    >
                                        <strong>Reveal on turn</strong>
                                    </button>
                                    <button
                                        type="button"
                                        className={
                                            animation.beforeStart === "hidden" &&
                                            animation.afterEnd === "hidden"
                                                ? "active"
                                                : ""
                                        }
                                        onClick={() =>
                                            updateSelectedElementStyle?.({
                                                animation: {
                                                    ...animation,
                                                    beforeStart: "hidden",
                                                    afterEnd: "hidden",
                                                },
                                            })
                                        }
                                    >
                                        <strong>Only while animating</strong>
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            className="animation-remove-button"
                            onClick={() =>
                                updateSelectedElementStyle?.({
                                    animation: {
                                        ...animation,
                                        type: "none",
                                        loop: false,
                                    },
                                })
                            }
                            disabled={animation.type === "none"}
                        >
                            Remove animation
                        </button>
                    </section>
                </div>
            )}

            {inspectorTab === "properties" && selectedElement && (
                <button
                    type="button"
                    className="delete-selected-btn"
                    onClick={deleteSelected}
                >
                    Delete Selected
                </button>
            )}
        </div>
    );
}
