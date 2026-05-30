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

Understood.

Kal ka plan ye rahega:

1. **Frames panel mein frame preview/slideshow view**

    * User frame select kare.
    * Selected frame canvas par load ho.
    * Preview mode mein us frame ki animation chale.

2. **Enter key se next frame**

    * Frames panel open ho ya slideshow mode active ho.
    * `Enter` press = next frame.
    * Last frame par either stop or loop, jo tum chaho.

3. **Har frame view par animation run hogi**

    * Frame click karo → us frame ki animation start se chale.
    * Enter se next frame → next frame ki animation start se chale.
    * Normal edit mode mein full text rahega, animation sirf preview/slideshow/video mein chalegi.

4. **Animation rule**

    * Animated text pehle hidden.
    * Animation chalegi.
    * Animation complete hone ke baad final text dikh jayega.

Kal hum mainly ye files touch karenge:

```txt
src/components/FramesPanel/FramesPanel.js
src/components/FramesPanel/FramesPanel.css
src/App.js
src/canvas/canvasRender.js
src/canvas/exportAnimationVideo.js
src/utils/drawing.js
```

Yes, samajh gaya: PowerPoint-style basic preview behavior chahiye — frame select/enter karo, animation play ho.


Yes, exactly. Ye ab clear product flow ban raha hai.

Frame panel ko simple list se **Frame Editor** banana hai:

```txt
Frame 1
- visible / hidden
- duration
- animation on/off
- delete
- duplicate/add after

Frame 2
- visible / hidden
- duration
- animation on/off
```

Then video export sirf wahi frames lega jo visible hain.

## Final phased plan

**Phase 1 — Current**
Frames list, add/delete, basic slideshow, counter.

**Phase 2 — Frame Editor**
Frame-level controls:

```txt
Visible in video: yes/no
Frame duration: 0.5s / 1s / 2s
Frame name/title
Duplicate frame
Delete frame
```

**Phase 3 — Preview**
Click frame → animation preview chale.
Enter → next frame.
Space → play/pause slideshow.

**Phase 4 — Video**
Video export:

```txt
Only visible frames
Use per-frame duration
Run text/object animation inside each frame
Skip hidden frames
```

This is right direction. Kal Phase 2 start karenge: **Frame Editor with visible/hidden + duration + duplicate/delete**.


Yes, understood. Ye **Spotlight / Presenter tool** hoga.

Use case:

```txt
User diagram explain kar raha hai
Spotlight tool select karega
Canvas par click karega
Us area par attention effect aayega
Video/GIF export mein woh effect dikhega
```

## Spotlight behavior

Tool select:

```txt
Tools → Spotlight
```

Canvas par click:

```txt
1. Spotlight circle create hoga
2. Background thoda dim ho sakta hai
3. Clicked area zoom/attention effect karega
4. Video/GIF mein spotlight animation chalegi
```

## Effects we can add

First version mein simple rakho:

```txt
Spotlight Circle
- dark overlay + clear circle

Zoom Pulse
- clicked area 1.5x / 2x pulse

Click Ripple
- circle ripple like mouse click

Pointer Focus
- cursor/hand pointer with glow

Highlight Box
- rectangle glow around selected area
```

## Data model

Canvas element ke andar spotlight object save karenge:

```js
{
  id: "spotlight_123",
  type: "spotlight",
  x: 400,
  y: 250,
  radius: 90,
  zoom: 1.5,
  effect: "zoomPulse",
  durationMs: 900,
  delayMs: 0
}
```

## Properties panel

Spotlight selected ho to properties mein:

```txt
Spotlight
Effect: Spotlight / Zoom Pulse / Ripple
Zoom: 1.5x / 2x
Size: Small / Medium / Large
Duration: Fast / Normal / Slow
Dim background: On/Off
```

## Video/GIF export

Video export mein:

```txt
Frame starts
Spotlight hidden
Spotlight animation runs
After animation, spotlight disappears or remains, based on setting
```

For explanation videos, best default:

```txt
Effect: Zoom Pulse
Zoom: 1.5x
Duration: 700ms
Dim background: true
```

## Where it fits in roadmap

After current frames/animation work:

```txt
1. Frame editor
2. Animation preview/slideshow
3. Video export stable
4. GIF tools
5. Spotlight presenter tool
6. Stop feature work and test/sell
```

This spotlight feature is actually very good for selling because it makes SketchyDraw feel like an **explainer video tool**, not just a drawing tool.

Perfect. Scope freeze clear:

```txt
1. Frame editor
2. Animation preview / slideshow
3. Video export stable
4. GIF tools
5. Spotlight / presenter tool
6. Instagram grid/canvas export
```

Uske baad **no more features**.

Then only:

```txt
testing
bug fixing
landing page
demo videos
pricing
selling
```

This is the right decision. Otherwise product kabhi finish nahi hoga.
