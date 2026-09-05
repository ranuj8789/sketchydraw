export const THREE_D_ELEMENT_TYPE = "webgl3d";
export const THREE_D_INSERT_PREFIX = "webgl:";

export const THREE_D_PRIMITIVES = [
    { value: "box", label: "Box", group: "3D" },
    { value: "sphere", label: "Sphere", group: "3D" },
    { value: "cylinder", label: "Cylinder", group: "3D" },
    { value: "cone", label: "Cone", group: "3D" },
    { value: "arrow3d", label: "Arrow 3D", group: "3D" },
    { value: "array3d", label: "Array 3D", group: "DSA" },
    { value: "matrix3d", label: "Matrix 3D", group: "DSA" },
    { value: "boywalk3d", label: "Boy · Walk", group: "Character" },
    { value: "boyrun3d", label: "Boy · Run", group: "Character" },
    { value: "girlwalk3d", label: "Girl · Walk", group: "Character" },
    { value: "girlrun3d", label: "Girl · Run", group: "Character" },
];

export function is3DElement(element) {
    return element?.type === THREE_D_ELEMENT_TYPE;
}

export function is3DInsertType(type) {
    return typeof type === "string" && type.startsWith(THREE_D_INSERT_PREFIX);
}

export function parse3DInsertType(type) {
    if (!is3DInsertType(type)) return null;
    return type.slice(THREE_D_INSERT_PREFIX.length) || "box";
}

export function to3DInsertRequest(primitive) {
    return {
        type: `${THREE_D_INSERT_PREFIX}${primitive || "box"}`,
        animated: false,
        animationType: "none",
    };
}
