import React, { useState } from "react";
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

  return (
    <section className={`storyboard-bar ${expanded ? "expanded" : "collapsed"}`}>
      <div className="storyboard-head">
        <button
          type="button"
          className="storyboard-collapse"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Collapse storyboard" : "Expand storyboard"}
        >
          {expanded ? "⌄" : "⌃"}
        </button>
        <div className="storyboard-title">
          <strong>Storyboard</strong>
          <span>{frames.length || 1} frames</span>
        </div>
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
