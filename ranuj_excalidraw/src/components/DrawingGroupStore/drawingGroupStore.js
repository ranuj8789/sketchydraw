export const DEFAULT_GROUP = "My Workspace";
export const DEFAULT_TITLE = "Untitled";

const GROUPS_KEY = "sketchydraw_drawing_groups";
const DELETED_GROUPS_KEY = "sketchydraw_deleted_drawing_groups";

function normalizeName(name) {
    const value = String(name || "").trim();
    return value || DEFAULT_GROUP;
}

function normalizeKey(name) {
    return normalizeName(name).toLowerCase();
}

function makeGroupId(name) {
    return normalizeName(name).toLowerCase().replace(/\s+/g, "-");
}

function readJsonArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function writeJsonArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function readDeletedGroups() {
    return readJsonArray(DELETED_GROUPS_KEY)
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean);
}

function saveDeletedGroups(keys) {
    const unique = Array.from(new Set(keys.filter(Boolean)));
    writeJsonArray(DELETED_GROUPS_KEY, unique);
    return unique;
}

function isDeletedGroup(name) {
    if (normalizeName(name) === DEFAULT_GROUP) return false;
    return readDeletedGroups().includes(normalizeKey(name));
}

function readRawGroups() {
    const saved = readJsonArray(GROUPS_KEY)
        .map((item) => (typeof item === "string" ? item : item?.name))
        .filter(Boolean)
        .map(normalizeName)
        .filter((name) => !isDeletedGroup(name));

    return Array.from(new Set([DEFAULT_GROUP, ...saved]));
}

function saveRawGroups(groupNames) {
    const unique = Array.from(
        new Set([DEFAULT_GROUP, ...groupNames.map(normalizeName)])
    ).filter((name) => !isDeletedGroup(name));

    writeJsonArray(GROUPS_KEY, unique);
    return unique;
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

export function getDrawingGroups() {
    return getStoredGroups().map((name) => ({
        id: makeGroupId(name),
        name,
    }));
}

export function getStoredGroups() {
    return saveRawGroups(readRawGroups());
}

export function saveStoredGroup(groupName) {
    const name = normalizeName(groupName);

    const deleted = readDeletedGroups().filter(
        (item) => item !== normalizeKey(name)
    );
    saveDeletedGroups(deleted);

    return saveRawGroups([...readRawGroups(), name]);
}

export function upsertDrawingGroup(groupName) {
    return saveStoredGroup(groupName);
}

export function deleteStoredGroup(groupName) {
    const name = normalizeName(groupName);

    if (name === DEFAULT_GROUP || name === "All") {
        return getStoredGroups();
    }

    const key = normalizeKey(name);
    const deleted = readDeletedGroups();

    if (!deleted.includes(key)) {
        saveDeletedGroups([...deleted, key]);
    }

    const nextGroups = readRawGroups().filter(
        (item) => normalizeKey(item) !== key
    );

    writeJsonArray(GROUPS_KEY, nextGroups);

    return getStoredGroups();
}

export function mergeGroupsFromDrawings(drawings = []) {
    const existingGroups = readRawGroups();

    const drawingGroups = drawings
        .map(getGroupNameFromDrawing)
        .filter((name) => !isDeletedGroup(name));

    return saveRawGroups([...existingGroups, ...drawingGroups]);
}