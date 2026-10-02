import React, {useEffect, useRef} from "react";
import * as THREE from "three";
import {TransformControls} from "three/examples/jsm/controls/TransformControls.js";
import {resolve3DOrbit, resolve3DStep, resolve3DTransform, resolveDataPathPoint} from "./threeDKeyframes";

const geometryFor = (primitive, w, h, d) => {
    if (primitive === "sphere" || primitive === "neuron3d") return new THREE.SphereGeometry(Math.min(w, h) * .35, 32, 20);
    if (primitive === "cylinder") return new THREE.CylinderGeometry(w * .3, w * .3, h * .7, 24);
    if (primitive === "cone") return new THREE.ConeGeometry(w * .35, h * .75, 24);
    if (primitive === "torus") return new THREE.TorusGeometry(Math.min(w, h) * .28, Math.min(w, h) * .09, 12, 32);
    if (primitive === "arrow3d") return new THREE.CylinderGeometry(Math.max(3, h * .055), Math.max(3, h * .055), w * .62, 16);
    return new THREE.BoxGeometry(w * .72, h * .62, Math.max(8, d));
};

export function disposeObject(object) {
    object.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
        else { child.material?.map?.dispose?.(); child.material?.dispose?.(); }
    });
}

function addConnection(group, a, b, color = "#64748b") {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({color, transparent: true, opacity: .55})));
}

function addFlowTube(group, points, color = "#38bdf8") {
    if (!Array.isArray(points) || points.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(Number(point.x) || 0, -(Number(point.y) || 0), Number(point.z) || 0)));
    const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(12, points.length * 10), 2.4, 8, false),
        new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 1.4,
            transparent: true,
            opacity: .78,
            roughness: .3,
            metalness: .15
        }),
    );
    tube.userData.flowTube = true;
    group.add(tube);
}

function applyLighting(scene, preset = "studio") {
    const values = {
        studio: {ambient: 1.5, key: 2.3, color: "#ffffff", background: null},
        soft: {ambient: 2.05, key: 1.25, color: "#fff7ed", background: null},
        blueprint: {ambient: 1.0, key: 1.7, color: "#93c5fd", background: "#081a33"},
        neon: {ambient: .7, key: 3.35, color: "#67e8f9", background: "#08051c"},
        dark: {ambient: .9, key: 1.85, color: "#c4b5fd", background: "#07111f"},
    }[preset] || {ambient: 1.5, key: 2.3, color: "#ffffff", background: null};
    scene.background = values.background ? new THREE.Color(values.background) : null;
    scene.traverse((item) => {
        if (item.isAmbientLight) {
            item.intensity = values.ambient;
            item.color.set(values.color);
        }
        if (item.isDirectionalLight && !item.userData.rim) {
            item.intensity = values.key;
            item.color.set(values.color);
        }
    });
}

function makeLabelSprite(text, color = "#0f172a", scale = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = "800 54px Inter, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(String(text), 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({map: texture, transparent: true, depthTest: false, depthWrite: false});
    const sprite = new THREE.Sprite(material);
    const safeScale = Math.max(.6, Math.min(3, Number(scale) || 1));
    const width = Math.max(105, Math.min(230, String(text).length * 15)) * safeScale;
    sprite.scale.set(width, 34 * safeScale, 1);
    sprite.renderOrder = 100;
    sprite.userData.depthLabel = true;
    sprite.userData.labelText = String(text);
    sprite.userData.labelColor = color;
    sprite.userData.labelWidthRatio = ctx.measureText(String(text)).width / canvas.width;
    sprite.userData.labelHeightRatio = 54 / canvas.height;
    return sprite;
}

function addLabeledMesh(group, geometry, material, position, label, stepId, labelOptions = {}) {
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.position.set(...position);
    if (stepId !== undefined) mesh.userData.stepId = String(stepId);
    group.add(mesh);
    if (label !== undefined && label !== null) {
        const sprite = makeLabelSprite(label, labelOptions.color || "#0f172a", labelOptions.scale || 1);
        const labelDepth = Number(geometry.parameters?.depth ?? geometry.parameters?.radius ?? 0);
        sprite.position.set(position[0], position[1], position[2] + labelDepth / 2 + 8);
        group.add(sprite);
    }
    return mesh;
}

