import React, { useState } from "react";
import ThreeDPrimitivePalette from "./ThreeDPrimitivePalette";
import ThreeDPropertiesSection from "./ThreeDPropertiesSection";
import { is3DElement } from "./threeDConstants";
import "./ThreeD.css";

export default function ThreeDTab({ selectedElement, onInsert, onPatch }) {
    const selected3D = is3DElement(selectedElement) ? selectedElement : null;
    const [code, setCode] = useState("int[] arr = {7, 2, 9, 4, 1};\nArrays.sort(arr);");

    const generateFromCode = () => {
        const source = String(code || "");
        const lower = source.toLowerCase();
        const numbers = (source.match(/-?\d+(?:\.\d+)?/g) || []).slice(0, 16).map(Number);
        let primitive = "array3d";
        let patch = { values: numbers.length ? numbers : [7, 2, 9, 4, 1], motion3d: "wave" };

        if (/\b(bfs|dfs|graph|adjacency|edge)\b/.test(lower)) {
            primitive = "graph3d";
            patch = { motion3d: "nodeFire", traversalMode: lower.includes("dfs") ? "DFS" : "BFS" };
        } else if (/\b(interval|intervals|meeting room|merge intervals)\b/.test(lower)) {
            primitive = "intervals3d";
            const pairs = [];
            for (let index = 0; index + 1 < numbers.length && pairs.length < 8; index += 2) pairs.push([numbers[index], numbers[index + 1]]);
            patch = { intervals: pairs.length ? pairs : [[1, 4], [2, 6], [5, 8]], motion3d: "dataFlow" };
        } else if (/\b(maxheap|max heap)\b/.test(lower)) {
            primitive = "maxheap3d";
            patch = { heapValues: numbers.length ? numbers : [99, 82, 75, 44, 36, 61, 50], motion3d: "nodeFire" };
        } else if (/\b(priorityqueue|priority queue|minheap|min heap|heap)\b/.test(lower)) {
            primitive = "minheap3d";
            patch = { heapValues: numbers.length ? numbers : [5, 12, 18, 25, 30, 22, 40], motion3d: "nodeFire" };
        } else if (/\b(stack|push|pop)\b/.test(lower)) {
            primitive = "stack3d";
            patch = { values: numbers.length ? numbers : [5, 4, 3, 2, 1], motion3d: "wave" };
        } else if (/\b(queue|enqueue|dequeue)\b/.test(lower)) {
            primitive = "queue3d";
            patch = { values: numbers.length ? numbers : [8, 4, 2, 9], motion3d: "dataFlow" };
        } else if (/\b(linkedlist|linked list|next\b|node\.)/.test(lower)) {
            primitive = "linkedlist3d";
            patch = { values: numbers.length ? numbers : [10, 20, 30], motion3d: "dataFlow" };
        } else if (/\b(trie|prefix)\b/.test(lower)) {
            primitive = "trie3d";
            patch = { motion3d: "nodeFire" };
        } else if (/\b(tree|binary tree)\b/.test(lower)) {
            primitive = "tree3d";
            patch = { values: numbers.length ? numbers : undefined, motion3d: "nodeFire" };
        } else if (/\b(matrix|grid|\[\]\[\])\b/.test(lower)) {
            primitive = "matrix3d";
            const values = numbers.length >= 4 ? numbers : [1, 2, 3, 4, 5, 6, 7, 8, 9];
            const size = Math.ceil(Math.sqrt(values.length));
            patch = { values: Array.from({ length: size }, (_, row) => values.slice(row * size, row * size + size)), motion3d: "wave" };
        } else if (/\b(sort|swap|bubble|merge|quick)\b/.test(lower)) {
            primitive = "sorting3d";
            patch = { values: numbers.length ? numbers : [7, 2, 9, 4, 1], motion3d: "wave" };
        }

        onInsert?.(primitive, { ...patch, sourceCode: source, generatedFromCode: true });
    };

    return (
        <div className="left-tab-panel three-d-tab-panel">
            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>3D Studio</strong>
                    <span>Core shapes, DSA structures, AI architectures and animated scenes.</span>
                </div>
                <ThreeDPrimitivePalette onInsert={onInsert} />
            </div>

            <div className="left-tool-card three-d-code-card">
                <div className="left-card-heading">
                    <strong>Code → DSA 3D</strong>
                    <span>Paste DSA code. SketchyDraw detects the structure and creates an animated 3D object.</span>
                </div>
                <textarea rows="7" value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} />
                <div className="three-d-code-presets">
                    <button type="button" onClick={() => setCode("Queue<Integer> q = new LinkedList<>();\nq.add(8); q.add(4); q.remove();")}>Queue</button>
                    <button type="button" onClick={() => setCode("BFS(graph, A);\nedges: A-B, A-C, B-D, C-E")}>Graph BFS</button>
                    <button type="button" onClick={() => setCode("int[] arr = {7, 2, 9, 4, 1};\nbubbleSort(arr);")}>Sorting</button>
                    <button type="button" onClick={() => setCode("int[][] intervals = {{1,4},{2,6},{5,8},{7,10}};\nmerge(intervals);")}>Intervals</button>
                    <button type="button" onClick={() => setCode("PriorityQueue<Integer> minHeap = new PriorityQueue<>();\nminHeap.add(5); minHeap.add(12); minHeap.add(18);")}>Min heap</button>
                    <button type="button" onClick={() => setCode("MaxHeap heap = new MaxHeap();\nheap.add(99); heap.add(82); heap.add(75);")}>Max heap</button>
                </div>
                <button type="button" className="left-primary-btn wide" onClick={generateFromCode}>Generate animated DSA 3D</button>
            </div>

            {selected3D ? (
                <div className="left-tool-card three-d-selected-card">
                    <div className="left-card-heading">
                        <strong>Selected 3D object</strong>
                        <span>Drag it directly on canvas. Fine tune it here.</span>
                    </div>
                    <ThreeDPropertiesSection element={selected3D} onPatch={onPatch} />
                </div>
            ) : (
                <div className="left-tool-card three-d-empty-card">
                    <div className="left-card-heading">
                        <strong>No 3D object selected</strong>
                        <span>Insert one above or select an existing 3D object on the canvas.</span>
                    </div>
                </div>
            )}
        </div>
    );
}
