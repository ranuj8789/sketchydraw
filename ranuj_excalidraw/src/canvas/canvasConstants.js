export const SYSTEM_DESIGN_TYPES = [
    "cache",
    "database",
    "server",
    "nginx",
    "datacenter",
    "kafka",
    "splunk",
    "security",
    "broker",
    "partition",
];

export const SYSTEM_DESIGN_TYPE_SET = new Set(SYSTEM_DESIGN_TYPES);

export function isSystemDesignType(type) {
    return SYSTEM_DESIGN_TYPE_SET.has(type);
}

export const AUTO_SELECT_TYPES = new Set([
    "rect",
    "ellipse",
    "diamond",
    "user",
    ...SYSTEM_DESIGN_TYPES,
    "line",
    "arrow",
    "text",
    "curve",
    "image",
]);

export const SHAPE_TYPES = new Set(["rect", "ellipse", "diamond", "user", ...SYSTEM_DESIGN_TYPES]);

export const LINE_TYPES = new Set([
    "line",
    "arrow",
    "curve",
]);

export const TEXT_CONTAINER_TYPES = new Set(["rect", "ellipse", "diamond"]);
