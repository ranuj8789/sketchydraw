Tag sahi commit `f14ea5b...` par dikh raha hai. Ab testing is order mein karo—pehle movement, phir 3D.

## 1. Camera/movement smoke test

* App open ho; console mein error na ho.
* Ek large diagram import karo.
* `Record camera` start karo.
* Hand tool se right/left pan karo.
* Zoom in aur zoom out karo.
* Beech mein `Hold 1s` add karo.
* Recording stop karo.
* `Play frame` check karo.
* Movement smooth ho; sudden jump na ho.
* Objects apni original coordinates par rahen.

## 2. Camera Director

* Rectangle select → `Focus point`.
* Rectangle automatically centre mein aaye.
* `Snap to object` test karo.
* `Wide → Detail → Wide` apply karo.
* Slow pan, Quick zoom, Left→Right aur Zoom-out presets test karo.
* Camera track par points visible hon.
* Keyframe time, hold, zoom, X/Y and easing edit karo.
* Keyframe reorder aur delete karo.
* `Smooth` press karne par shaky movement reduce ho.
* `16:9 safe area` correct boundary dikhaye.

## 3. JSON persistence

* Drawing save karo.
* Page refresh/open drawing.
* `cameraKeyframes`, labels, holds and easing preserved hon.
* JSON export → re-import karo.
* Playback before/after import identical ho.

## 4. Export parity

Same animation ko:

* Editor preview
* GIF export
* Video export

Mein compare karo. Pan, zoom, hold, total timing aur final view same hone chahiye. Special test: **frame mein no object animation, only camera movement**—export still move hona chahiye.

## 5. Basic 3D rendering

Har primitive individually add karo:

* Box
* Sphere
* Cylinder
* Cone
* 3D arrow
* Array
* Matrix
* Graph
* Min heap
* Max heap
* Interval
* Neural network

Check:

* Blank/black object na aaye.
* Position and size reasonable ho.
* Canvas pan/zoom ke saath 3D object correctly move/scale ho.
* 2D selection box aur mesh align rahein.

## 6. 3D interaction

* Mesh par click karke selection test.
* Empty canvas click → deselect.
* Move gizmo X/Y/Z.
* Rotate X/Y/Z.
* Scale.
* Canvas zoom/pan ke baad gizmo alignment.
* Undo after transform.
* Save/reload ke baad transform preserved.

Sphere gizmo movement currently known-risk area hai—agar axes visible hon but drag na ho, bug note karo.

## 7. 3D animation

* Position keyframes
* Rotation keyframes
* Scale keyframes
* Opacity
* Material colour
* Orbit/camera animation
* Layer reveal
* Exploded view
* Data-flow packet/path
* Neural-network layer reveal
* Graph BFS/DFS
* Heap insert/swap/extract

Check animation end par kam-se-kam `500–1000ms` hold ho; next frame instantly switch na ho.

## 8. Performance and failure testing

* 1, 10, 50 and 100 3D objects.
* Browser tab hide/show—animation resume sensibly.
* Resize browser and fullscreen.
* WebGL disabled/unavailable fallback.
* Long 20–30 second camera recording.
* Very fast zoom and chaotic hand movement.
* Console mein warnings/errors capture karo.

Testing ke waqt har failure ke liye bas ye five things bhejna:

`Feature → exact steps → expected → actual → console error/screenshot`

Pehle movement tests complete karna. Agar movement/export stable hai, tab 3D par jaana.
