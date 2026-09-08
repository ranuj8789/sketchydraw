export const THREE_D_ELEMENT_TYPE = "webgl3d";
export const THREE_D_INSERT_PREFIX = "webgl:";

export const THREE_D_PRIMITIVES = [
    { value: "box", label: "Box", group: "Core" },
    { value: "sphere", label: "Sphere", group: "Core" },
    { value: "cylinder", label: "Cylinder", group: "Core" },
    { value: "cone", label: "Cone", group: "Core" },
    { value: "plane", label: "Plane / Grid", group: "Core" },
    { value: "torus", label: "Torus", group: "Core" },
    { value: "arrow3d", label: "Arrow 3D", group: "Core" },
    { value: "array3d", label: "Array", group: "DSA" },
    { value: "matrix3d", label: "Matrix", group: "DSA" },
    { value: "linkedlist3d", label: "Linked List", group: "DSA" },
    { value: "stack3d", label: "Stack", group: "DSA" },
    { value: "queue3d", label: "Queue", group: "DSA" },
    { value: "tree3d", label: "Binary Tree", group: "DSA" },
    { value: "heap3d", label: "Heap (legacy)", group: "DSA" },
    { value: "minheap3d", label: "Min Heap", group: "DSA" },
    { value: "maxheap3d", label: "Max Heap", group: "DSA" },
    { value: "graph3d", label: "Graph", group: "DSA" },
    { value: "intervals3d", label: "Intervals", group: "DSA" },
    { value: "hashtable3d", label: "Hash Table", group: "DSA" },
    { value: "trie3d", label: "Trie", group: "DSA" },
    { value: "sorting3d", label: "Sorting Bars", group: "DSA" },
    { value: "neuron3d", label: "Neuron", group: "AI" },
    { value: "neuralnetwork3d", label: "Neural Network", group: "AI" },
    { value: "tensor3d", label: "Tensor", group: "AI" },
    { value: "embedding3d", label: "Embedding Space", group: "AI" },
    { value: "attention3d", label: "Attention Matrix", group: "AI" },
    { value: "transformer3d", label: "Transformer", group: "AI" },
    { value: "tokenflow3d", label: "Token Flow", group: "AI" },
    { value: "convnet3d", label: "CNN Layers", group: "AI" },
    { value: "modelpipeline3d", label: "AI Pipeline", group: "AI" },
    { value: "rnn3d", label: "RNN Sequence", group: "AI" },
    { value: "autoencoder3d", label: "Autoencoder", group: "AI" },
    { value: "gan3d", label: "GAN", group: "AI" },
    { value: "diffusion3d", label: "Diffusion", group: "AI" },
    { value: "rag3d", label: "RAG Pipeline", group: "AI" },
    { value: "vectordb3d", label: "Vector Database", group: "AI" },
    { value: "losslandscape3d", label: "Loss Landscape", group: "AI" },
    { value: "boywalk3d", label: "Boy · Walk", group: "Character" },
    { value: "boyrun3d", label: "Boy · Run", group: "Character" },
    { value: "girlwalk3d", label: "Girl · Walk", group: "Character" },
    { value: "girlrun3d", label: "Girl · Run", group: "Character" },
];

export const THREE_D_MOTIONS = [
    { value: "none", label: "None" },
    { value: "rotateY", label: "Rotate Y" },
    { value: "rotateXYZ", label: "Rotate XYZ" },
    { value: "float", label: "Float" },
    { value: "breathe", label: "Breathe" },
    { value: "dataFlow", label: "Data flow" },
    { value: "nodeFire", label: "Node fire" },
    { value: "wave", label: "Wave" },
    { value: "layerReveal", label: "Layer reveal" },
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

export function to3DInsertRequest(primitive, patch = {}) {
    return {
        type: `${THREE_D_INSERT_PREFIX}${primitive || "box"}`,
        animated: true,
        animationType: "pulse",
        threeDPatch: patch,
    };
}
