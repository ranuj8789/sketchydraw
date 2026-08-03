import React, { useEffect, useRef, useState } from "react";
import { renderCanvas } from "../../canvas/canvasRender";
import { createAnimationConfig, getAnimationPresetsForElement } from "../../canvas/animationRegistry";
import "./FramesPanel.css";

const SHOW_AUDIO_FEATURE =
    String(process.env.REACT_APP_SHOW_AUDIO || "false").toLowerCase() === "true";


function nameFor(frame, index) {
    return frame?.name || `Frame ${index + 1}`;
}


function getThumbnailViewport(canvasSize, canvasViewport, width, height) {
    const sourceWidth = Math.max(1, Number(canvasSize?.width) || 1200);
    const sourceHeight = Math.max(1, Number(canvasSize?.height) || 700);
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const contentWidth = sourceWidth * scale;
    const contentHeight = sourceHeight * scale;
    const padX = (width - contentWidth) / 2;
    const padY = (height - contentHeight) / 2;

    return {
        zoom: Math.max(0.01, Number(canvasViewport?.zoom) || 1) * scale,
        offsetX: (Number(canvasViewport?.offsetX) || 0) * scale + padX,
        offsetY: (Number(canvasViewport?.offsetY) || 0) * scale + padY,
    };
}

function FrameThumbnail({ frame, canvasSize, canvasViewport, canvasProps, active, onPlay }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const previewWidth = 260;
        const previewHeight = 150;
        const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        canvas.width = Math.round(previewWidth * pixelRatio);
        canvas.height = Math.round(previewHeight * pixelRatio);
        canvas.style.width = "100%";
        canvas.style.height = "100%";

        const context = canvas.getContext("2d");
        context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderCanvas({
            canvas,
            canvasSize: { width: previewWidth, height: previewHeight },
            elements: frame?.elements || [],
            selectedIds: [],
            connectionHint: null,
            alignmentGuides: [],
            viewport: getThumbnailViewport(canvasSize, canvasViewport, previewWidth, previewHeight),
            showGrid: false,
            canvasProps: canvasProps || {},
            renderOptions: {
                exportMode: true,
                animationMode: false,
                hiddenElementIds: new Set(frame?.hiddenElementIds || []),
            },
        });
    }, [frame, canvasSize, canvasViewport, canvasProps]);

    return (
        <div className={`frame-thumbnail ${active ? "active" : ""}`}>
            <canvas ref={canvasRef} aria-label="Frame preview" />
            <button
                type="button"
                className="frame-thumbnail-play"
                title="Play this frame"
                onClick={(event) => {
                    event.stopPropagation();
                    onPlay?.();
                }}
            >
                ▶
            </button>
        </div>
    );
}


function FrameAudioRecorder({
                                frame,
                                frameIndex,
                                onUpdateFrameAudio,
                                onRemoveFrameAudio,
                            }) {
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const startedAtRef = useRef(0);
    const [recording, setRecording] = useState(false);
    const [error, setError] = useState("");

    const stopTracks = () => {
        streamRef.current?.getTracks?.().forEach((track) => track.stop());
        streamRef.current = null;
    };

    useEffect(() => () => stopTracks(), []);

    const startRecording = async () => {
        setError("");

        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setError("Audio recording is not supported in this browser.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            const recorder = new MediaRecorder(stream);
            streamRef.current = stream;
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            startedAtRef.current = Date.now();

            recorder.ondataavailable = (event) => {
                if (event.data?.size) chunksRef.current.push(event.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });
                const reader = new FileReader();

                reader.onloadend = () => {
                    onUpdateFrameAudio?.(
                        frameIndex,
                        String(reader.result || ""),
                        {
                            name: `Frame ${frameIndex + 1} narration`,
                            durationMs: Date.now() - startedAtRef.current,
                        }
                    );
                };

                reader.readAsDataURL(blob);
                stopTracks();
                setRecording(false);
            };

            recorder.start();
            setRecording(true);
        } catch (recordingError) {
            console.error(recordingError);
            setError("Microphone permission was denied.");
            stopTracks();
            setRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
    };

    return (
        <div className="frame-audio-recorder" onClick={(event) => event.stopPropagation()}>
            {frame?.audioDataUrl ? (
                <>
                    <audio controls src={frame.audioDataUrl} preload="metadata" />
                    <button
                        type="button"
                        onClick={() => onRemoveFrameAudio?.(frameIndex)}
                    >
                        Remove audio
                    </button>
                </>
            ) : (
                <button
                    type="button"
                    className={recording ? "recording" : ""}
                    onClick={recording ? stopRecording : startRecording}
                >
                    {recording ? "■ Stop recording" : "● Record audio"}
                </button>
            )}
            {error && <small className="frame-audio-error">{error}</small>}
        </div>
    );
}


