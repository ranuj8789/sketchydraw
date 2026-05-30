const DB_NAME = "sketchydraw_indexed_db";
const DB_VERSION = 2;

const STORES = {
    SNAPSHOTS: "drawing_snapshots",
    VIDEO_FRAMES: "video_frames",
    HISTORY_STACK: "history_stack",
};

function openSketchyDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB is not supported in this browser."));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
                db.createObjectStore(STORES.SNAPSHOTS, { keyPath: "id" });
            }

            if (!db.objectStoreNames.contains(STORES.VIDEO_FRAMES)) {
                db.createObjectStore(STORES.VIDEO_FRAMES, { keyPath: "id" });
            }

            if (!db.objectStoreNames.contains(STORES.HISTORY_STACK)) {
                db.createObjectStore(STORES.HISTORY_STACK, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB."));
    });
}

function runAsync(task) {
    if (typeof window === "undefined") return;

    if ("requestIdleCallback" in window) {
        window.requestIdleCallback(task, { timeout: 1500 });
        return;
    }

    window.setTimeout(task, 0);
}

async function putRecord(storeName, record) {
    const db = await openSketchyDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        store.put(record);

        tx.oncomplete = () => {
            db.close();
            resolve(true);
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error || new Error(`Unable to write ${storeName}.`));
        };
    });
}

async function clearStore(storeName) {
    const db = await openSketchyDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).clear();

        tx.oncomplete = () => {
            db.close();
            resolve(true);
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error || new Error(`Unable to clear ${storeName}.`));
        };
    });
}

async function getRecord(storeName, id) {
    const db = await openSketchyDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(id);

        request.onsuccess = () => resolve(request.result || null);

        tx.oncomplete = () => {
            db.close();
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error || new Error(`Unable to read ${storeName}.`));
        };
    });
}

export function saveDrawingSnapshotAsync({ id = "latest", json, imageDataUrl }) {
    runAsync(async () => {
        try {
            await putRecord(STORES.SNAPSHOTS, {
                id,
                json,
                imageDataUrl: imageDataUrl || null,
                updatedAt: new Date().toISOString(),
            });
        } catch (error) {
            console.warn("SketchyDraw IndexedDB snapshot save failed:", error);
        }
    });
}

export function resetVideoFramesAsync() {
    runAsync(async () => {
        try {
            await clearStore(STORES.VIDEO_FRAMES);
        } catch (error) {
            console.warn("SketchyDraw IndexedDB video frame reset failed:", error);
        }
    });
}

export function saveVideoFrameAsync({ index, elements, imageDataUrl }) {
    runAsync(async () => {
        try {
            await putRecord(STORES.VIDEO_FRAMES, {
                id: `frame_${String(index).padStart(4, "0")}`,
                index,
                elements,
                imageDataUrl,
                updatedAt: new Date().toISOString(),
            });
        } catch (error) {
            console.warn("SketchyDraw IndexedDB video frame save failed:", error);
        }
    });
}

export function saveHistoryStackAsync({ history, historyIndex }) {
    runAsync(async () => {
        try {
            await putRecord(STORES.HISTORY_STACK, {
                id: "latest",
                history: Array.isArray(history) ? history : [[]],
                historyIndex: Number.isFinite(historyIndex) ? historyIndex : 0,
                updatedAt: new Date().toISOString(),
            });
        } catch (error) {
            console.warn("SketchyDraw IndexedDB history stack save failed:", error);
        }
    });
}

export async function loadHistoryStack() {
    try {
        return await getRecord(STORES.HISTORY_STACK, "latest");
    } catch (error) {
        console.warn("SketchyDraw IndexedDB history stack load failed:", error);
        return null;
    }
}

export async function clearHistoryStackNow() {
    try {
        await clearStore(STORES.HISTORY_STACK);
        return true;
    } catch (error) {
        console.warn("SketchyDraw IndexedDB history stack clear failed:", error);
        return false;
    }
}

export async function resetVideoFramesNow() {
    try {
        await clearStore(STORES.VIDEO_FRAMES);
        return true;
    } catch (error) {
        console.warn("SketchyDraw IndexedDB video frame reset failed:", error);
        return false;
    }
}

export async function saveVideoFrameNow({ index, elements, imageDataUrl }) {
    try {
        await putRecord(STORES.VIDEO_FRAMES, {
            id: `frame_${String(index).padStart(4, "0")}`,
            index,
            elements,
            imageDataUrl,
            updatedAt: new Date().toISOString(),
        });

        return true;
    } catch (error) {
        console.warn("SketchyDraw IndexedDB video frame save failed:", error);
        return false;
    }
}
