import React, { useMemo, useState } from "react";
import "./GifToolbar.css";

const GIF_FPS_OPTIONS = [8, 12, 15, 24, 30];
const ORDER_DELAY_STEP_OPTIONS = [250, 500, 750, 1000];

function countAnimatedObjects(frame) {
    return (frame?.elements || []).filter(
        (element) => element?.animation?.type && element.animation.type !== "none"
    ).length;
}

function countObjects(frame) {
    return frame?.elements?.length || 0;
}

function getTotalAnimatedObjects(frames = []) {
    return frames.reduce((total, frame) => total + countAnimatedObjects(frame), 0);
}

function getCurrentFrame(frames, currentFrameIndex) {
    return frames?.[currentFrameIndex] || frames?.[0] || null;
}

export default function GifToolbar({
                                       frames = [],
                                       currentFrameIndex = 0,
                                       animationPlaying = false,
                                       animationTimeMs = 0,
                                       advanceMode = "enter",
                                       onAdvanceModeChange,
                                       onOpenFramesPanel,
                                       onOpenPlayer,
                                       onAddFrameAfter,
                                       onToggleFrameAnimation,
                                       onApplyFrameObjectOrderTiming,
                                       onMergeFrameWithNext,
                                       onMergeAllFrames,
                                   }) {
    const [collapsed, setCollapsed] = useState(false);
    const [fps, setFps] = useState(12);
    const [timingMode, setTimingMode] = useState("sequence");
    const [startDelayMs, setStartDelayMs] = useState(200);
    const [orderDelayStep, setOrderDelayStep] = useState(500);
    const [gapMs, setGapMs] = useState(120);
    const [overlapMs, setOverlapMs] = useState(250);

    const currentFrame = useMemo(
        () => getCurrentFrame(frames, currentFrameIndex),
        [frames, currentFrameIndex]
    );

    const objectCount = countObjects(currentFrame);
    const animatedCount = countAnimatedObjects(currentFrame);
    const totalAnimatedCount = getTotalAnimatedObjects(frames);
    const canMergeNext = currentFrameIndex < frames.length - 1;
    const canMergeAll = frames.length > 1;

    const handleApplyOrderTiming = () => {
        onApplyFrameObjectOrderTiming?.(currentFrameIndex, {
            mode: timingMode,
            startDelayMs: Number(startDelayMs) || 0,
            delayStepMs: Number(orderDelayStep) || 500,
            gapMs: Number(gapMs) || 0,
            overlapMs: Number(overlapMs) || 0,
        });
    };

    return (
        <section className={`gif-toolbar ${collapsed ? "collapsed" : ""}`}>
            <div className="gif-toolbar-main-row">
                <div className="gif-toolbar-title-box">
                    <strong>GIF Tools</strong>
                    <span>
                        Frame {currentFrameIndex + 1}/{Math.max(frames.length, 1)} · {objectCount} objects · {animatedCount} animated
                    </span>
                </div>

                <button
                    type="button"
                    className="gif-toolbar-toggle"
                    onClick={() => setCollapsed((value) => !value)}
                    title={collapsed ? "Show GIF tools" : "Hide GIF tools"}
                >
                    {collapsed ? "▾" : "▴"}
                </button>
            </div>

            {!collapsed && (
                <>
                    <div className="gif-toolbar-actions-row">
                        <button
                            type="button"
                            className="gif-toolbar-primary"
                            onClick={() => onOpenPlayer?.("current")}
                        >
                            Play screen
                        </button>

                        <button
                            type="button"
                            className="gif-toolbar-primary gif-toolbar-blue"
                            onClick={() => onOpenPlayer?.("all")}
                            disabled={!frames.length}
                        >
                            Play all
                        </button>

                        <button type="button" onClick={onOpenFramesPanel}>
                            Frames panel
                        </button>

                        <button type="button" onClick={onAddFrameAfter}>
                            + Frame
                        </button>

                        <button
                            type="button"
                            onClick={onToggleFrameAnimation}
                            title="Small preview in the normal canvas"
                        >
                            {animationPlaying ? "Stop preview" : "Small preview"}
                        </button>
                    </div>

                    <div className="gif-toolbar-settings-row">
                        <label>
                            After screen
                            <select
                                value={advanceMode}
                                onChange={(event) => onAdvanceModeChange?.(event.target.value)}
                            >
                                <option value="enter">Wait Enter</option>
                                <option value="auto">Auto next</option>
                            </select>
                        </label>

                        <label>
                            GIF FPS
                            <select
                                value={fps}
                                onChange={(event) => setFps(Number(event.target.value) || 12)}
                            >
                                {GIF_FPS_OPTIONS.map((value) => (
                                    <option value={value} key={value}>
                                        {value} fps
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Timing style
                            <select value={timingMode} onChange={(event) => setTimingMode(event.target.value)}>
                                <option value="sequence">Natural sequence</option>
                                <option value="stagger">Fixed stagger</option>
                            </select>
                        </label>

                        <label>
                            Start after
                            <input type="number" min="0" step="50" value={startDelayMs}
                                   onChange={(event) => setStartDelayMs(Number(event.target.value) || 0)} />
                        </label>

                        {timingMode === "stagger" ? (
                            <label>
                                Stagger
                                <select value={orderDelayStep} onChange={(event) => setOrderDelayStep(Number(event.target.value) || 500)}>
                                    {ORDER_DELAY_STEP_OPTIONS.map((value) => (
                                        <option value={value} key={value}>{value}ms</option>
                                    ))}
                                </select>
                            </label>
                        ) : (
                            <>
                                <label>
                                    Gap
                                    <input type="number" min="0" step="50" value={gapMs}
                                           onChange={(event) => setGapMs(Number(event.target.value) || 0)} />
                                </label>
                                <label>
                                    Overlap
                                    <input type="number" min="0" step="50" value={overlapMs}
                                           onChange={(event) => setOverlapMs(Number(event.target.value) || 0)} />
                                </label>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={handleApplyOrderTiming}
                            disabled={!animatedCount}
                            title="Apply delays based on object order in selected frame"
                        >
                            Apply smooth timing
                        </button>

                        <button
                            type="button"
                            onClick={onMergeFrameWithNext}
                            disabled={!canMergeNext}
                        >
                            Merge next
                        </button>

                        <button
                            type="button"
                            onClick={onMergeAllFrames}
                            disabled={!canMergeAll}
                        >
                            Merge all
                        </button>
                    </div>

                    <div className="gif-toolbar-status-row">
                        <span>Total frames: {frames.length || 1}</span>
                        <span>Total animated: {totalAnimatedCount}</span>
                        <span>Preview time: {Math.round(animationTimeMs)}ms</span>
                        <span>Export setting: {fps} fps</span>
                    </div>
                </>
            )}
        </section>
    );
}
