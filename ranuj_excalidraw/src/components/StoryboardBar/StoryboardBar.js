import React, { useEffect, useRef, useState } from "react";
import "./StoryboardBar.css";
import { hasProAccess, requestProUpgrade } from "../../utils/proFeatureGate";

function frameName(frame, index) {
  return frame?.name || `Frame ${index + 1}`;
}

export default function StoryboardBar({
                                        frames = [],
                                        currentIndex = 0,
                                        onSelectFrame,
                                        onAddFrame,
                                        onOpenManager,
                                        onPresent,
                                        onPreviousFrame,
                                        onNextFrame,
                                        onPlayCurrent,
                                        onMergeAll,
                                        onUndoFrameAction,
                                        canUndoFrameAction = false,
                                        onReorderFrames,
                                      }) {
  const [expanded, setExpanded] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const proUser = hasProAccess();
  const proAction = (feature, action) => {
    if (!proUser) {
      requestProUpgrade(feature);
      return;
    }
    action?.();
  };
  const [autoHidden, setAutoHidden] = useState(false);
  const [pinned, setPinned] = useState(() => localStorage.getItem("sketchydraw.storyboardPinned") === "true");
  const hideTimerRef = useRef(null);
  const hoverOpenTimerRef = useRef(null);
  const hoverCloseTimerRef = useRef(null);

  const clearHoverTimers = () => {
    if (hoverOpenTimerRef.current) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleAutoHide = () => {
    clearHideTimer();
    if (!expanded || pinned) return;
    hideTimerRef.current = window.setTimeout(() => {
      setAutoHidden(true);
    }, 5000);
  };

  useEffect(() => {
    setAutoHidden(false);
    scheduleAutoHide();
    return () => {
      clearHideTimer();
      clearHoverTimers();
    };
  }, [expanded, currentIndex, frames.length, pinned]);

  const handlePointerEnter = () => {
    clearHideTimer();
    clearHoverTimers();
    setAutoHidden(false);
    hoverOpenTimerRef.current = window.setTimeout(() => {
      setHoverOpen(true);
    }, 250);
  };

  const handlePointerLeave = () => {
    clearHoverTimers();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setHoverOpen(false);
      scheduleAutoHide();
    }, 200);
  };

  const togglePinned = () => {
    setPinned((current) => {
      const next = !current;
      localStorage.setItem("sketchydraw.storyboardPinned", String(next));
      if (next) {
        clearHideTimer();
        setAutoHidden(false);
        setExpanded(true);
      } else {
        window.setTimeout(scheduleAutoHide, 0);
      }
      return next;
    });
  };

  return (
      <section
          className={`storyboard-bar ${expanded || hoverOpen || pinned ? "expanded" : "collapsed"} ${autoHidden ? "peek" : ""} ${hoverOpen ? "hover-open" : ""} ${pinned ? "pinned" : ""} ${!proUser ? "pro-locked" : ""}`}
          onMouseEnter={handlePointerEnter}
          onMouseLeave={handlePointerLeave}
          onFocusCapture={handlePointerEnter}
          onBlurCapture={handlePointerLeave}
      >
        <div className="storyboard-head">
          <button
              type="button"
              className="storyboard-collapse"
              onClick={() => {
                setExpanded((value) => !value);
                setAutoHidden(false);
              }}
              aria-label={expanded ? "Collapse storyboard" : "Expand storyboard"}
              title={expanded ? "Collapse storyboard" : "Expand storyboard"}
          >
            {expanded ? "⌄" : "⌃"}
          </button>
          <div className="storyboard-title">
            <strong>Frames {!proUser && <small className="storyboard-pro-badge">PRO</small>}</strong>
            <span>{Math.min(currentIndex + 1, frames.length || 1)} / {frames.length || 1}</span>
          </div>
          <button
              type="button"
              className={`storyboard-pin ${pinned ? "active" : ""}`}
              onClick={togglePinned}
              aria-pressed={pinned}
              title={pinned ? "Unpin storyboard and auto-hide after 5 seconds" : "Pin storyboard open"}
          >
            {pinned ? "📌" : "📍"}
          </button>
          <div className="storyboard-actions">
            <div className="storyboard-presentation-cluster" aria-label="Frame presentation controls">
              <button
                  type="button"
                  className="storyboard-step"
                  onClick={() => proAction("Frames", onPreviousFrame)}
                  disabled={proUser && currentIndex <= 0}
                  title="Previous frame"
              >
                ‹
              </button>
              <button
                  type="button"
                  className="storyboard-present"
                  onClick={() => proAction("Presentation and frame playback", onPresent)}
                  title="Present all frames"
              >
                ▶ Present
              </button>
              <button
                  type="button"
                  className="storyboard-step"
                  onClick={() => proAction("Frames", onNextFrame)}
                  disabled={proUser && currentIndex >= Math.max(0, frames.length - 1)}
                  title="Next frame"
              >
                ›
              </button>
              <button
                  type="button"
                  className="storyboard-frame-count"
                  onClick={() => proAction("Frames", onOpenManager)}
                  title="Open frame manager"
              >
                {Math.min(currentIndex + 1, frames.length || 1)} / {frames.length || 1}
              </button>
            </div>
            <span className="storyboard-action-divider" aria-hidden="true" />
            <button type="button" onClick={() => proAction("Frame playback", onPlayCurrent)}>▶ Play frame</button>
            <button type="button" className="storyboard-play-all" onClick={() => proAction("Presentation and frame playback", onPresent)}>▶ Play all</button>
            <button type="button" className="storyboard-merge-all" disabled={frames.length <= 1} onClick={() => proAction("Merge frames", onMergeAll)}>Merge all</button>
            <button
                type="button"
                className="storyboard-undo-frame-action"
                disabled={!canUndoFrameAction}
                onClick={onUndoFrameAction}
                title="Undo the most recent frame merge"
            >
              ↶ Undo merge
            </button>
            <button type="button" onClick={() => proAction("Frames", onOpenManager)}>Manage</button>
          </div>
        </div>

        {(expanded || hoverOpen || pinned) && (
            <div className="storyboard-track" role="list" aria-label="Frame order">
              {frames.map((frame, index) => (
                  <React.Fragment key={frame.id || index}>
                    <button
                        type="button"
                        className={`storyboard-frame ${index === currentIndex ? "active" : ""}`}
                        onClick={() => proAction("Frames", () => onSelectFrame?.(index))}
                        draggable={proUser}
                        onDragStart={() => proUser && setDragIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (dragIndex !== null && dragIndex !== index) {
                            onReorderFrames?.(dragIndex, index);
                          }
                          setDragIndex(null);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                    >
                      <span className="storyboard-frame-number">{index + 1}</span>
                      <span className="storyboard-frame-copy">
                  <strong>{frameName(frame, index)}</strong>
                  <small>{Math.max(0.5, (Number(frame.durationMs) || 1300) / 1000).toFixed(1)}s</small>
                </span>
                    </button>
                    {index < frames.length - 1 && (
                        <span className="storyboard-gap" title={`${(Number(frame.gapAfterMs) || 0) / 1000}s gap`}>
                  →
                  <small>{((Number(frame.gapAfterMs) || 0) / 1000).toFixed(1)}s</small>
                </span>
                    )}
                  </React.Fragment>
              ))}
              <button type="button" className="storyboard-add" onClick={() => proAction("Frames", onAddFrame)}>＋ Add frame</button>
            </div>
        )}
      </section>
  );
}
