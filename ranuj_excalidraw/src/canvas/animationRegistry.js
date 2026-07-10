import { SYSTEM_DESIGN_TYPES } from "./canvasConstants";

export const DEFAULT_ANIMATION_DURATION_MS = 1000;

export const ANIMATION_PRESETS = [
    {
        type: "none",
        label: "None",
        description: "Remove animation",
        compatibleTypes: ["all"],
        durationMs: DEFAULT_ANIMATION_DURATION_MS,
    },
    {
        type: "draw",
        label: "Draw",
        description: "Object draws itself",
        compatibleTypes: ["line", "arrow", "pencil", "rect", "rectangle", "ellipse", "diamond", "user", ...SYSTEM_DESIGN_TYPES],
        durationMs: 1000,
    },
    {
        type: "movingHead",
        label: "Moving head",
        description: "Arrow head travels on the path",
        compatibleTypes: ["line", "arrow"],
        durationMs: 1200,
        loop: true,
    },
    {
        type: "movingDashes",
        label: "Moving dashes",
        description: "Marching ants / flow line",
        compatibleTypes: ["line", "arrow", "rect", "rectangle", "ellipse", "diamond", "user", ...SYSTEM_DESIGN_TYPES],
        durationMs: 1200,
        loop: true,
    },
    {
        type: "pulse",
        label: "Pulse",
        description: "Object grows and shrinks softly",
        compatibleTypes: ["all"],
        durationMs: 900,
        loop: true,
    },
    {
        type: "glow",
        label: "Glow",
        description: "Highlighted glow around object",
        compatibleTypes: ["all"],
        durationMs: 1000,
        loop: true,
    },
    {
        type: "pulseRing",
        label: "Pulse ring",
        description: "Expanding ring around object",
        compatibleTypes: ["rect", "rectangle", "ellipse", "diamond", "user", ...SYSTEM_DESIGN_TYPES, "text", "image"],
        durationMs: 1100,
        loop: true,
    },
    {
        type: "spotlight",
        label: "Spotlight",
        description: "Soft focus highlight behind object",
        compatibleTypes: ["rect", "rectangle", "ellipse", "diamond", "user", ...SYSTEM_DESIGN_TYPES, "text", "image"],
        durationMs: 1200,
        loop: true,
    },
    {
        type: "fadeIn",
        label: "Fade in",
        description: "Appears gradually",
        compatibleTypes: ["all"],
        durationMs: 900,
    },
    {
        type: "slideUp",
        label: "Slide up",
        description: "Comes from below",
        compatibleTypes: ["all"],
        durationMs: 900,
    },
    {
        type: "scaleIn",
        label: "Scale in",
        description: "Pops into place",
        compatibleTypes: ["all"],
        durationMs: 850,
    },
    {
        type: "blink",
        label: "Blink",
        description: "Blinks to attract attention",
        compatibleTypes: ["all"],
        durationMs: 750,
        loop: true,
    },
    {
        type: "typewriter",
        label: "Typewriter",
        description: "Text reveals character by character",
        compatibleTypes: ["text"],
        durationMs: 1200,
    },
];

export function isAnimationTypeSupported(type) {
    return ANIMATION_PRESETS.some((preset) => preset.type === type);
}

export function getAnimationPreset(type = "none") {
    return (
        ANIMATION_PRESETS.find((preset) => preset.type === type) ||
        ANIMATION_PRESETS[0]
    );
}

export function isAnimationCompatibleWithElement(preset, element) {
    if (!preset || !element) return false;
    if (preset.compatibleTypes.includes("all")) return true;

    const elementType = element.type === "rect" ? "rectangle" : element.type;
    const rawElementType = element.type;

    return (
        preset.compatibleTypes.includes(elementType) ||
        preset.compatibleTypes.includes(rawElementType)
    );
}

export function getAnimationPresetsForElement(element) {
    if (!element) return ANIMATION_PRESETS;

    return ANIMATION_PRESETS.filter((preset) =>
        isAnimationCompatibleWithElement(preset, element)
    );
}

export function getAnimationPresetsForSelection(elements = []) {
    if (!elements.length) return ANIMATION_PRESETS;

    if (elements.length === 1) {
        return getAnimationPresetsForElement(elements[0]);
    }

    return ANIMATION_PRESETS.filter((preset) => {
        if (preset.type === "none") return true;
        return elements.every((element) =>
            isAnimationCompatibleWithElement(preset, element)
        );
    });
}

export function createAnimationConfig(type = "none", patch = {}) {
    const preset = getAnimationPreset(type);

    if (preset.type === "none") {
        return {
            type: "none",
            durationMs: DEFAULT_ANIMATION_DURATION_MS,
            delayMs: 0,
            loop: false,
            ...patch,
        };
    }

    return {
        type: preset.type,
        durationMs: preset.durationMs || DEFAULT_ANIMATION_DURATION_MS,
        delayMs: 0,
        loop: !!preset.loop,
        ...patch,
    };
}

export function getAnimationLabel(type = "none") {
    return getAnimationPreset(type).label || type;
}
