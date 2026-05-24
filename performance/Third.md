Haan, lag ka main reason abhi ye hai: tumne `requestAnimationFrame` add kar diya, but **mousemove ke andar abhi bhi `setElements()` chal raha hai**. Matlab har drag/move/resize pe React state update ho rahi hai, component re-render ho raha hai, canvas redraw ho raha hai.

Real performance improvement yahan se aayegi:

## 1. Biggest fix: drag/resize ke time React state update mat karo

Abhi flow roughly aisa hai:

```txt
mousemove -> setElements -> React render -> canvas render
```

Better flow:

```txt
mousedown -> original elements ref mein store
mousemove -> ref update karo + canvas direct redraw
mouseup -> ek baar setElements + commitHistory
```

Isse 70–80% lag kam hoga.

Abhi tumhare `CanvasBoard.js` mein move/resize ke andar ye expensive hai:

```js
setElements((prev) => {
   ...
});
```

This should not run continuously during drag.

## 2. LocalStorage ko drawing ke liye avoid karo

Tum image ko JSON mein base64 ke form mein save kar rahe ho:

```js
src: "data:image/png;base64,..."
```

Ye JSON bahut bada ho jata hai. Aur `localStorage.setItem()` **sync** hota hai, browser freeze kar sakta hai.

Better:

```txt
Small settings -> localStorage
Drawing JSON + images -> IndexedDB
```

Immediate fix:

```txt
Auto-save debounce 800ms se 3000ms / 5000ms karo
Drag ke time autosave skip karo
```

## 3. Image ko compress karke JSON mein daalo

Original image 3MB hai to base64 JSON 4MB+ ho jayega. Before storing, image ko resize/compress karo:

```txt
max width/height: 1200px
quality: 0.75 - 0.85
format: jpeg/webp
```

This will make save/open/export much faster.

## 4. Alignment guides expensive hain

Move ke time tum har moving object ko har stationary object se compare kar rahe ho.

Agar 200 objects hain, ye heavy ho jata hai.

Improve:

```txt
Alignment guide only every 3rd frame
Ya sirf selected object ke nearby objects check karo
Ya temporarily disable guide when elements > 300
```

## 5. Hit testing throttle karo

Mouse move pe cursor change ke liye repeatedly:

```txt
findTopElementAtPoint
getElementBounds
getResizeHandleAtPoint
```

chal raha hai.

Improve:

```txt
cursor hit-test max every 40ms
pointer 3px se kam move hua ho to skip
```

## 6. Viewport culling

Canvas har baar saare elements draw kar raha hoga. Jo screen ke bahar hain unko draw mat karo.

Rule:

```txt
Only draw visible elements + 200px padding
```

Large drawing mein ye huge improvement dega.

## 7. Two-canvas architecture best hai

Future best structure:

```txt
Main canvas: stable elements
Overlay canvas: selected element, dragging preview, alignment guides
```

During drag sirf overlay redraw hoga. Main canvas untouched rahega. Ye Excalidraw/Figma style performance pattern hai.

## 8. Web Worker kahan useful hoga?

Web worker normal canvas drag ke liye first solution nahi hai. Worker best hai for:

```txt
image compression
large JSON stringify/parse
export SVG/PDF/GIF
autosave preparation
```

But dragging performance ke liye main fix hai:

```txt
mousemove pe React state update band karo
```

## Priority order

Mere hisaab se ye order rakho:

```txt
1. Move/resize/draw live preview ko refs mein shift karo
2. setElements sirf mouseUp pe
3. localStorage drawing save ko IndexedDB pe shift karo
4. image compression add karo
5. viewport culling add karo
6. alignment/hit-test throttle karo
7. two-canvas architecture
```

Abhi sabse important next patch: **CanvasBoard.js ko ref-based drag/resize preview mein convert karna**. Ye thoda bada change hai, but isi se real “no lag” feel aayegi.
