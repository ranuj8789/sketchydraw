import { THREE_D_ELEMENT_TYPE, parse3DInsertType } from "./threeDConstants";

export function create3DPrimitiveElement({
    insertType,
    center,
    pageIndex = 0,
    stroke = "#111827",
    animation,
    makeId,
}) {
    const primitive3d = parse3DInsertType(insertType);
    if (!primitive3d) return null;

    const isArray = primitive3d === "array3d";
    const isMatrix = primitive3d === "matrix3d";
    const isArrow = primitive3d === "arrow3d";
    const isCharacter = ["boywalk3d", "boyrun3d", "girlwalk3d", "girlrun3d"].includes(primitive3d);

    return {
        id: makeId?.(`webgl_${primitive3d}`) || `webgl_${primitive3d}_${Date.now()}`,
        type: THREE_D_ELEMENT_TYPE,
        primitive3d,
        renderer: "webgl",
        x: center.x - (isArray || isMatrix ? 180 : (isCharacter ? 70 : 90)),
        y: center.y - 90,
        w: isArray || isMatrix ? 360 : (isArrow ? 260 : (isCharacter ? 140 : 180)),
        h: isCharacter ? 220 : 180,
        depth: 70,
        z: 0,
        rotationX: -18,
        rotationY: 28,
        rotationZ: 0,
        scale3d: 1,
        stroke,
        fill: "#e2e8f0",
        opacity: 1,
        material: "standard",
        metalness: 0.08,
        roughness: 0.65,
        values: isArray ? [4, 8, 2, 7, 1] : (isMatrix ? [[1, 2, 3], [4, 5, 6], [7, 8, 9]] : undefined),
        rows: isMatrix ? 3 : undefined,
        cols: isMatrix ? 3 : undefined,
        gap: 10,
        showIndexes: isArray,
        showCoordinates: isMatrix,
        characterGender: primitive3d.startsWith("girl") ? "girl" : (primitive3d.startsWith("boy") ? "boy" : undefined),
        characterAction: isCharacter ? (primitive3d.includes("run") ? "run" : "walk") : undefined,
        characterSpeed: isCharacter ? 1 : undefined,
        characterLoop: isCharacter ? true : undefined,
        pageIndex,
        webglPrimitive: true,
        animation,
    };
}
