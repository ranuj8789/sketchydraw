import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { resolve3DOrbit, resolve3DStep, resolve3DTransform, resolveDataPathPoint } from "./threeDKeyframes";

const geometryFor = (primitive, w, h, d) => {
    if (primitive === "sphere" || primitive === "neuron3d") return new THREE.SphereGeometry(Math.min(w, h) * .35, 24, 16);
    if (primitive === "cylinder") return new THREE.CylinderGeometry(w * .3, w * .3, h * .7, 24);
    if (primitive === "cone") return new THREE.ConeGeometry(w * .35, h * .75, 24);
    if (primitive === "torus") return new THREE.TorusGeometry(Math.min(w, h) * .28, Math.min(w, h) * .09, 12, 32);
    return new THREE.BoxGeometry(w * .72, h * .62, Math.max(8, d));
};

export function disposeObject(object) {
    object.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
        else child.material?.dispose?.();
    });
}

function addConnection(group, a, b, color = "#64748b") {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .55 })));
}

function makeLabelSprite(text, color = "#0f172a") {
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, 256, 64); ctx.font = "700 28px Inter, Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = color; ctx.fillText(String(text), 128, 32);
    const texture = new THREE.CanvasTexture(canvas); const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    const sprite = new THREE.Sprite(material); sprite.scale.set(70, 18, 1); sprite.userData.depthLabel = true; return sprite;
}

export function buildStructuredGroup(element, material, w, h, d) {
    const group = new THREE.Group();
    const primitive = element.primitive3d || "box";
    if (primitive === "neuralnetwork3d") {
        const layers = Array.isArray(element.layers) ? element.layers : [3, 5, 5, 2];
        const points = layers.map((count, layer) => Array.from({ length: count }, (_, node) => [
            -w * .38 + layer * (w * .76 / Math.max(1, layers.length - 1)),
            h * .34 - node * (h * .68 / Math.max(1, count - 1)),
            (layer - layers.length / 2) * d * .22,
        ]));
        points.slice(0, -1).forEach((layer, index) => layer.forEach((a) => points[index + 1].forEach((b) => addConnection(group, a, b, "#94a3b8"))));
        points.flat().forEach((point) => { const node = new THREE.Mesh(new THREE.SphereGeometry(Math.max(5, Math.min(11, h / 30)), 16, 12), material.clone()); node.position.set(...point); group.add(node); });
    } else if (primitive === "graph3d") {
        const authored = Array.isArray(element.graphNodes) && element.graphNodes.length ? element.graphNodes : [{id:"A",x:.15,y:.5},{id:"B",x:.4,y:.2},{id:"C",x:.4,y:.8},{id:"D",x:.75,y:.5}];
        const points = new Map(authored.map((node, index) => [String(node.id ?? index), [(Number(node.x) - .5) * w, (.5 - Number(node.y)) * h, (index % 3 - 1) * d * .3]]));
        (element.graphEdges || [["A","B"],["A","C"],["B","D"],["C","D"]]).forEach(([from, to]) => { const a = points.get(String(from)), b = points.get(String(to)); if (a && b) addConnection(group, a, b); });
        points.forEach((point, id) => { const node = new THREE.Mesh(new THREE.SphereGeometry(13, 18, 12), material.clone()); node.position.set(...point); node.userData.stepId = id; group.add(node); const label = makeLabelSprite(id); label.position.set(point[0], point[1] + 23, point[2]); group.add(label); });
    } else if (["array3d", "sorting3d", "queue3d", "stack3d", "minheap3d", "maxheap3d"].includes(primitive)) {
        const values = element.values || element.heapValues || [7, 2, 9, 4, 1];
        const count = Math.max(1, values.length); const cell = Math.min(58, w / count);
        values.forEach((value, index) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(cell * .82, primitive === "sorting3d" ? Math.max(20, Number(value) * 8) : 44, d * .6), material.clone()); mesh.position.set((index - (count - 1) / 2) * cell, primitive === "sorting3d" ? -h * .25 + Math.max(20, Number(value) * 8) / 2 : 0, 0); mesh.userData.stepId = String(index); group.add(mesh); });
    } else {
        group.add(new THREE.Mesh(geometryFor(primitive, w, h, d), material));
    }
    if (Array.isArray(element.dataPath3d) && element.dataPath3d.length > 1) {
        const particle = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 10), new THREE.MeshBasicMaterial({ color: "#38bdf8" }));
        particle.userData.dataParticle = true; group.add(particle);
    }
    return group;
}