function pipelineNames(primitive) {
    return {
        transformer3d: ["Tokens", "Embedding", "Attention", "Add + Norm", "FFN", "Output"],
        convnet3d: ["Image", "Conv", "ReLU", "Pool", "Dense", "Class"],
        modelpipeline3d: ["Data", "Train", "Model", "Evaluate", "Deploy"],
        autoencoder3d: ["Input", "Encoder", "Latent z", "Decoder", "Output"],
        gan3d: ["Noise z", "Generator", "Fake", "Discriminator", "Score"],
        diffusion3d: ["Noise", "Denoise t3", "Denoise t2", "Denoise t1", "Image"],
        rag3d: ["Query", "Embed", "Vector DB", "Retrieve", "LLM", "Answer"],
        rnn3d: ["x1", "h1", "h2", "h3", "y"],
    }[primitive];
}

// The orbit keys are a real scene camera path in Perspective mode.  Keeping
// this in one helper ensures the editor and the export renderer see the same
// view, instead of the old editor-only pseudo orbit.
export function configurePerspectiveCamera(camera, settings, canvasSize, timeMs) {
    const orbit = resolve3DOrbit(settings, timeMs);
    const fov = Math.max(20, Math.min(100, Number(settings.cameraFov) || 50));
    const distance = Math.max(200, Number(orbit.distance) || Number(settings.cameraDistance) || canvasSize.height / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))));
    const yaw = THREE.MathUtils.degToRad(Number(orbit.yaw) || 0);
    const pitch = THREE.MathUtils.degToRad(Math.max(-85, Math.min(85, Number(orbit.pitch) || 12)));
    const target = new THREE.Vector3(
        canvasSize.width / 2 + Number(orbit.targetX || 0),
        -canvasSize.height / 2 - Number(orbit.targetY || 0),
        Number(orbit.targetZ || 0),
    );
    camera.fov = fov;
    camera.aspect = canvasSize.width / Math.max(1, canvasSize.height);
    camera.position.set(
        target.x + distance * Math.cos(pitch) * Math.sin(yaw),
        target.y + distance * Math.sin(pitch),
        target.z + distance * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
}

