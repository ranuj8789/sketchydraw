import { createTimer, eases } from "animejs";

export const ANIME_3D_EASINGS = [
    { value: "linear", label: "Linear" },
    { value: "inOut", label: "Smooth in/out" },
    { value: "out", label: "Ease out" },
    { value: "in", label: "Ease in" },
    { value: "bounce", label: "Bounce" },
];

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function easeAnime3D(progress, easing = "inOut") {
    const t = clamp01(progress);
    try {
        if (easing === "linear") return t;
        if (easing === "in") return eases.in(3)(t);
        if (easing === "out") return eases.out(3)(t);
        if (easing === "bounce") return eases.outBounce(t);
        return eases.inOut(3)(t);
    } catch (_) {
        return t;
    }
}

export function getAnime3DTime(element, timeMs) {
    const durationMs = Math.max(100, Number(element?.motionDurationMs) || 2400);
    const rawTime = Math.max(0, Number(timeMs) || 0) * Math.max(.05, Number(element?.motionSpeed) || 1);
    const iteration = Math.floor(rawTime / durationMs);
    let progress = (rawTime % durationMs) / durationMs;
    const direction = element?.motionDirection || "alternate";
    if (direction === "reverse" || (direction === "alternate" && iteration % 2 === 1)) progress = 1 - progress;
    const eased = easeAnime3D(progress, element?.motionEasing || "inOut");
    return { durationMs, iteration, progress, eased, phase: eased * Math.PI * 2 };
}

export function createAnimeCanvasClock(onTick) {
    const timer = createTimer({
        duration: 60 * 60 * 1000,
        loop: true,
        frameRate: 60,
        onUpdate: (self) => onTick?.(Number(self.currentTime) || 0),
    });
    return {
        pause: () => timer.pause?.(),
        resume: () => timer.resume?.(),
        restart: () => timer.restart?.(),
        cancel: () => {
            if (typeof timer.cancel === "function") timer.cancel();
            else timer.pause?.();
        },
    };
}
