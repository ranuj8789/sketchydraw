import React, { useEffect, useRef, useState } from "react";
import "./StoryboardBar.css";

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
                                        onPlayCurrent,
                                        onReorderFrames,
                                      }) {
  const [expanded, setExpanded] = useState(true);
  const [dragIndex, setDragIndex] = useState(null);
  const [autoHidden, setAutoHidden] = useState(false);
  const [pinned, setPinned] = useState(() => localStorage.getItem("sketchydraw.storyboardPinned") === "true");
  const hideTimerRef = useRef(null);

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
    return clearHideTimer;
  }, [expanded, currentIndex, frames.length, pinned]);

  const handlePointerEnter = () => {
    clearHideTimer();
    setAutoHidden(false);
  };

  const handlePointerLeave = () => {
    scheduleAutoHide();
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
          className={`storyboard-bar ${expanded ? "expanded" : "collapsed"} ${autoHidden ? "peek" : ""} ${pinned ? "pinned" : ""}`}
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
            <strong>Storyboard</strong>
            <span>{frames.length || 1} frames</span>
          </div>
          <button
              type="button"
              className={`storyboard-pin ${pinned ? "active" : ""}`}
              onClick={togglePinned}
              aria-pressed={pinned}
              title={pinned ? "Unpin storyboard and auto-hide after 5 seconds" : "Pin storyboard open"}
          >
            {pinned ? "📌 Pinned" : "📍 Pin"}
          </button>
          <div className="storyboard-actions">
            <button type="button" onClick={onPlayCurrent}>▶ Play frame</button>
            <button type="button" className="storyboard-present" onClick={onPresent}>▶ Play all</button>
            <button type="button" onClick={onOpenManager}>Manage</button>
          </div>
        </div>

        {expanded && (
            <div className="storyboard-track" role="list" aria-label="Frame order">
              {frames.map((frame, index) => (
                  <React.Fragment key={frame.id || index}>
                    <button
                        type="button"
                        draggable
                        className={`storyboard-frame ${index === currentIndex ? "active" : ""}`}
                        onClick={() => onSelectFrame?.(index)}
                        onDragStart={() => setDragIndex(index)}
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
              <button type="button" className="storyboard-add" onClick={onAddFrame}>＋ Add frame</button>
            </div>
        )}
      </section>
  );
}
