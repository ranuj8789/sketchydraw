Yes — do 3 fixes:

1. **Line straight/curved change should need more mouse movement**
2. **Alignment guide should blink/show when object comes near line**
3. **Alignment guide color = magenta**
4. **Snap/alignment distance increase**

Use these values.

### 1. Increase snap/alignment distance

Find your alignment constants, something like:

```js
const SNAP_THRESHOLD = 6;
const ALIGNMENT_THRESHOLD = 6;
```

Change to:

```js
const SNAP_THRESHOLD = 12;
const ALIGNMENT_THRESHOLD = 12;
```

If you have only one:

```js
const GUIDE_THRESHOLD = 6;
```

Change to:

```js
const GUIDE_THRESHOLD = 12;
```

---

### 2. Make alignment guide magenta

Find where guide line is drawn:

```js
ctx.strokeStyle = "red";
```

or:

```js
ctx.strokeStyle = "#ef4444";
```

Replace with:

```js
ctx.strokeStyle = "#ff00ff";
ctx.lineWidth = 1.5;
ctx.setLineDash([6, 4]);
```

After drawing guide, reset:

```js
ctx.setLineDash([]);
```

---

### 3. Make line tool less fragile

Find your line drag/move logic where line becomes curved or control point changes on mouse move.

Add this threshold:

```js
const LINE_CURVE_ACTIVATION_DISTANCE = 18;
```

Then before changing line curve/control point, add:

```js
const dx = currentX - startX;
const dy = currentY - startY;
const distance = Math.sqrt(dx * dx + dy * dy);

if (distance < LINE_CURVE_ACTIVATION_DISTANCE) {
    return;
}
```

For straight line drawing, also snap small movement to straight:

```js
if (Math.abs(dx) < 8) {
    currentX = startX;
}

if (Math.abs(dy) < 8) {
    currentY = startY;
}
```

---

Best values for your app:

```js
const SNAP_THRESHOLD = 12;
const ALIGNMENT_THRESHOLD = 12;
const LINE_CURVE_ACTIVATION_DISTANCE = 18;
const GUIDE_COLOR = "#ff00ff";
```

This will make line less sensitive and alignment more visible.
