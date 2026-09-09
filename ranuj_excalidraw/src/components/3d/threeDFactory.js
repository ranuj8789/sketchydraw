import { THREE_D_ELEMENT_TYPE, parse3DInsertType } from "./threeDConstants";

export function create3DPrimitiveElement({
    insertType,
    center,
    pageIndex = 0,
    stroke = "#111827",
    animation,
    makeId,
    patch = {},
}) {
    const primitive3d = parse3DInsertType(insertType);
    if (!primitive3d) return null;

    const isArray = primitive3d === "array3d";
    const isMatrix = primitive3d === "matrix3d";
    const isArrow = primitive3d === "arrow3d";
    const isCharacter = ["boywalk3d", "boyrun3d", "girlwalk3d", "girlrun3d"].includes(primitive3d);
    const isWide = ["array3d", "matrix3d", "linkedlist3d", "queue3d", "graph3d", "intervals3d", "hashtable3d", "trie3d", "sorting3d", "neuralnetwork3d", "embedding3d", "attention3d", "transformer3d", "tokenflow3d", "convnet3d", "modelpipeline3d", "rnn3d", "autoencoder3d", "gan3d", "diffusion3d", "rag3d", "vectordb3d", "losslandscape3d"].includes(primitive3d);
    const isTall = ["stack3d", "tree3d", "heap3d", "minheap3d", "maxheap3d"].includes(primitive3d);
    const aiPrimitive = ["neuron3d", "neuralnetwork3d", "tensor3d", "embedding3d", "attention3d", "transformer3d", "tokenflow3d", "convnet3d", "modelpipeline3d", "rnn3d", "autoencoder3d", "gan3d", "diffusion3d", "rag3d", "vectordb3d", "losslandscape3d"].includes(primitive3d);

    return {
        id: makeId?.(`webgl_${primitive3d}`) || `webgl_${primitive3d}_${Date.now()}`,
        type: THREE_D_ELEMENT_TYPE,
        primitive3d,
        renderer: "webgl",
        x: center.x - (isWide ? 210 : (isCharacter ? 70 : 90)),
        y: center.y - 90,
        w: isWide ? 420 : (isArrow ? 260 : (isCharacter ? 140 : 180)),
        h: isCharacter ? 220 : (isTall ? 300 : (aiPrimitive ? 260 : 180)),
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
        labels: primitive3d === "linkedlist3d" ? ["head", "A", "B", "null"] : undefined,
        layers: primitive3d === "neuralnetwork3d" ? [3, 5, 5, 2] : undefined,
        layerLabels: primitive3d === "neuralnetwork3d" ? ["Input", "Hidden 1", "Hidden 2", "Output"] : undefined,
        nodes: primitive3d === "graph3d" ? 7 : undefined,
        graphNodes: primitive3d === "graph3d" ? [
            { id: "A", x: .12, y: .5 }, { id: "B", x: .34, y: .18 },
            { id: "C", x: .36, y: .78 }, { id: "D", x: .62, y: .28 },
            { id: "E", x: .66, y: .72 }, { id: "F", x: .88, y: .5 }
        ] : undefined,
        graphEdges: primitive3d === "graph3d" ? [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"], ["C", "E"], ["D", "F"], ["E", "F"]] : undefined,
        traversalOrder: primitive3d === "graph3d" ? ["A", "B", "C", "D", "E", "F"] : undefined,
        intervals: primitive3d === "intervals3d" ? [[1, 4], [2, 6], [5, 8], [7, 10]] : undefined,
        heapValues: primitive3d === "minheap3d" ? [5, 12, 18, 25, 30, 22, 40] : (["heap3d", "maxheap3d"].includes(primitive3d) ? [99, 82, 75, 44, 36, 61, 50] : undefined),
        tensorShape: primitive3d === "tensor3d" ? [4, 4, 3] : undefined,
        tokens: primitive3d === "tokenflow3d" ? ["The", "model", "learns", "patterns"] : undefined,
        motion3d: aiPrimitive ? "dataFlow" : (isCharacter ? "none" : "rotateY"),
        motionSpeed: 1,
        motionDurationMs: 2400,
        motionEasing: "inOut",
        motionDirection: "alternate",
        dataPath3d: (aiPrimitive || primitive3d === "graph3d" || primitive3d === "linkedlist3d" || primitive3d === "queue3d")
            ? [{ x: -80, y: 0, z: 10 }, { x: 0, y: -45, z: 70 }, { x: 80, y: 0, z: 10 }]
            : undefined,
        pathDurationMs: 2200,
        perspective: 720,
        cameraPitch: 12,
        cameraYaw: 0,
        showLabels: true,
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
        animation: animation?.type && animation.type !== "none"
            ? { ...animation, durationMs: Math.max(6000, Number(animation.durationMs) || 0), loop: false }
            : { type: "pulse", durationMs: 6000, delayMs: 0, loop: false },
        ...patch,
    };
}
