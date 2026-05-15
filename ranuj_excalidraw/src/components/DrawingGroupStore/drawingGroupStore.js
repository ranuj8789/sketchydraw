export const DEFAULT_GROUP = "My Workspace";
export const DEFAULT_TITLE = "Untitled";

const GROUPS_KEY = "sketchydraw_drawing_groups";

function normalizeName(name) {
    const value = String(name || "").trim();
    return value || DEFAULT_GROUP;
}

function makeGroupId(name) {
    return normalizeName(name).toLowerCase().replace(/\s+/g, "-");
}

function readRawGroups() {
    try {
        const saved = JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]");

        return saved
            .map((item) => (typeof item === "string" ? item : item?.name))
            .filter(Boolean)
            .map(normalizeName);
    } catch {
        return [];
    }
}

function saveRawGroups(groupNames) {
    const uniqueNames = Array.from(
        new Set([DEFAULT_GROUP, ...groupNames.map(normalizeName)])
    );

    localStorage.setItem(GROUPS_KEY, JSON.stringify(uniqueNames));

    return uniqueNames;
}

function extractGroupFromDrawingJson(drawing) {
    try {
        const raw =
            drawing?.drawingJson ||
            drawing?.drawing_json ||
            drawing?.content ||
            drawing?.data ||
            drawing?.json;

        if (!raw) return null;

        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

        return (
            parsed?.groupName ||
            parsed?.group_name ||
            parsed?.workspace ||
            parsed?.workspaceName ||
            parsed?.data?.groupName ||
            parsed?.data?.workspace ||
            null
        );
    } catch {
        return null;
    }
}

export function getGroupNameFromDrawing(drawing) {
    return normalizeName(
        drawing?.groupName ||
        drawing?.group_name ||
        drawing?.group ||
        drawing?.workspace ||
        drawing?.workspaceName ||
        drawing?.folderName ||
        extractGroupFromDrawingJson(drawing) ||
        DEFAULT_GROUP
    );
}

/**
 * New object-based API.
 */
export function getDrawingGroups() {
    const names = saveRawGroups(readRawGroups());

    return names.map((name) => ({
        id: makeGroupId(name),
        name,
    }));
}

/**
 * New object-based API.
 */
export function upsertDrawingGroup(groupName) {
    const name = normalizeName(groupName);
    const existing = readRawGroups();

    const exists = existing.some(
        (item) => item.toLowerCase() === name.toLowerCase()
    );

    const next = exists ? existing : [...existing, name];

    saveRawGroups(next);

    return getDrawingGroups();
}

/**
 * Old API used by SaveDrawingPopup / MyDrawingsPopup.
 * Returns string array.
 */
export function getStoredGroups() {
    return saveRawGroups(readRawGroups());
}

/**
 * Old API used by SaveDrawingPopup / MyDrawingsPopup.
 * Returns string array.
 */
export function saveStoredGroup(groupName) {
    const name = normalizeName(groupName);
    const existing = readRawGroups();

    const exists = existing.some(
        (item) => item.toLowerCase() === name.toLowerCase()
    );

    const next = exists ? existing : [...existing, name];

    return saveRawGroups(next);
}

/**
 * Old API used by MyDrawingsPopup.
 * Returns string array.
 */
export function mergeGroupsFromDrawings(drawings = []) {
    const existing = readRawGroups();

    const groupsFromDrawings = drawings.map(getGroupNameFromDrawing);

    return saveRawGroups([...existing, ...groupsFromDrawings]);
}