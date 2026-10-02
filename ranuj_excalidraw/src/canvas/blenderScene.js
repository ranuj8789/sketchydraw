import * as THREE from "three";
import { buildStructuredGroup, initializeThreeDGroup, animateThreeDGroup, configurePerspectiveCamera, disposeObject } from "../components/3d/ThreeDWebGLLayer";

// Export real geometry rather than approximating each educational object with a box.
export function createBlenderScene(elements) {
    const groups = elements.filter(element => element.type === "webgl3d").map(element => {
        const material = new THREE.MeshStandardMaterial({color: element.fill === "transparent" ? "#e2e8f0" : element.fill || "#e2e8f0", roughness: element.roughness ?? .65, metalness: element.metalness ?? .08});
        const group = buildStructuredGroup(element, material, Math.max(20, Number(element.w) || 180), Math.max(20, Number(element.h) || 180), Math.max(8, Number(element.depth) || 70));
        initializeThreeDGroup(group);
        return { element, group };
    });
    const nodes = [];
    groups.forEach(({group}) => group.traverse(node => {
        if (!node.geometry && !node.userData.depthLabel) return;
        nodes.push(node);
    }));
    const geometry = nodes.map(node => {
        if (node.userData.depthLabel) return { kind: "text", text: node.userData.labelText, color: node.userData.labelColor, widthRatio: node.userData.labelWidthRatio, heightRatio: node.userData.labelHeightRatio };
        const position = node.geometry.getAttribute("position");
        const vertices = Array.from({length: position.count}, (_, i) => [position.getX(i), position.getY(i), position.getZ(i)]);
        const indices = node.geometry.index ? Array.from(node.geometry.index.array) : Array.from({length: position.count}, (_, i) => i);
        return { kind: node.isLine ? "line" : "mesh", vertices, indices, roughness: node.material?.roughness ?? .65, metalness: node.material?.metalness ?? .08 };
    });
    return {
        geometry,
        sample(viewport, size, timeMs, visible) {
            const settings = groups[0]?.element || {};
            const perspective = settings.projection3d === "perspective";
            const camera = perspective ? new THREE.PerspectiveCamera(50, size.width / size.height, .1, 10000) : new THREE.OrthographicCamera(0, size.width, 0, -size.height, -5000, 5000);
            if (perspective) configurePerspectiveCamera(camera, settings, size, timeMs);
            else camera.position.set(size.width / 2, -size.height / 2, 1200);
            camera.updateMatrixWorld(true);
            groups.forEach(({group, element}) => { animateThreeDGroup(group, element, viewport, timeMs, perspective); group.visible = visible(element); });
            return {
                camera: { matrix: camera.matrixWorld.toArray(), perspective, fov: camera.fov || 50 },
                nodes: nodes.map(node => {
                    let shown = node.visible;
                    for (let parent = node.parent; parent; parent = parent.parent) shown = shown && parent.visible;
                    return { matrix: node.matrixWorld.toArray(), visible: shown, color: node.material?.color?.getHexString() || "64748b", emission: node.material?.emissive?.getHexString() || "000000", opacity: node.material?.opacity ?? 1 };
                }),
            };
        },
        dispose() { groups.forEach(({group}) => disposeObject(group)); },
    };
}
