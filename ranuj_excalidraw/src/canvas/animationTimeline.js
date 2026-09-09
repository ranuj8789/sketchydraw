function clampMs(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export const DEFAULT_TIMELINE_PLAYBACK_SPEED = 0.5;
export const TIMELINE_PLAYBACK_SPEED_OPTIONS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2];

export function normalizeTimelinePlaybackSpeed(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
      ? Math.max(0.1, Math.min(4, parsed))
      : DEFAULT_TIMELINE_PLAYBACK_SPEED;
}

export function getTimelineSourceTimeMs(elapsedMs, playbackSpeed) {
  return Math.max(0, Number(elapsedMs) || 0) * normalizeTimelinePlaybackSpeed(playbackSpeed);
}

export function getTimelinePlaybackDurationMs(sourceDurationMs, playbackSpeed) {
  return Math.max(1, Number(sourceDurationMs) || 0) / normalizeTimelinePlaybackSpeed(playbackSpeed);
}

export function resolveFrameAnimationTimings(elements = []) {
  const byId = new Map((elements || []).filter(Boolean).map((element) => [element.id, element]));
  const cache = new Map();
  const visiting = new Set();

  const resolve = (element) => {
    if (!element?.id) return { startMs: 0, endMs: 0, durationMs: 0 };
    if (cache.has(element.id)) return cache.get(element.id);

    const animation = element.animation || {};
    const durationMs = animation.type && animation.type !== "none"
        ? Math.max(1, clampMs(animation.durationMs, 1000))
        : 0;
    const ownDelayMs = clampMs(animation.delayMs, 0);
    const dependencyId = animation.dependsOnId;
    const dependencyMode = animation.dependencyMode || "absolute";
    const dependencyOffsetMs = clampMs(animation.dependencyOffsetMs, 0);

    if (!dependencyId || dependencyMode === "absolute" || !byId.has(dependencyId) || visiting.has(element.id)) {
      const result = { startMs: ownDelayMs, endMs: ownDelayMs + durationMs, durationMs };
      cache.set(element.id, result);
      return result;
    }

    visiting.add(element.id);
    const dependency = resolve(byId.get(dependencyId));
    visiting.delete(element.id);

    const anchorMs = dependencyMode === "afterStart" ? dependency.startMs : dependency.endMs;
    const startMs = anchorMs + dependencyOffsetMs;
    const result = { startMs, endMs: startMs + durationMs, durationMs };
    cache.set(element.id, result);
    return result;
  };

  (elements || []).forEach(resolve);
  return cache;
}

export function getFrameTimelineEndMs(elements = []) {
  const timings = resolveFrameAnimationTimings(elements);
  let endMs = 0;
  timings.forEach((timing) => { endMs = Math.max(endMs, timing.endMs); });
  return endMs;
}

export function getFramePlaybackDurationMs(frame, staticFallbackMs = 1300) {
  const elements = frame?.elements || [];
  const cameraEndMs = (Array.isArray(frame?.cameraKeyframes) ? frame.cameraKeyframes : [])
      .reduce((maximum, key) => Math.max(maximum, clampMs(key?.timeMs, 0) + clampMs(key?.holdMs, 0)), 0);
  const hasAnimatedElements = elements.some(
      (element) => element?.animation?.type && element.animation.type !== "none"
  );

  if (hasAnimatedElements) {
    return Math.max(1, getFrameTimelineEndMs(elements), cameraEndMs);
  }

  const authoredDurationMs = Number(frame?.durationMs);
  return Math.max(cameraEndMs, Number.isFinite(authoredDurationMs) && authoredDurationMs > 0
      ? authoredDurationMs
      : staticFallbackMs);
}

export function isElementVisibleAtTime(element, timeMs, timing) {
  const animation = element?.animation || {};
  const type = animation.type || "none";
  if (type === "none") return animation.staticVisible !== false;

  const startMs = timing?.startMs ?? clampMs(animation.delayMs, 0);
  const endMs = timing?.endMs ?? startMs + Math.max(1, clampMs(animation.durationMs, 1000));
  const beforeStart = animation.beforeStart || "hidden";
  const afterEnd = animation.afterEnd || "visible";

  if (timeMs < startMs) return beforeStart === "visible";
  if (timeMs > endMs) return afterEnd !== "hidden";
  return true;
}
