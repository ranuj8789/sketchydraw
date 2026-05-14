import { uid } from "../utils/geometry";

export function cloneElementsForPaste(items, offset = 24) {
    const idMap = new Map();

    const cloned = items.map((el) => {
        const newId = uid();
        idMap.set(el.id, newId);

        let copy = {
            ...el,
            id: newId,
        };

        if ("x" in copy) copy.x += offset;
        if ("y" in copy) copy.y += offset;
        if ("x1" in copy) copy.x1 += offset;
        if ("y1" in copy) copy.y1 += offset;
        if ("x2" in copy) copy.x2 += offset;
        if ("y2" in copy) copy.y2 += offset;

        if (copy.points) {
            copy.points = copy.points.map((pt) => ({
                x: pt.x + offset,
                y: pt.y + offset,
            }));
        }

        return copy;
    });

    return cloned.map((el) => ({
        ...el,
        parentId: el.parentId ? idMap.get(el.parentId) || null : null,
    }));
}