export function buildStructuredGroup(element, material, w, h, d) {
    const group = new THREE.Group();
    const primitive = element.primitive3d || "box";
    const labelOptions = { color: element.labelColor3d || "#0f172a", scale: Number(element.labelScale3d) || 1 };
    if (primitive === "neuralnetwork3d") {
        const layers = Array.isArray(element.layers) ? element.layers : [3, 5, 5, 2];
        const points = layers.map((count, layer) => Array.from({length: count}, (_, node) => [
            -w * .38 + layer * (w * .76 / Math.max(1, layers.length - 1)),
            h * .34 - node * (h * .68 / Math.max(1, count - 1)),
            (layer - layers.length / 2) * d * .22,
        ]));
        points.slice(0, -1).forEach((layer, index) => layer.forEach((a) => points[index + 1].forEach((b) => addConnection(group, a, b, "#94a3b8"))));
        points.flat().forEach((point) => {
            const node = new THREE.Mesh(new THREE.SphereGeometry(Math.max(5, Math.min(11, h / 30)), 16, 12), material.clone());
            node.position.set(...point);
            group.add(node);
        });
    } else if (primitive === "graph3d") {
        const authored = Array.isArray(element.graphNodes) && element.graphNodes.length ? element.graphNodes : [{
            id: "A",
            x: .15,
            y: .5
        }, {id: "B", x: .4, y: .2}, {id: "C", x: .4, y: .8}, {id: "D", x: .75, y: .5}];
        const points = new Map(authored.map((node, index) => [String(node.id ?? index), [(Number(node.x) - .5) * w, (.5 - Number(node.y)) * h, (index % 3 - 1) * d * .3]]));
        (element.graphEdges || [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"]]).forEach(([from, to]) => {
            const a = points.get(String(from)), b = points.get(String(to));
            if (a && b) addConnection(group, a, b);
        });
        points.forEach((point, id) => {
            const node = new THREE.Mesh(new THREE.SphereGeometry(13, 18, 12), material.clone());
            node.position.set(...point);
            node.userData.stepId = id;
            group.add(node);
            const label = makeLabelSprite(id, labelOptions.color, labelOptions.scale);
            label.position.set(point[0], point[1] + 23, point[2]);
            group.add(label);
        });
    } else if (["array3d", "sorting3d", "queue3d", "stack3d"].includes(primitive)) {
        const values = element.values || element.heapValues || [7, 2, 9, 4, 1];
        const count = Math.max(1, values.length);
        const cell = Math.min(58, w / count);
        values.forEach((value, index) => {
            const barHeight = primitive === "sorting3d" ? Math.max(20, Math.abs(Number(value) || 1) * 8) : 44;
            const vertical = primitive === "stack3d";
            const position = vertical ? [0, (index - (count - 1) / 2) * 50, 0] : [(index - (count - 1) / 2) * cell, primitive === "sorting3d" ? -h * .25 + barHeight / 2 : 0, 0];
            addLabeledMesh(group, new THREE.BoxGeometry(vertical ? Math.min(w * .7, 100) : cell * .82, barHeight, d * .6), material, position, value, index, labelOptions);
        });
    } else if (["tree3d", "heap3d", "minheap3d", "maxheap3d", "trie3d"].includes(primitive)) {
        const values = element.heapValues || element.values || (primitive === "trie3d" ? ["root", "c", "d", "a", "o", "t", "g"] : [50, 30, 70, 20, 40, 60, 80]);
        const points = values.map((_, index) => {
            const level = Math.floor(Math.log2(index + 1));
            const first = (2 ** level) - 1;
            const slot = index - first;
            const slots = 2 ** level;
            return [((slot + .5) / slots - .5) * w * .9, h * .34 - level * Math.min(70, h * .24), (level % 2) * d * .18];
        });
        points.forEach((point, index) => {
            if (index) addConnection(group, points[Math.floor((index - 1) / 2)], point);
        });
        points.forEach((point, index) => addLabeledMesh(group, new THREE.SphereGeometry(Math.max(8, Math.min(15, w / 26)), 20, 14), material, point, values[index], index, labelOptions));
    } else if (primitive === "matrix3d" || primitive === "tensor3d" || primitive === "attention3d") {
        const rows = Math.max(2, Number(element.rows) || (Array.isArray(element.values) ? element.values.length : 4));
        const cols = Math.max(2, Number(element.columns) || (Array.isArray(element.values?.[0]) ? element.values[0].length : 4));
        const layers = primitive === "tensor3d" ? Math.max(2, Number(element.tensorShape?.[2]) || 3) : 1;
        const cell = Math.min(42, w / cols, h / rows);
        for (let layer = 0; layer < layers; layer += 1) for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
            const value = element.values?.[row]?.[col] ?? (primitive === "attention3d" ? ((row + col) % cols) / Math.max(1, cols - 1) : "");
            const cellMaterial = material.clone();
            if (primitive === "attention3d") cellMaterial.color.offsetHSL(0, 0, Number(value) * .22 - .1);
            addLabeledMesh(group, new THREE.BoxGeometry(cell * .8, cell * .8, Math.max(6, d * .18)), cellMaterial,
                [(col - (cols - 1) / 2) * cell, ((rows - 1) / 2 - row) * cell, (layer - (layers - 1) / 2) * d * .45], value, `${layer}-${row}-${col}`, labelOptions);
            cellMaterial.dispose();
        }
    } else if (primitive === "embedding3d" || primitive === "vectordb3d") {
        const count = Math.max(8, Math.min(80, Number(element.pointCount) || 28));
        for (let index = 0; index < count; index += 1) {
            const angle = index * 2.399963;
            const radius = Math.sqrt(index / count);
            const point = [Math.cos(angle) * radius * w * .4, Math.sin(angle) * radius * h * .36, Math.sin(index * 1.7) * d * .65];
            addLabeledMesh(group, new THREE.SphereGeometry(index % 7 === 0 ? 7 : 4, 12, 8), material, point, index % 7 === 0 ? `v${index}` : null, index, labelOptions);
        }
    } else if (pipelineNames(primitive)) {
        const names = pipelineNames(primitive);
        const gap = w * .82 / Math.max(1, names.length - 1);
        const points = names.map((_, index) => [(index - (names.length - 1) / 2) * gap, Math.sin(index * 1.4) * h * .08, (index - names.length / 2) * d * .18]);
        points.slice(0, -1).forEach((point, index) => addConnection(group, point, points[index + 1], element.flowColor || "#38bdf8"));
        points.forEach((point, index) => {
            const stageMaterial = material.clone();
            const color = Array.isArray(element.pipelineColors) ? element.pipelineColors[index % element.pipelineColors.length] : null;
            if (color) stageMaterial.color.set(color);
            addLabeledMesh(group, new THREE.BoxGeometry(Math.min(82, gap * .72), Math.min(58, h * .34), d * .55), stageMaterial, point, names[index], index, labelOptions);
            stageMaterial.dispose();
        });
    } else if (primitive === "neuron3d") {
        const center = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, h) * .16, 28, 18), material.clone());
        group.add(center);
        for (let index = 0; index < 12; index += 1) {
            const angle = index / 12 * Math.PI * 2;
            const endpoint = [Math.cos(angle) * w * .4, Math.sin(angle) * h * .36, Math.sin(index * 2.1) * d * .45];
            addConnection(group, [0, 0, 0], endpoint, element.stroke || "#64748b");
            addLabeledMesh(group, new THREE.SphereGeometry(4, 10, 8), material, endpoint, null, index);
        }
    } else {
        const mesh = new THREE.Mesh(geometryFor(primitive, w, h, d), material);
        if (primitive === "arrow3d") {
            mesh.rotation.z = -Math.PI / 2;
            mesh.position.x = -w * .08;
            const head = new THREE.Mesh(new THREE.ConeGeometry(Math.max(10, h * .14), Math.max(24, w * .22), 20), material.clone());
            head.rotation.z = -Math.PI / 2;
            head.position.x = w * .32;
            group.add(head);
        }
        group.add(mesh);
    }
    if (Array.isArray(element.dataPath3d) && element.dataPath3d.length > 1) {
        addFlowTube(group, element.dataPath3d, element.flowColor || "#38bdf8");
        const particle = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 10), new THREE.MeshBasicMaterial({color: "#38bdf8"}));
        particle.userData.dataParticle = true;
        group.add(particle);
    }
    return group;
}

