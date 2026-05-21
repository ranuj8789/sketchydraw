Done. I created a **performance patch zip** with optimized replacement files:

[Download performance patch zip](sandbox:/mnt/data/sketchydraw-performance-patch.zip)
[Download diff patch](sandbox:/mnt/data/sketchydraw-performance.patch)

### Files changed

Replace these 4 files in your project:

```txt
src/App.js
src/canvas/useCanvasRender.js
src/canvas/canvasRender.js
src/components/CanvasBoard/CanvasBoard.js
```

### What I improved

1. **Canvas rendering now uses `requestAnimationFrame`**

    * Prevents immediate repaint on every React state change.
    * Browser batches canvas drawing better.

2. **Canvas no longer resizes on every render**

    * Your old code was doing:

```js
canvas.width = canvasSize.width * dpr;
canvas.height = canvasSize.height * dpr;
```

on every render. This is expensive because it clears/reset canvas each time.

3. **Dragging/mouse move is throttled**

    * Mouse move now runs maximum once per animation frame.
    * This reduces lag while moving shapes, resizing, selecting, and panning.

4. **Selection lookup improved**

    * Changed:

```js
selectedIds.includes(element.id)
```

to a `Set`, so lookup is faster when many elements exist.

5. **Undo/redo clone improved**

    * Uses `structuredClone()` where available.
    * Keeps history limited to `80` snapshots to avoid memory growing forever.

### How to apply

From your project root:

```bash
unzip ~/Downloads/sketchydraw-performance-patch.zip -d src
npm start
```

Or manually copy files from the zip into your existing `src`.

### Very important next bigger improvement

For best SketchyDraw performance, next we should move active dragging/resizing state into refs and draw directly on canvas during drag, then commit to React state only on `mouseUp`.

Right now React still re-renders during dragging. This patch reduces the pressure, but the next step will make dragging much smoother for large drawings.
