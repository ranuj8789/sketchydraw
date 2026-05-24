Haan, bilkul. Abhi image **JSON ke andar base64 `src`** ke form mein store ho rahi hai:

```js
{
  type: "image",
  src: "data:image/png;base64,..."
}
```

Problem ye hai ki **localStorage sync hota hai**. Matlab jab tum bada JSON save/read karte ho, browser main thread block hoti hai, isliye lag aata hai.

### Important point

`localStorage` ko truly async nahi bana sakte, because browser API itself sync hai:

```js
localStorage.setItem(...)
localStorage.getItem(...)
```

But hum access ko **defer / debounce / idle time** mein chala sakte hain, jisse UI freeze kam hoga.

Best solution:

```txt
Small settings -> localStorage
Big drawing JSON / images -> IndexedDB
```

## Quick fix: async wrapper for localStorage

Create file:

```txt
src/utils/asyncStorage.js
```

```js
export function runWhenIdle(task) {
    if ("requestIdleCallback" in window) {
        return window.requestIdleCallback(task, { timeout: 2000 });
    }

    return window.setTimeout(task, 0);
}

export function asyncSetLocalStorage(key, value) {
    return new Promise((resolve, reject) => {
        runWhenIdle(() => {
            try {
                localStorage.setItem(key, value);
                resolve(true);
            } catch (error) {
                reject(error);
            }
        });
    });
}

export function asyncGetLocalStorage(key) {
    return new Promise((resolve) => {
        runWhenIdle(() => {
            try {
                resolve(localStorage.getItem(key));
            } catch {
                resolve(null);
            }
        });
    });
}

export async function asyncSetJson(key, data) {
    const json = JSON.stringify(data);
    return asyncSetLocalStorage(key, json);
}

export async function asyncGetJson(key, fallback = null) {
    const raw = await asyncGetLocalStorage(key);

    if (!raw) return fallback;

    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}
```

Then wherever you save drawing locally, replace:

```js
localStorage.setItem(key, JSON.stringify(drawing));
```

with:

```js
await asyncSetJson(key, drawing);
```

And read:

```js
const drawing = await asyncGetJson(key, null);
```

But yaad rakho: ye true async storage nahi hai. Ye sirf operation ko idle time mein push karta hai.

## Better fix: use IndexedDB for drawing JSON

IndexedDB async hota hai, large JSON/images ke liye better hai.

Create:

```txt
src/utils/drawingDb.js
```

```js
const DB_NAME = "sketchydraw_db";
const DB_VERSION = 1;
const STORE_NAME = "drawings";

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveDrawingAsync(drawing) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        store.put({
            ...drawing,
            updatedAt: new Date().toISOString(),
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

export async function getDrawingAsync(id) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function getAllDrawingsAsync() {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteDrawingAsync(id) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        store.delete(id);

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}
```

## Best architecture for your SketchyDraw

Abhi:

```txt
elements JSON -> localStorage
image base64 -> same JSON
```

Better:

```txt
Drawing metadata -> localStorage / DB
Full drawing JSON -> IndexedDB
Image base64/blob -> IndexedDB
Cloud save -> backend DB/storage
```

## Image JSON mein store kar sakte ho?

Haan, possible hai:

```js
{
  id: "img_1",
  type: "image",
  x: 100,
  y: 100,
  w: 400,
  h: 250,
  src: "data:image/jpeg;base64,..."
}
```

But large image se JSON huge ho jayega. Better is:

```js
{
  id: "img_1",
  type: "image",
  x: 100,
  y: 100,
  w: 400,
  h: 250,
  imageId: "image_abc_123"
}
```

And actual image IndexedDB mein:

```js
{
  id: "image_abc_123",
  blob: imageBlob
}
```

## Immediate recommendation

Abhi ke liye 3 cheeze karo:

```txt
1. localStorage save ko debounce 2.5s ya 5s karo
2. save/read ko async wrapper/requestIdleCallback mein daalo
3. images ko compress karke base64 banao before JSON
```

Long term:

```txt
Move drawing JSON + images to IndexedDB
```

Isse lag kaafi kam hoga, especially jab image embed feature use hoga.