export function initializeThreeDGroup(group) {
    group.children.forEach(child => {
        child.userData.baseZ = child.position.z;
        child.userData.baseScale = child.scale.clone();
        child.userData.baseColor = child.material?.color?.clone();
    });
}

export function animateThreeDGroup(group, element, viewport, timeMs, perspective) {
    const transform = resolve3DTransform(element, timeMs);
    const step = resolve3DStep(element, timeMs);
    const orbit = resolve3DOrbit(element, timeMs);
    const path = resolveDataPathPoint(element, timeMs);
    const w = Number(element.w) || 180, h = Number(element.h) || 180;
    group.position.set(transform.x * viewport.zoom + viewport.offsetX + w * viewport.zoom / 2,
        -(transform.y * viewport.zoom + viewport.offsetY + h * viewport.zoom / 2), transform.z);
    group.rotation.set((transform.rotationX + (perspective ? 0 : orbit.pitch)) * Math.PI / 180,
        (transform.rotationY + (perspective ? 0 : orbit.yaw)) * Math.PI / 180, transform.rotationZ * Math.PI / 180);
    group.scale.setScalar(transform.scale3d * viewport.zoom);
    const duration = Math.max(100, Number(element.motionDurationMs) || 2400);
    const reveal = element.motion3d === "layerReveal" ? Math.max(1, Math.ceil(timeMs % duration / duration * group.children.length)) : group.children.length;
    group.children.forEach((child, index) => {
        child.visible = (index < reveal || child.userData.dataParticle || child.userData.depthLabel) && (!child.userData.depthLabel || element.showLabels !== false);
        if (!child.userData.dataParticle && !child.userData.depthLabel) child.position.z = (Number(child.userData.baseZ) || 0) + (index - group.children.length / 2) * Number(element.exploded3d || 0) * .002;
        if (child.userData.dataParticle && path) child.position.set(path.x, -path.y, path.z);
        const targetIndex = Number(step.step?.targetIndex ?? step.index);
        const active = step.index >= 0 && (String(child.userData.stepId) === String(step.step?.targetId) || index % Math.max(1, group.children.length) === targetIndex % Math.max(1, group.children.length));
        if (child.userData.baseScale) child.scale.copy(child.userData.baseScale).multiplyScalar(active && ["insert", "visit", "highlight"].includes(step.step?.action || "highlight") ? 1.18 : 1);
        if (child.material && !child.userData.depthLabel) {
            child.material.opacity = active && step.step?.action === "extract" ? transform.opacity * Math.max(.15, 1 - step.progress) : transform.opacity;
            const animatedColor = element.materialColor || (element.transformKeyframes || []).some(key => key.materialColor);
            child.material.color?.set(animatedColor ? (transform.materialColor === "transparent" ? "#e2e8f0" : transform.materialColor) : (child.userData.baseColor || transform.materialColor));
            child.material.emissive?.set(active ? "#0b65a3" : child.userData.flowTube ? element.flowColor || "#38bdf8" : "#000000");
        }
    });
    group.updateMatrixWorld(true);
}