function frameObjectLabel(element, index) {
    const text = String(element?.text || element?.label || "").trim();
    if (text) return text.length > 36 ? `${text.slice(0, 36)}…` : text;
    return `${element?.type || "Object"} ${index + 1}`;
}

function FrameAnimationDialog({
                                  open,
                                  frame,
                                  frameIndex,
                                  onClose,
                                  onUpdateFrameElementAnimation,
                                  onUpdateFrameAudio,
                                  onRemoveFrameAudio,
                                  onPreview,
                              }) {
    const objects = (frame?.elements || []).filter((element) => element?.id);
    const [selectedElementId, setSelectedElementId] = useState("");

    useEffect(() => {
        if (!open) return;
        const valid = objects.some((item) => item.id === selectedElementId);
        if (!valid) setSelectedElementId(objects[0]?.id || "");
    }, [open, frame?.id, selectedElementId, objects]);

    if (!open) return null;

    const selected =
        objects.find((item) => item.id === selectedElementId) ||
        objects[0] ||
        null;

    const animation = {
        ...createAnimationConfig("none"),
        ...(selected?.animation || {}),
    };

    const presets = selected
        ? getAnimationPresetsForElement(selected)
        : [];

    const previousObjects = objects.filter(
        (item) => item.id !== selected?.id
    );

    const patchAnimation = (patch) => {
        if (!selected?.id) return;
        onUpdateFrameElementAnimation?.(
            frameIndex,
            selected.id,
            patch
        );
    };

    return (
        <div className="frame-animation-dialog-backdrop" onMouseDown={onClose}>
            <section
                className="frame-animation-dialog"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header>
                    <div>
                        <span>FRAME ANIMATION</span>
                        <h3>{frame?.name || `Frame ${frameIndex + 1}`}</h3>
                        <p>
                            Add, order and preview animations for this frame.
                            Animation data is saved inside the drawing JSON.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}>×</button>
                </header>

                <div className="frame-animation-dialog-body">
                    <aside className="frame-animation-object-list">
                        <strong>Objects</strong>
                        {objects.map((element, index) => (
                            <button
                                key={element.id}
                                type="button"
                                className={
                                    element.id === selected?.id ? "active" : ""
                                }
                                onClick={() => setSelectedElementId(element.id)}
                            >
                                <span>{index + 1}</span>
                                <div>
                                    <b>{frameObjectLabel(element, index)}</b>
                                    <small>
                                        {element?.animation?.type &&
                                        element.animation.type !== "none"
                                            ? element.animation.type
                                            : "No animation"}
                                    </small>
                                </div>
                            </button>
                        ))}
                        {!objects.length && <p>No objects in this frame.</p>}
                    </aside>

                    <main className="frame-animation-editor">
                        {selected ? (
                            <>
                                <div className="frame-animation-editor-head">
                                    <div>
                                        <span>Selected object</span>
                                        <strong>
                                            {frameObjectLabel(
                                                selected,
                                                objects.findIndex(
                                                    (item) => item.id === selected.id
                                                )
                                            )}
                                        </strong>
                                    </div>
                                    <button
                                        type="button"
                                        className="frame-animation-preview-btn"
                                        onClick={onPreview}
                                    >
                                        ▶ Preview frame
                                    </button>
                                </div>

                                <section>
                                    <h4>Choose animation</h4>
                                    <div className="frame-animation-preset-grid">
                                        {presets.map((preset) => (
                                            <button
                                                key={preset.type}
                                                type="button"
                                                className={
                                                    animation.type === preset.type
                                                        ? "active"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    patchAnimation({
                                                        type: preset.type,
                                                        durationMs:
                                                            preset.type === "none"
                                                                ? animation.durationMs
                                                                : preset.durationMs ||
                                                                animation.durationMs,
                                                        loop: !!preset.loop,
                                                    })
                                                }
                                            >
                                                <b>
                                                    {animation.type === preset.type &&
                                                    preset.type !== "none"
                                                        ? "✓ "
                                                        : ""}
                                                    {preset.label}
                                                </b>
                                                <small>
                                                    {preset.type === "none"
                                                        ? "Remove animation"
                                                        : "Apply effect"}
                                                </small>
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                <section className="frame-animation-timing">
                                    <h4>Timing</h4>

                                    <label>
                                        <span>Start</span>
                                        <select
                                            value={
                                                animation.dependencyMode ||
                                                "absolute"
                                            }
                                            onChange={(event) =>
                                                patchAnimation({
                                                    dependencyMode:
                                                    event.target.value,
                                                    ...(event.target.value ===
                                                    "absolute"
                                                        ? { dependsOnId: "" }
                                                        : {}),
                                                })
                                            }
                                        >
                                            <option value="absolute">
                                                On timeline
                                            </option>
                                            <option value="afterStart">
                                                With previous
                                            </option>
                                            <option value="afterEnd">
                                                After previous
                                            </option>
                                        </select>
                                    </label>

                                    {(animation.dependencyMode === "afterStart" ||
                                        animation.dependencyMode === "afterEnd") && (
                                        <label>
                                            <span className="frame-animation-label-with-info">
                                                Select previous object
                                                <i title="This object will animate relative to the selected previous object.">
                                                    i
                                                </i>
                                            </span>
                                            <select
                                                value={animation.dependsOnId || ""}
                                                onChange={(event) =>
                                                    patchAnimation({
                                                        dependsOnId:
                                                        event.target.value,
                                                    })
                                                }
                                            >
                                                <option value="">
                                                    Select previous object…
                                                </option>
                                                {previousObjects.map(
                                                    (element, index) => (
                                                        <option
                                                            key={element.id}
                                                            value={element.id}
                                                        >
                                                            {frameObjectLabel(
                                                                element,
                                                                index
                                                            )}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </label>
                                    )}

                                    <label>
                                        <span>Duration</span>
                                        <div>
                                            <input
                                                type="number"
                                                min="0.1"
                                                step="0.1"
                                                value={(
                                                    (Number(animation.durationMs) ||
                                                        1000) / 1000
                                                ).toFixed(1)}
                                                onChange={(event) =>
                                                    patchAnimation({
                                                        durationMs: Math.max(
                                                            100,
                                                            Math.round(
                                                                Number(
                                                                    event.target.value
                                                                ) * 1000
                                                            )
                                                        ),
                                                    })
                                                }
                                            />
                                            <em>sec</em>
                                        </div>
                                    </label>

                                    <label>
                                        <span>Delay</span>
                                        <div>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={(
                                                    (Number(
                                                        animation.dependencyMode ===
                                                        "absolute"
                                                            ? animation.delayMs
                                                            : animation.dependencyOffsetMs
                                                    ) || 0) / 1000
                                                ).toFixed(1)}
                                                onChange={(event) => {
                                                    const value = Math.max(
                                                        0,
                                                        Math.round(
                                                            Number(
                                                                event.target.value
                                                            ) * 1000
                                                        )
                                                    );
                                                    patchAnimation(
                                                        animation.dependencyMode ===
                                                        "absolute"
                                                            ? { delayMs: value }
                                                            : {
                                                                dependencyOffsetMs:
                                                                value,
                                                            }
                                                    );
                                                }}
                                            />
                                            <em>sec</em>
                                        </div>
                                    </label>
                                </section>

                                {SHOW_AUDIO_FEATURE && (
                                    <section className="frame-animation-audio-section">
                                        <div>
                                            <h4>Frame narration</h4>
                                            <p>Record audio and preview it with this frame.</p>
                                        </div>
                                        <FrameAudioRecorder
                                            frame={frame}
                                            frameIndex={frameIndex}
                                            onUpdateFrameAudio={onUpdateFrameAudio}
                                            onRemoveFrameAudio={onRemoveFrameAudio}
                                        />
                                        {!!frame?.audioDataUrl && (
                                            <button
                                                type="button"
                                                className="frame-animation-export-video-btn"
                                                onClick={() =>
                                                    window.dispatchEvent(
                                                        new CustomEvent("sketchydraw:export-video", {
                                                            detail: {
                                                                timelineFrames: [frame],
                                                                frameFrom: frameIndex + 1,
                                                                frameTo: frameIndex + 1,
                                                                totalFrames: 1,
                                                                mode: "server",
                                                                gapSeconds: 0,
                                                                preAnimationDelaySeconds: 0,
                                                                fileName: `sketchydraw-frame-${frameIndex + 1}.mp4`,
                                                            },
                                                        })
                                                    )
                                                }
                                            >
                                                Export this frame as MP4
                                            </button>
                                        )}
                                    </section>
                                )}

                                <button
                                    type="button"
                                    className="frame-animation-remove-btn"
                                    disabled={animation.type === "none"}
                                    onClick={() =>
                                        patchAnimation({
                                            type: "none",
                                            loop: false,
                                            dependsOnId: "",
                                        })
                                    }
                                >
                                    Remove animation
                                </button>
                            </>
                        ) : (
                            <div className="frame-animation-empty">
                                Add an object to this frame first.
                            </div>
                        )}
                    </main>
                </div>

                <footer>
                    <span>
                        {objects.filter(
                            (item) =>
                                item?.animation?.type &&
                                item.animation.type !== "none"
                        ).length}{" "}
                        animated objects in this frame
                    </span>
                    <button type="button" onClick={onClose}>Done</button>
                </footer>
            </section>

        </div>
    );
}

export default function FramesPanel({
                                        open,
                                        frames = [],
                                        currentIndex = 0,
                                        canvasSize,
                                        canvasViewport,
                                        canvasProps,
                                        onClose,
                                        onSelectFrame,
                                        onAddFrameAfter,
                                        onDeleteFrame,
                                        onReorderFrames,
                                        onUpdateFrame,
                                        onUpdateFrameElementAnimation,
                                        onUpdateFrameAudio,
                                        onRemoveFrameAudio,
                                        onUndoFrameAction,
                                        canUndoFrameAction = false,
                                        onMergeFrameWithNext,
                                        onPlayCurrent,
                                        onPlayAll,
                                    }) {
    const [animationDialogFrameIndex, setAnimationDialogFrameIndex] =
        useState(null);

    useEffect(() => {
        const handleOpenAnimationManager = (event) => {
            const requested = Number(event?.detail?.frameIndex);
            const index = Number.isFinite(requested)
                ? Math.max(0, Math.min(requested, Math.max(0, frames.length - 1)))
                : currentIndex;
            setAnimationDialogFrameIndex(index);
        };

        window.addEventListener(
            "sketchydraw:open-frame-animation-manager",
            handleOpenAnimationManager
        );

        return () =>
            window.removeEventListener(
                "sketchydraw:open-frame-animation-manager",
                handleOpenAnimationManager
            );
    }, [currentIndex, frames.length]);

    if (!open) return null;

    const move = (from, direction) => {
        const to = direction === "up" ? from - 1 : from + 1;
        if (to >= 0 && to < frames.length) onReorderFrames?.(from, to);
    };

    return (
        <div className="frames-panel-backdrop" onMouseDown={onClose}>
            <section className="frames-manager-dialog" onMouseDown={(event) => event.stopPropagation()}>
                <header className="frames-manager-head">
                    <div>
                        <span>STORYBOARD</span>
                        <h2>Manage frames</h2>
                        <p>{SHOW_AUDIO_FEATURE
                            ? "Set frame order, timing, transitions, audio and object animations."
                            : "Set frame order, timing, transitions and object animations."}</p>
                    </div>
                    <button type="button" className="frames-close-btn" onClick={onClose}>×</button>
                </header>

                <div className="frames-manager-toolbar">
                    <button type="button" className="frames-gold-btn" onClick={onPlayAll}>▶ Play all</button>
                    <button type="button" onClick={onPlayCurrent}>▶ Play selected</button>
                    <button type="button" onClick={onAddFrameAfter}>＋ Add frame</button>
                    <button
                        type="button"
                        onClick={() =>
                            setAnimationDialogFrameIndex(currentIndex)
                        }
                    >
                        ✦ Manage animation
                    </button>
                    <button
                        type="button"
                        disabled={!canUndoFrameAction}
                        onClick={onUndoFrameAction}
                        title="Restore frames before the most recent merge"
                    >
                        ↶ Undo merge
                    </button>
                </div>

                <div className="frames-common-list">
                    <div className={`frames-common-head ${SHOW_AUDIO_FEATURE ? "has-audio" : "no-audio"}`}>
                        <span>Order</span><span>Preview</span><span>Frame</span><span>Duration</span><span>Gap</span><span>Transition</span><span>Animation</span><span>Actions</span>
                    </div>
                    {frames.map((frame, index) => (
                        <div
                            key={frame.id || index}
                            className={`frames-common-row ${SHOW_AUDIO_FEATURE ? "has-audio" : "no-audio"} ${index === currentIndex ? "active" : ""}`}
                            onClick={() => onSelectFrame?.(index)}
                        >
                            <div className="frames-order-controls">
                                <strong>{index + 1}</strong>
                                <button type="button" disabled={index === 0} onClick={(event) => { event.stopPropagation(); move(index, "up"); }}>↑</button>
                                <button type="button" disabled={index === frames.length - 1} onClick={(event) => { event.stopPropagation(); move(index, "down"); }}>↓</button>
                            </div>
                            <FrameThumbnail
                                frame={frame}
                                canvasSize={canvasSize}
                                canvasViewport={canvasViewport}
                                canvasProps={canvasProps}
                                active={index === currentIndex}
                                onPlay={() => {
                                    onSelectFrame?.(index);
                                    window.setTimeout(() => onPlayCurrent?.(), 0);
                                }}
                            />
                            <div className="frames-name-cell">
                                <input value={nameFor(frame, index)} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateFrame?.(index, { name: event.target.value })}/>
                                <small>{frame?.elements?.length || 0} objects</small>
                                <FrameAudioRecorder
                                    frame={frame}
                                    frameIndex={index}
                                    onUpdateFrameAudio={onUpdateFrameAudio}
                                    onRemoveFrameAudio={onRemoveFrameAudio}
                                />
                            </div>
                            <label><input type="number" min="0.5" step="0.1" value={((Number(frame.durationMs) || 1300) / 1000).toFixed(1)} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateFrame?.(index, { durationMs: Math.round(Number(event.target.value) * 1000) })}/><span>s</span></label>
                            <label><input type="number" min="0" step="0.1" value={((Number(frame.gapAfterMs) || 0) / 1000).toFixed(1)} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateFrame?.(index, { gapAfterMs: Math.round(Number(event.target.value) * 1000) })}/><span>s</span></label>
                            <select value={frame.transition || "none"} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateFrame?.(index, { transition: event.target.value })}>
                                <option value="none">None</option><option value="fade">Fade</option><option value="slide">Slide</option>
                            </select>
                            <button
                                type="button"
                                className="frames-animation-manage-btn"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSelectFrame?.(index);
                                    setAnimationDialogFrameIndex(index);
                                }}
                            >
                                ✦ {
                                (frame?.elements || []).filter(
                                    (element) =>
                                        element?.animation?.type &&
                                        element.animation.type !== "none"
                                ).length
                            } animations
                            </button>
                            <div className="frames-row-actions">
                                <button type="button" disabled={index === frames.length - 1} onClick={(event) => { event.stopPropagation(); onMergeFrameWithNext?.(index); }}>Merge next</button>
                                <button type="button" className="danger-link" disabled={frames.length <= 1} onClick={(event) => { event.stopPropagation(); onDeleteFrame?.(index); }}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>

                <footer className="frames-manager-footer">
                    <span>{frames.length || 1} frames · Drag/order controls define presentation order.</span>
                    <button type="button" onClick={onClose}>Done</button>
                </footer>
            </section>

            <FrameAnimationDialog
                open={animationDialogFrameIndex !== null}
                frame={animationDialogFrameIndex !== null ? frames[animationDialogFrameIndex] : null}
                frameIndex={animationDialogFrameIndex !== null ? animationDialogFrameIndex : currentIndex}
                onClose={() => setAnimationDialogFrameIndex(null)}
                onUpdateFrameElementAnimation={onUpdateFrameElementAnimation}
                onUpdateFrameAudio={onUpdateFrameAudio}
                onRemoveFrameAudio={onRemoveFrameAudio}
                onPreview={() => {
                    const index = animationDialogFrameIndex !== null
                        ? animationDialogFrameIndex
                        : currentIndex;
                    onSelectFrame?.(index);
                    window.setTimeout(() => onPlayCurrent?.(), 0);
                }}
            />
        </div>
    );
}
