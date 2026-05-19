import { DEFAULT_GROUP, DEFAULT_TITLE } from "./drawingGroupStore";

export const LOCAL_DRAWINGS_KEY = "sketchydraw_saved_drawings_cache";

function safeParse(value, fallback) {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function nowIso() {
    return new Date().toISOString();
}

function normalizeTitle(title) {
    const value = String(title || "").trim();
    return value || DEFAULT_TITLE;
}

function normalizeGroupName(groupName) {
    const value = String(groupName || "").trim();
    return value || DEFAULT_GROUP;
}

function buildLocalId() {
    return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listLocalDrawings() {
    if (typeof window === "undefined") return [];

    const rows = safeParse(localStorage.getItem(LOCAL_DRAWINGS_KEY), []);

    if (!Array.isArray(rows)) return [];

    return rows
        .filter(Boolean)
        .map((row) => ({
            ...row,
            groupName: normalizeGroupName(row.groupName || row.workspace),
            workspace: normalizeGroupName(row.workspace || row.groupName),
            title: normalizeTitle(row.title),
            source: row.source || "local",
        }))
        .sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return bTime - aTime;
        });
}

export function getLocalDrawingById(id) {
    if (!id) return null;

    return listLocalDrawings().find(
        (item) => String(item.id) === String(id)
    );
}

export function saveLocalDrawing({
                                     id,
                                     title,
                                     groupName,
                                     description,
                                     elements,
                                     viewport,
                                     canvasSize,
                                     drawingJson,
                                     userEmail,
                                 }) {
    if (typeof window === "undefined") return null;

    const currentTime = nowIso();
    const finalId = id || buildLocalId();
    const finalTitle = normalizeTitle(title);
    const finalGroup = normalizeGroupName(groupName);

    const existingRows = listLocalDrawings();

    const existingRow = existingRows.find(
        (item) => String(item.id) === String(finalId)
    );

    const drawingData =
        drawingJson ||
        JSON.stringify({
            version: 1,
            app: "SketchyDraw",
            title: finalTitle,
            groupName: finalGroup,
            workspace: finalGroup,
            description: description || "",
            savedAt: currentTime,
            data: {
                version: 1,
                elements: elements || [],
                viewport: viewport || {
                    zoom: 1,
                    offsetX: 0,
                    offsetY: 0,
                },
                canvas: {
                    width: canvasSize?.width || 1200,
                    height: canvasSize?.height || 700,
                },
            },
        });

    const row = {
        id: finalId,
        title: finalTitle,
        groupName: finalGroup,
        workspace: finalGroup,
        description: description || "",
        drawingJson: drawingData,
        userEmail: userEmail || existingRow?.userEmail || "",
        source: "local",
        createdAt: existingRow?.createdAt || currentTime,
        updatedAt: currentTime,
    };

    const nextRows = [
        row,
        ...existingRows.filter((item) => String(item.id) !== String(finalId)),
    ];

    localStorage.setItem(LOCAL_DRAWINGS_KEY, JSON.stringify(nextRows));

    return row;
}

export function saveServerDrawingToLocalCache(savedDrawing) {
    if (!savedDrawing?.id) return null;

    return saveLocalDrawing({
        id: savedDrawing.id,
        title: savedDrawing.title,
        groupName: savedDrawing.groupName || savedDrawing.workspace,
        description: savedDrawing.description,
        drawingJson: savedDrawing.drawingJson,
        userEmail: savedDrawing.userEmail,
    });
}

export function deleteLocalDrawing(id) {
    if (typeof window === "undefined") return;

    const nextRows = listLocalDrawings().filter(
        (item) => String(item.id) !== String(id)
    );

    localStorage.setItem(LOCAL_DRAWINGS_KEY, JSON.stringify(nextRows));
}

export function mergeLocalAndServerDrawings(serverDrawings = []) {
    const map = new Map();

    listLocalDrawings().forEach((drawing) => {
        map.set(String(drawing.id), {
            ...drawing,
            source: drawing.source || "local",
        });
    });

    serverDrawings.forEach((drawing) => {
        if (!drawing?.id) return;

        const groupName = normalizeGroupName(
            drawing.groupName || drawing.group_name || drawing.workspace
        );

        map.set(String(drawing.id), {
            ...drawing,
            groupName,
            workspace: groupName,
            title: normalizeTitle(drawing.title),
            source: "server",
        });
    });

    return Array.from(map.values()).sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
    });
}
export function getLatestLocalDrawing() {
    const rows = listLocalDrawings();
    return rows.length > 0 ? rows[0] : null;
}