function configureQuality(renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
}

let exportRenderer = null;
let webglAvailable;

export function isWebGLAvailable() {
    if (typeof document === "undefined") return false;
    if (webglAvailable !== undefined) return webglAvailable;
    try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
        webglAvailable = !!context;
        context?.getExtension("WEBGL_lose_context")?.loseContext();
        return webglAvailable;
    } catch (_) {
        return false;
    }
}

export function compositeThreeDFrame(targetCanvas, elements = [], viewport, timeMs = 0) {
    if (typeof document === "undefined" || !targetCanvas) return false;
    const items = elements.filter((element) => element?.type === "webgl3d");
    if (!items.length) return false;
    try {
        if (!exportRenderer) exportRenderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true
        });
        const width = targetCanvas.width, height = targetCanvas.height;
        configureQuality(exportRenderer);
        exportRenderer.setPixelRatio(1);
        exportRenderer.setSize(width, height, false);
        exportRenderer.setClearColor(0x000000, 0);
        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 1.8));
        const light = new THREE.DirectionalLight(0xffffff, 2.2);
        light.position.set(-300, 500, 800);
        scene.add(light);
        const rim = new THREE.DirectionalLight(0xbddcff, 1.2); rim.position.set(600, 250, -400); rim.userData.rim = true; scene.add(rim);
        const first = items[0];
        const perspective = first.projection3d === "perspective";
        applyLighting(scene, first.lightingPreset || "studio");
        let camera;
        if (perspective) {
            camera = new THREE.PerspectiveCamera(50, width / Math.max(1, height), .1, 10000);
            configurePerspectiveCamera(camera, first, {width, height}, timeMs);
        } else {
            camera = new THREE.OrthographicCamera(0, width, 0, -height, -5000, 5000);
            camera.position.z = 1200;
        }
        items.forEach((element) => {
            const w = Math.max(20, Number(element.w) || 180), h = Math.max(20, Number(element.h) || 180),
                d = Math.max(8, Number(element.depth) || 70);
            const material = new THREE.MeshStandardMaterial({
                color: element.fill === "transparent" ? "#e2e8f0" : (element.fill || "#e2e8f0"),
                roughness: Number(element.roughness ?? .65),
                metalness: Number(element.metalness ?? .08),
                transparent: true
            });
            const group = buildStructuredGroup(element, material, w, h, d);
            initializeThreeDGroup(group);
            animateThreeDGroup(group, element, viewport, timeMs, perspective);
            scene.add(group);
        });
        exportRenderer.render(scene, camera);
        targetCanvas.getContext("2d").drawImage(exportRenderer.domElement, 0, 0, width, height);
        scene.children.forEach(disposeObject);
        return true;
    } catch (error) {
        console.warn("WebGL export compositing unavailable; canvas fallback remains active.", error);
        return false;
    }
}