let exportRenderer = null;
export function isWebGLAvailable() {
    if (typeof document === "undefined") return false;
    try { const canvas = document.createElement("canvas"); return !!(canvas.getContext("webgl2") || canvas.getContext("webgl")); } catch (_) { return false; }
}
export function compositeThreeDFrame(targetCanvas, elements = [], viewport, timeMs = 0) {
    if (typeof document === "undefined" || !targetCanvas) return false;
    const items = elements.filter((element) => element?.type === "webgl3d");
    if (!items.length) return false;
    try {
        if (!exportRenderer) exportRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        const width = targetCanvas.width, height = targetCanvas.height;
        exportRenderer.setPixelRatio(1); exportRenderer.setSize(width, height, false); exportRenderer.setClearColor(0x000000, 0);
        const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, 1.8)); const light = new THREE.DirectionalLight(0xffffff, 2.2); light.position.set(-300,500,800); scene.add(light);
        const first = items[0]; const perspective = first.projection3d === "perspective";
        let camera;
        if (perspective) { const fov = Math.max(20, Math.min(100, Number(first.cameraFov) || 50)); const distance = Math.max(200, Number(first.cameraDistance) || height / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)))); camera = new THREE.PerspectiveCamera(fov, width / Math.max(1,height), .1, 10000); camera.position.set(width/2,-height/2,distance); camera.lookAt(width/2,-height/2,0); }
        else { camera = new THREE.OrthographicCamera(0,width,0,-height,-5000,5000); camera.position.z=1200; }
        items.forEach((element) => {
            const w=Math.max(20,Number(element.w)||180), h=Math.max(20,Number(element.h)||180), d=Math.max(8,Number(element.depth)||70);
            const material=new THREE.MeshStandardMaterial({color:element.fill==="transparent"?"#e2e8f0":(element.fill||"#e2e8f0"),roughness:Number(element.roughness??.65),metalness:Number(element.metalness??.08),transparent:true});
            const group=buildStructuredGroup(element,material,w,h,d); const transform=resolve3DTransform(element,timeMs); const orbit=resolve3DOrbit(element,timeMs); const path=resolveDataPathPoint(element,timeMs);
            group.position.set(transform.x*viewport.zoom+viewport.offsetX+w*viewport.zoom/2,-(transform.y*viewport.zoom+viewport.offsetY+h*viewport.zoom/2),transform.z);
            group.rotation.set((transform.rotationX+orbit.pitch)*Math.PI/180,(transform.rotationY+orbit.yaw)*Math.PI/180,transform.rotationZ*Math.PI/180); group.scale.setScalar(transform.scale3d*viewport.zoom);
            group.children.forEach((child)=>{if(child.userData.dataParticle&&path)child.position.set(path.x,-path.y,path.z);if(child.material){child.material.opacity=transform.opacity;child.material.color?.set(transform.materialColor);}}); scene.add(group);
        });
        exportRenderer.render(scene,camera); targetCanvas.getContext("2d").drawImage(exportRenderer.domElement,0,0,width,height); scene.children.forEach(disposeObject); return true;
    } catch (error) { console.warn("WebGL export compositing unavailable; canvas fallback remains active.", error); return false; }
}

