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


Haan, priority order ye rakho — **maximum value, minimum complexity**:

## SketchyDraw priority order

### 1. Freeze current basics

```text
Text stable
Rectangle move/resize stable
Notebook text line stable
Save/load stable
Export stable
```

Isko touch mat karo unless bug aaye.

### 2. Layer tools

Sabse pehle ye banao:

```text
Bring to front
Send to back
Move forward
Move backward
```

Reason: image/text/rectangle overlap hoga, user ko control chahiye.

### 3. Duplicate

```text
Cmd/Ctrl + D
Right click → Duplicate
Toolbar button maybe later
```

Ye very useful hai for layouts, Instagram, flyers.

### 4. Lock / unlock

```text
Lock object
Unlock object
Locked object select na ho accidentally
```

Notebook pages, background images, templates ke liye important.

### 5. Group / ungroup

```text
Select multiple → Group
Ungroup
Move group together
Resize group later optional
```

Flyer/magazine/Instagram layout ke liye must-have.

### 6. Image opacity + border

```text
Opacity slider
Border on/off
Border color
Rounded corners
```

Image already hai, ye usko professional banayega.

### 7. Image crop

Crop powerful hai, but thoda complex. Layer/group ke baad karo.

```text
Double click image → crop mode
Drag crop box
Apply crop
Reset crop
```

### 8. Canvas layout guides

Isko ek clean dropdown banao:

```text
Guides
- None
- Notebook pages
- Instagram square
- Instagram portrait
- Instagram 3x3
- Flyer
- Magazine 2-column
- Magazine 3-column
```

### 9. Export presets

Guides ke baad export powerful ho jayega:

```text
Export full canvas
Export selected
Export Instagram tiles
Export page
Export flyer
```

### 10. Templates

Last mein templates:

```text
Instagram post template
Flyer template
Magazine page template
System design template
Flowchart template
Notebook teaching template
```

## My suggested build order

```text
Week 1:
Layer tools + duplicate + lock/unlock

Week 2:
Group/ungroup + image opacity/border/rounded corners

Week 3:
Notebook pages + Instagram grid

Week 4:
Flyer/magazine guides + export presets
```

For now, next best feature is:

```text
Layer tools + Duplicate
```

Because image, text, rectangle sab mein immediately useful hoga.

Haan, possible hai — but ye **normal text se rich text** ban jayega.

Abhi tumhara text object likely aisa hai:

```js
{
  type: "text",
  text: "Hello world",
  fontSize: 24,
  bold: false,
  italic: false,
  underline: false
}
```

Single word format ke liye text ko runs mein store karna padega:

```js
{
  type: "text",
  text: "Hello world",
  runs: [
    { start: 0, end: 5, bold: true },
    { start: 6, end: 11, color: "#ef4444" }
  ]
}
```

Example:

```text
Hello world
```

Agar sirf `Hello` bold ho:

```js
runs: [
  {
    start: 0,
    end: 5,
    bold: true
  }
]
```

## Iska impact

Ye files touch hongi:

```text
TextEditor.js
canvasText.js
canvasFactories.js
textMetrics.js
textRenderStyle.js
drawing.js
Properties panel / text toolbar
```

## Best phased approach

### Phase 1 — Simple selected word format

Text edit mode mein user word select kare:

```text
Hello world
```

Then click:

```text
Bold / Italic / Underline / Color
```

We store formatting in `runs`.

### Phase 2 — Canvas render rich text

Canvas draw karte time line ko split karna padega:

```text
Hello = bold
space = normal
world = red
```

Canvas mein `ctx.fillText()` word-by-word draw karna padega.

### Phase 3 — Measure rich text

Text width/height calculate karna hoga runs ke according.

## My recommendation

Kar sakte hain, but **abhi mat karo** unless text system fully stable hai.

Priority mein isko rakho:

```text
After:
1. layer tools
2. duplicate
3. lock/unlock
4. group/ungroup
5. image opacity/crop
```

Because rich text is powerful but thoda risky hai. Text stability abhi finally good hui hai. Rich text add karte hi text rendering complex ho jayegi.

Best compromise:

```text
First add whole-text formatting only.
Later add selected-word formatting.
```

But yes, feature valuable hai — especially for notebook, flyers, Instagram, magazine layouts.
Haan, ye feature ka naam hota hai:

```text
Minimap / Canvas Navigator / Overview Map
```

Jaise Figma/Excalidraw mein chhota map dikhta hai jisme pura canvas aur current viewport rectangle dikhta hai.

Tumhare issue ke liye best fix:

```text
1. Add Minimap bottom-right
2. Show all objects as small boxes/lines
3. Show current viewport as highlighted rectangle
4. Click/drag minimap = jump/pan canvas
5. Reset button = fit all elements in center
6. If canvas blank/not visible, reset should bring viewport to default center
```

Reset ka logic simple hona chahiye:

### Case 1: elements hain

```text
Reset = fit all elements into visible canvas with padding
```

### Case 2: elements nahi hain

```text
Reset = viewport offsetX = 0, offsetY = 0, zoom = 1
```

Mere hisaab se next feature order mein ye bhi important hai:

```text
1. Reset/Fit to content fix
2. Minimap / overview navigator
3. Layer tools
```

Kyunki agar canvas kabhi dikhta nahi hai, user panic karega. Pehle **Reset + Fit to content** stable karo, phir minimap add karo.