export default function ThreeDWebGLLayer({
                                             elements = [],
                                             viewport,
                                             canvasSize,
                                             timeMs = 0,
                                             interactionCanvas,
                                             selectedIds = [],
                                             onSelect,
                                             onTransformCommit,
                                             gizmoEnabled = false,
                                             gizmoMode = "translate"
                                         }) {
    const hostRef = useRef(null);
    const stateRef = useRef(null);
    const latestRef = useRef({elements, viewport, onTransformCommit});
    latestRef.current = {elements, viewport, onTransformCommit};

    useEffect(() => {
        if (!hostRef.current) return undefined;
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(0, canvasSize.width, 0, -canvasSize.height, -5000, 5000);
        camera.position.z = 1200;
        const perspectiveCamera = new THREE.PerspectiveCamera(50, canvasSize.width / Math.max(1, canvasSize.height), .1, 10000);
        const perspectiveDistance = canvasSize.height / (2 * Math.tan(THREE.MathUtils.degToRad(25)));
        perspectiveCamera.position.set(canvasSize.width / 2, -canvasSize.height / 2, perspectiveDistance);
        perspectiveCamera.lookAt(canvasSize.width / 2, -canvasSize.height / 2, 0);
        const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: false});
        configureQuality(renderer);
        renderer.setPixelRatio(Math.min(elements.filter((element) => element?.type === "webgl3d").length > 30 ? 1 : 2, window.devicePixelRatio || 1));
        renderer.setSize(canvasSize.width, canvasSize.height, false);
        renderer.setClearColor(0x000000, 0);
        hostRef.current.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 1.8));
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(-300, 500, 800);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xbddcff, 1.2); rim.position.set(600, 250, -400); rim.userData.rim = true; scene.add(rim);
        const controls = new TransformControls(camera, renderer.domElement);
        controls.setMode("translate");
        controls.addEventListener("objectChange", () => {
            const object = controls.object;
            if (!object?.userData?.elementId) return;
            const current = latestRef.current;
            const element = current.elements.find((item) => item.id === object.userData.elementId);
            if (!element) return;
            const isPerspective = element.projection3d === "perspective";
            current.onTransformCommit?.(element.id, {
                x: (object.position.x - current.viewport.offsetX - (Number(element.w) || 180) * current.viewport.zoom / 2) / current.viewport.zoom,
                y: (-object.position.y - current.viewport.offsetY - (Number(element.h) || 180) * current.viewport.zoom / 2) / current.viewport.zoom,
                z: object.position.z,
                rotationX: THREE.MathUtils.radToDeg(object.rotation.x) - (isPerspective ? 0 : Number(element.cameraPitch || 0)),
                rotationY: THREE.MathUtils.radToDeg(object.rotation.y) - (isPerspective ? 0 : Number(element.cameraYaw || 0)),
                rotationZ: THREE.MathUtils.radToDeg(object.rotation.z),
                scale3d: Math.max(.05, object.scale.x / Math.max(.01, current.viewport.zoom)),
            });
        });
        const controlsHelper = controls.getHelper();
        scene.add(controlsHelper);
        stateRef.current = {
            scene,
            camera,
            perspectiveCamera,
            activeCamera: camera,
            renderer,
            controls,
            controlsHelper,
            groups: new Map(),
            visible: !document.hidden
        };
        const visibility = () => {
            if (stateRef.current) stateRef.current.visible = !document.hidden;
        };
        document.addEventListener("visibilitychange", visibility);
        return () => {
            stateRef.current?.groups.forEach(disposeObject);
            controls.dispose?.();
            renderer.dispose();
            renderer.domElement.remove();
            stateRef.current = null;
            document.removeEventListener("visibilitychange", visibility);
        };
    }, [canvasSize.width, canvasSize.height]);

    useEffect(() => {
        const state = stateRef.current;
        if (!state) return;
        state.groups.forEach((group) => {
            state.scene.remove(group);
            disposeObject(group);
        });
        state.groups.clear();
        elements.filter((element) => element?.type === "webgl3d").forEach((element) => {
            const w = Math.max(20, Number(element.w) || 180), h = Math.max(20, Number(element.h) || 180),
                d = Math.max(8, Number(element.depth) || 70);
            const material = new THREE.MeshStandardMaterial({
                color: element.fill === "transparent" ? "#e2e8f0" : (element.fill || "#e2e8f0"),
                roughness: Number(element.roughness ?? .65),
                metalness: Number(element.metalness ?? .08),
                transparent: true
            });
            const group = buildStructuredGroup(element, material, w, h, d);
            group.userData.elementId = element.id;
            group.traverse((child) => {
                child.userData.elementId = element.id;
                child.userData.baseZ = child.position.z;
                child.userData.baseScale = child.scale.clone();
        child.userData.baseColor = child.material?.color?.clone();
                if (child.userData.depthLabel) child.visible = element.showLabels !== false;
            });
            state.scene.add(group);
            state.groups.set(element.id, group);
        });
    }, [elements, canvasSize.width, canvasSize.height]);

    useEffect(() => {
        if (!interactionCanvas) return undefined;
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const hitTest = (event) => {
            const state = stateRef.current;
            if (!state) return;
            const rect = interactionCanvas.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
            raycaster.setFromCamera(pointer, state.activeCamera);
            const hit = raycaster.intersectObjects([...state.groups.values()], true)[0];
            const id = hit?.object?.userData?.elementId;
            if (id) onSelect?.(id, event);
        };
        interactionCanvas.addEventListener("pointerdown", hitTest, true);
        return () => interactionCanvas.removeEventListener("pointerdown", hitTest, true);
    }, [interactionCanvas, onSelect]);

    useEffect(() => {
        const state = stateRef.current;
        if (!state) return;
        const selected = selectedIds.length === 1 ? state.groups.get(selectedIds[0]) : null;
        if (state.selectionHelper) {
            state.scene.remove(state.selectionHelper);
            state.selectionHelper.geometry?.dispose?.();
            state.selectionHelper.material?.dispose?.();
            state.selectionHelper = null;
        }
        if (selected) {
            state.selectionHelper = new THREE.BoxHelper(selected, 0x6366f1);
            state.scene.add(state.selectionHelper);
        }
        if (gizmoEnabled && selected) state.controls.attach(selected); else state.controls.detach();
        state.controls.setMode(gizmoMode);
        state.renderer.domElement.style.pointerEvents = gizmoEnabled && selected ? "auto" : "none";
    }, [selectedIds, gizmoEnabled, gizmoMode, elements]);

    useEffect(() => {
        const state = stateRef.current;
        if (!state) return;
        elements.filter((element) => element?.type === "webgl3d").forEach((element) => {
            const group = state.groups.get(element.id);
            if (!group) return;
            animateThreeDGroup(group, element, viewport, timeMs, element.projection3d === "perspective");
        });
        const settings = elements.find((element) => element?.type === "webgl3d") || {};
        const perspective = settings.projection3d === "perspective";
        if (perspective) {
            configurePerspectiveCamera(state.perspectiveCamera, settings, canvasSize, timeMs);
        }
        state.activeCamera = perspective ? state.perspectiveCamera : state.camera;
        state.controls.camera = state.activeCamera;
        state.selectionHelper?.update?.();
        applyLighting(state.scene, settings.lightingPreset || "studio");
        state.renderer.setPixelRatio(Math.min(elements.filter((element) => element?.type === "webgl3d").length > 30 ? 1 : 2, window.devicePixelRatio || 1));
        // Sprite depth testing hides labels behind meshes; this soft distance fade
        // keeps far labels readable without filling a dense course diagram.
        state.scene.traverse((item) => {
            if (item.userData.depthLabel && item.material) {
                const distance = state.activeCamera.position.distanceTo(item.getWorldPosition(new THREE.Vector3()));
                item.material.opacity = Math.max(.22, Math.min(1, 1800 / Math.max(1, distance)));
            }
        });
        if (state.visible) state.renderer.render(state.scene, state.activeCamera);
    }, [elements, viewport, timeMs]);

    return <div ref={hostRef} className="three-d-webgl-layer" aria-hidden="true"/>;
}