export default function ThreeDWebGLLayer({ elements = [], viewport, canvasSize, timeMs = 0, interactionCanvas, selectedIds = [], onSelect, onTransformCommit, gizmoEnabled = false, gizmoMode = "translate" }) {
    const hostRef = useRef(null);
    const stateRef = useRef(null);

    useEffect(() => {
        if (!hostRef.current) return undefined;
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(0, canvasSize.width, 0, -canvasSize.height, -5000, 5000);
        camera.position.z = 1200;
        const perspectiveCamera = new THREE.PerspectiveCamera(50, canvasSize.width / Math.max(1, canvasSize.height), .1, 10000);
        const perspectiveDistance = canvasSize.height / (2 * Math.tan(THREE.MathUtils.degToRad(25)));
        perspectiveCamera.position.set(canvasSize.width / 2, -canvasSize.height / 2, perspectiveDistance);
        perspectiveCamera.lookAt(canvasSize.width / 2, -canvasSize.height / 2, 0);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: false });
        const objectCount = elements.filter((element) => element?.type === "webgl3d").length;
        renderer.setPixelRatio(Math.min(objectCount > 30 ? 1 : 2, window.devicePixelRatio || 1));
        renderer.setSize(canvasSize.width, canvasSize.height, false);
        renderer.setClearColor(0x000000, 0);
        hostRef.current.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 1.8));
        const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-300, 500, 800); scene.add(key);
        const controls = new TransformControls(camera, renderer.domElement);
        controls.setMode("translate");
        controls.addEventListener("objectChange", () => {
            const object = controls.object; if (!object?.userData?.elementId) return;
            const element = elements.find((item) => item.id === object.userData.elementId); if (!element) return;
            onTransformCommit?.(element.id, {
                x: (object.position.x - viewport.offsetX - (Number(element.w) || 180) * viewport.zoom / 2) / viewport.zoom,
                y: (-object.position.y - viewport.offsetY - (Number(element.h) || 180) * viewport.zoom / 2) / viewport.zoom,
                z: object.position.z,
                rotationX: THREE.MathUtils.radToDeg(object.rotation.x) - Number(element.cameraPitch || 0),
                rotationY: THREE.MathUtils.radToDeg(object.rotation.y) - Number(element.cameraYaw || 0),
                rotationZ: THREE.MathUtils.radToDeg(object.rotation.z),
                scale3d: Math.max(.05, object.scale.x / Math.max(.01, viewport.zoom)),
            });
        });
        const controlsHelper = controls.getHelper();
        scene.add(controlsHelper);
        stateRef.current = { scene, camera, perspectiveCamera, activeCamera: camera, renderer, controls, controlsHelper, groups: new Map(), visible: !document.hidden };
        const visibility = () => { if (stateRef.current) stateRef.current.visible = !document.hidden; };
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
        state.groups.forEach((group) => { state.scene.remove(group); disposeObject(group); });
        state.groups.clear();
        elements.filter((element) => element?.type === "webgl3d").forEach((element) => {
            const w = Math.max(20, Number(element.w) || 180), h = Math.max(20, Number(element.h) || 180), d = Math.max(8, Number(element.depth) || 70);
            const material = new THREE.MeshStandardMaterial({ color: element.fill === "transparent" ? "#e2e8f0" : (element.fill || "#e2e8f0"), roughness: Number(element.roughness ?? .65), metalness: Number(element.metalness ?? .08), transparent: true });
            const group = buildStructuredGroup(element, material, w, h, d);
            group.userData.elementId = element.id;
            group.traverse((child) => { child.userData.elementId = element.id; child.userData.baseZ = child.position.z; child.userData.baseScale = child.scale.clone(); });
            state.scene.add(group); state.groups.set(element.id, group);
        });
    }, [elements, canvasSize.width, canvasSize.height]);

    useEffect(() => {
        if (!interactionCanvas) return undefined;
        const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
        const hitTest = (event) => {
            const state = stateRef.current; if (!state) return;
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
        const state = stateRef.current; if (!state) return;
        const selected = selectedIds.length === 1 ? state.groups.get(selectedIds[0]) : null;
        if (state.selectionHelper) { state.scene.remove(state.selectionHelper); state.selectionHelper.geometry?.dispose?.(); state.selectionHelper.material?.dispose?.(); state.selectionHelper = null; }
        if (selected) { state.selectionHelper = new THREE.BoxHelper(selected, 0x6366f1); state.scene.add(state.selectionHelper); }
        if (gizmoEnabled && selected) state.controls.attach(selected); else state.controls.detach();
        state.controls.setMode(gizmoMode);
        state.renderer.domElement.style.pointerEvents = gizmoEnabled && selected ? "auto" : "none";
    }, [selectedIds, gizmoEnabled, gizmoMode, elements]);

    useEffect(() => {
        const state = stateRef.current;
        if (!state) return;
        elements.filter((element) => element?.type === "webgl3d").forEach((element) => {
            const group = state.groups.get(element.id); if (!group) return;
            const transform = resolve3DTransform(element, timeMs);
            const step = resolve3DStep(element, timeMs);
            const orbit = resolve3DOrbit(element, timeMs);
            const pathPoint = resolveDataPathPoint(element, timeMs);
            group.position.set(transform.x * viewport.zoom + viewport.offsetX + (Number(element.w) || 180) * viewport.zoom / 2, -(transform.y * viewport.zoom + viewport.offsetY + (Number(element.h) || 180) * viewport.zoom / 2), transform.z);
            const screenY = -group.position.y;
            group.visible = group.position.x > -400 && group.position.x < canvasSize.width + 400 && screenY > -400 && screenY < canvasSize.height + 400;
            group.rotation.set((transform.rotationX + orbit.pitch) * Math.PI / 180, (transform.rotationY + orbit.yaw) * Math.PI / 180, transform.rotationZ * Math.PI / 180);
            group.scale.setScalar(transform.scale3d * viewport.zoom);
            const revealCount = element.motion3d === "layerReveal" ? Math.max(1, Math.ceil(((timeMs % Math.max(100, Number(element.motionDurationMs) || 2400)) / Math.max(100, Number(element.motionDurationMs) || 2400)) * group.children.length)) : group.children.length;
            group.children.forEach((child, index) => {
                child.visible = index < revealCount || child.userData.dataParticle || child.userData.depthLabel;
                if (!child.userData.dataParticle && !child.userData.depthLabel) child.position.z = Number(child.userData.baseZ) + (index - group.children.length / 2) * Number(element.exploded3d || 0) * .002;
                if (child.userData.dataParticle && pathPoint) child.position.set(pathPoint.x, -pathPoint.y, pathPoint.z);
                const targetIndex = Number(step.step?.targetIndex ?? step.index);
                const targetId = step.step?.targetId;
                const active = step.index >= 0 && (String(child.userData.stepId) === String(targetId) || index % Math.max(1, group.children.length) === targetIndex % Math.max(1, group.children.length));
                if (child.userData.baseScale) child.scale.copy(child.userData.baseScale).multiplyScalar(active && ["insert","visit","highlight"].includes(step.step?.action || "highlight") ? 1.18 : 1);
                if (child.material) { child.material.opacity = active && step.step?.action === "extract" ? transform.opacity * Math.max(.15, 1 - step.progress) : transform.opacity; child.material.color?.set(transform.materialColor); child.material.emissive?.set(active ? "#0b65a3" : "#000000"); }
            });
        });
        const settings = elements.find((element) => element?.type === "webgl3d") || {};
        const perspective = settings.projection3d === "perspective";
        if (perspective) {
            const fov = Math.max(20, Math.min(100, Number(settings.cameraFov) || 50));
            const distance = Math.max(200, Number(settings.cameraDistance) || canvasSize.height / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))));
            state.perspectiveCamera.fov = fov;
            state.perspectiveCamera.aspect = canvasSize.width / Math.max(1, canvasSize.height);
            state.perspectiveCamera.position.set(canvasSize.width / 2 + Number(settings.cameraTargetX || 0), -canvasSize.height / 2 - Number(settings.cameraTargetY || 0), distance);
            state.perspectiveCamera.lookAt(canvasSize.width / 2 + Number(settings.cameraTargetX || 0), -canvasSize.height / 2 - Number(settings.cameraTargetY || 0), Number(settings.cameraTargetZ || 0));
            state.perspectiveCamera.updateProjectionMatrix();
        }
        state.activeCamera = perspective ? state.perspectiveCamera : state.camera;
        state.controls.camera = state.activeCamera;
        state.selectionHelper?.update?.();
        const preset = settings.lightingPreset || "studio";
        state.scene.background = preset === "dark" ? new THREE.Color("#07111f") : null;
        state.scene.traverse((item) => { if (item.isLight) item.intensity = preset === "neon" ? 3.2 : preset === "blueprint" ? 1.25 : preset === "soft" ? 1.55 : 2; });
        if (state.visible) state.renderer.render(state.scene, state.activeCamera);
    }, [elements, viewport, timeMs]);

    return <div ref={hostRef} className="three-d-webgl-layer" aria-hidden="true" />;
}
