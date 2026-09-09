import { resolve3DStep, resolve3DTransform, resolveDataPathPoint } from "./threeDKeyframes";

// Animation timing is deliberately self-contained. The renderer receives a
// timestamp from the canvas and applies native cubic-bezier easing without a
// second animation runtime or clock.
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const CUBIC_EASINGS = {
    linear: [0, 0, 1, 1],
    in: [0.42, 0, 1, 1],
    out: [0, 0, 0.58, 1],
    inOut: [0.42, 0, 0.58, 1],
};

function cubicBezierAt(progress, x1, y1, x2, y2) {
    const x = clamp01(progress);
    if (x1 === y1 && x2 === y2) return x;
    const sample = (t, a1, a2) => {
        const inv = 1 - t;
        return 3 * inv * inv * t * a1 + 3 * inv * t * t * a2 + t * t * t;
    };
    let low = 0;
    let high = 1;
    let t = x;
    for (let i = 0; i < 12; i += 1) {
        t = (low + high) / 2;
        if (sample(t, x1, x2) < x) low = t;
        else high = t;
    }
    return sample(t, y1, y2);
}

function getMotionTime(element, timeMs) {
    const durationMs = Math.max(100, Number(element?.motionDurationMs) || 2400);
    const elapsed = Math.max(0, Number(timeMs) || 0) * Math.max(0.05, Number(element?.motionSpeed) || 1);
    const iteration = Math.floor(elapsed / durationMs);
    let progress = (elapsed % durationMs) / durationMs;
    const direction = element?.motionDirection || "alternate";
    if (direction === "reverse" || (direction === "alternate" && iteration % 2 === 1)) {
        progress = 1 - progress;
    }
    const curve = CUBIC_EASINGS[element?.motionEasing] || CUBIC_EASINGS.inOut;
    const eased = cubicBezierAt(progress, ...curve);
    return { durationMs, iteration, progress, eased, phase: eased * Math.PI * 2 };
}

export function draw3DPrimitive(ctx, element, renderOptions = {}) {
    const timeMs = Math.max(0, Number(renderOptions.animationTimeMs) || 0);
    const keyedTransform = resolve3DTransform(element, timeMs);
    const codeStep = resolve3DStep(element, timeMs);
    let x = keyedTransform.x;
    let y = keyedTransform.y;
    const w = Math.max(20, Math.abs(Number(element.w || 180)));
    const h = Math.max(20, Math.abs(Number(element.h || 180)));
    const d = Math.max(8, Number(element.depth || 70));
    let scale = Math.max(0.1, keyedTransform.scale3d);
    const motion = element.motion3d || "none";
    const motionTime = getMotionTime(element, timeMs);
    const phase = motionTime.phase;
    let rotationX = keyedTransform.rotationX + Number(element.cameraPitch || 0);
    let rotationY = keyedTransform.rotationY + Number(element.cameraYaw || 0);
    const rotationZ = keyedTransform.rotationZ;
    if (motion === "rotateY") rotationY += motionTime.eased * 360;
    if (motion === "rotateXYZ") {
        rotationY += motionTime.eased * 360;
        rotationX += Math.sin(phase) * 24;
    }
    if (motion === "float") y += Math.sin(phase * 1.6) * Math.min(18, h * 0.08);
    if (motion === "breathe") scale *= 1 + Math.sin(phase * 2) * 0.055;
    const perspective = Math.max(180, Number(element.perspective) || 720);
    const depthFactor = Math.max(0.35, Math.min(1.8, perspective / 720));
    const dx = Math.cos((rotationY * Math.PI) / 180) * d * 0.55 * scale * depthFactor;
    const dy = Math.sin((rotationX * Math.PI) / 180) * d * 0.55 * scale - d * 0.35 * scale;
    const stroke = element.stroke || "#0f172a";
    const fill = keyedTransform.materialColor || (element.fill && element.fill !== "transparent" ? element.fill : "#e2e8f0");
    const primitive = element.primitive3d || "box";

    const alphaColor = (hex, alpha) => {
        const clean = String(hex || "#64748b").replace("#", "");
        if (!/^[0-9a-f]{6}$/i.test(clean)) return `rgba(100,116,139,${alpha})`;
        return `rgba(${parseInt(clean.slice(0,2),16)},${parseInt(clean.slice(2,4),16)},${parseInt(clean.slice(4,6),16)},${alpha})`;
    };

    const node = (cx, cy, radius, color = fill, glow = 0) => {
        ctx.save();
        if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
        const gradient = ctx.createRadialGradient(cx - radius * .3, cy - radius * .35, 1, cx, cy, radius);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(.28, color);
        gradient.addColorStop(1, alphaColor(stroke, .92));
        ctx.fillStyle = gradient;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(1.2, Number(element.strokeWidth || 2));
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
    };

    const line3d = (ax, ay, bx, by, color = stroke, width = 2, alpha = .6) => {
        ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha *= alpha; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
    };

    const label = (text, lx, ly, size = 12) => {
        if (element.showLabels === false) return;
        ctx.save(); ctx.fillStyle = stroke; ctx.font = `600 ${size}px Inter, Arial, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(text), lx, ly); ctx.restore();
    };

    const arrow2d = (ax, ay, bx, by, color = stroke, progress = 1) => {
        const ex = ax + (bx - ax) * progress;
        const ey = ay + (by - ay) * progress;
        line3d(ax, ay, ex, ey, color, 2.5, .9);
        const angle = Math.atan2(ey - ay, ex - ax);
        ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 10 * Math.cos(angle - .45), ey - 10 * Math.sin(angle - .45));
        ctx.lineTo(ex - 10 * Math.cos(angle + .45), ey - 10 * Math.sin(angle + .45));
        ctx.closePath(); ctx.fill(); ctx.restore();
    };

    const face = (points, alpha = 1) => {
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        points.slice(1).forEach(([px, py]) => ctx.lineTo(px, py));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.stroke();
        ctx.restore();
    };

    const box = (bx, by, bw, bh, depthScale = 1) => {
        const ox = dx * depthScale;
        const oy = dy * depthScale;
        face([[bx, by], [bx + bw, by], [bx + bw + ox, by + oy], [bx + ox, by + oy]], 0.72);
        face([[bx + bw, by], [bx + bw, by + bh], [bx + bw + ox, by + bh + oy], [bx + bw + ox, by + oy]], 0.60);
        face([[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], 0.95);
    };

    ctx.save();
    ctx.globalAlpha *= keyedTransform.opacity;
    ctx.lineWidth = Math.max(1.5, Number(element.strokeWidth || 2));
    ctx.lineJoin = "round";

    if (primitive === "plane") {
        const steps = 6;
        ctx.save(); ctx.strokeStyle = alphaColor(stroke, .48); ctx.lineWidth = 1;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            line3d(x + w * t, y + h * .2, x + w * t + dx, y + h * .82 + dy, stroke, 1, .42);
            line3d(x + dx * t, y + h * .2 + dy * t, x + w + dx * t, y + h * .2 + dy * t, stroke, 1, .42);
        }
        ctx.restore();
    } else if (primitive === "torus") {
        const cx = x + w / 2, cy = y + h / 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotationZ * Math.PI / 180);
        const grad = ctx.createLinearGradient(-w*.4, -h*.3, w*.4, h*.3);
        grad.addColorStop(0, "#ffffff"); grad.addColorStop(.35, fill); grad.addColorStop(1, stroke);
        ctx.strokeStyle = grad; ctx.lineWidth = Math.max(10, Math.min(w,h)*.16);
        ctx.beginPath(); ctx.ellipse(0, 0, w*.32*scale, h*.20*scale, rotationX*Math.PI/360, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = alphaColor(stroke,.5); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, w*.32*scale, h*.20*scale, rotationX*Math.PI/360, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    } else if (primitive === "sphere") {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = w * 0.42;
        const ry = h * 0.42;
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha *= 0.45;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.28, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    } else if (primitive === "cylinder" || primitive === "cone") {
        const cx = x + w / 2;
        const top = y + h * 0.16;
        const bottom = y + h * 0.84;
        const rx = w * 0.36;
        const ry = Math.max(8, h * 0.10);
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        if (primitive === "cone") {
            ctx.moveTo(cx, top);
            ctx.lineTo(cx + rx, bottom);
            ctx.lineTo(cx - rx, bottom);
            ctx.closePath();
        } else {
            ctx.moveTo(cx - rx, top);
            ctx.lineTo(cx - rx, bottom);
            ctx.lineTo(cx + rx, bottom);
            ctx.lineTo(cx + rx, top);
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, bottom, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (primitive === "cylinder") {
            ctx.beginPath();
            ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    } else if (primitive === "linkedlist3d" || primitive === "queue3d" || primitive === "rnn3d") {
        const values = element.labels || element.values || (primitive === "queue3d" ? ["front", 8, 4, 2, "rear"] : primitive === "rnn3d" ? ["x₁", "h₁", "h₂", "h₃", "y"] : ["head", "A", "B", "null"]);
        const gap = Math.max(18, Number(element.gap || 16));
        const cw = Math.min(72, (w - gap * (values.length - 1)) / values.length);
        const startX = x + Math.max(0, (w - (cw * values.length + gap * (values.length - 1))) / 2);
        values.forEach((value, index) => {
            const bx = startX + index * (cw + gap), by = y + h*.38 + Math.sin(index*.8 + phase)*4;
            box(bx, by, cw, h*.28, .32); label(value, bx + cw/2, by + h*.14, 12);
            if (index < values.length - 1) arrow2d(bx+cw+3, by+h*.14, bx+cw+gap-3, by+h*.14, stroke, motion === "dataFlow" ? (.25 + ((phase*.55 + index*.22)%1)*.75) : 1);
        });
        label(primitive === "queue3d" ? "QUEUE" : primitive === "rnn3d" ? "RECURRENT NEURAL NETWORK" : "LINKED LIST", x+w/2, y+h*.15, 13);
    } else if (primitive === "stack3d") {
        const values = element.values || [5, 4, 3, 2, 1];
        const ch = Math.min(44, (h*.72)/values.length);
        values.forEach((value, index) => {
            const by = y+h*.82-(index+1)*ch;
            box(x+w*.24, by, w*.52, ch-4, .38); label(value, x+w*.5, by+(ch-4)/2, 13);
        });
        arrow2d(x+w*.86,y+h*.25,x+w*.72,y+h*.34,"#ef4444",1); label("TOP",x+w*.88,y+h*.2,11);
    } else if (["tree3d", "heap3d", "minheap3d", "maxheap3d", "trie3d"].includes(primitive)) {
        const heapPrimitive = ["heap3d", "minheap3d", "maxheap3d"].includes(primitive);
        const minHeap = primitive === "minheap3d";
        const heapValues = element.heapValues || element.values || (minHeap ? [5,12,18,25,30,22,40] : [99,82,75,44,36,61,50]);
        const levels = heapPrimitive ? Math.min(4, Math.max(1, Math.ceil(Math.log2(heapValues.length + 1)))) : 3;
        const radius = Math.max(10, Math.min(20,w/(Math.pow(2,levels)*2.1)));
        const positions=[];
        for(let level=0;level<levels;level++){
            const count=Math.pow(2,level), yy=y+h*(.16+level*.25);
            for(let i=0;i<count;i++) positions.push({level,i,x:x+w*((i+1)/(count+1)),y:yy});
        }
        positions.forEach((p,index)=>{ if(index){const parent=positions[Math.floor((index-1)/2)]; line3d(parent.x,parent.y,p.x,p.y,stroke,2,.45);} });
        positions.forEach((p,index)=>{const firing=motion==="nodeFire"&&Math.floor(phase*2)%positions.length===index; node(p.x,p.y,radius,fill,firing?18:0); label(heapPrimitive?(heapValues[index]??"•"):primitive==="trie3d"?["∅","c","d","a","o","t","g"][index]||"•":String.fromCharCode(65+index),p.x,p.y,10);});
        label(heapPrimitive ? (minHeap ? "MIN HEAP" : "MAX HEAP") : primitive === "trie3d" ? "PREFIX TRIE" : "BINARY TREE",x+w/2,y+h*.94,13);
    } else if (primitive === "graph3d") {
        const authoredNodes=Array.isArray(element.graphNodes)&&element.graphNodes.length?element.graphNodes:null;
        const count=authoredNodes?authoredNodes.length:Math.max(4,Math.min(12,Number(element.nodes)||7));
        const pts=authoredNodes
            ? authoredNodes.map((item,i)=>{const nx=Number(item.x),ny=Number(item.y);return{id:String(item.id??i),x:x+w*Math.max(0,Math.min(1,Number.isFinite(nx)?nx:.5)),y:y+h*Math.max(0,Math.min(1,Number.isFinite(ny)?ny:.5))};})
            : Array.from({length:count},(_,i)=>({id:String(i),x:x+w/2+Math.cos(i*Math.PI*2/count+rotationY*.01)*w*.38,y:y+h/2+Math.sin(i*Math.PI*2/count)*h*.34+(i%2?dy*.25:0)}));
        const byId=new Map(pts.map(p=>[p.id,p]));
        const edges=Array.isArray(element.graphEdges)&&element.graphEdges.length?element.graphEdges:pts.map((p,i)=>[p.id,pts[(i+1)%pts.length].id]);
        edges.forEach((edge,index)=>{const a=byId.get(String(edge[0])),b=byId.get(String(edge[1]));if(a&&b){line3d(a.x,a.y,b.x,b.y,stroke,2,.35);if(motion==="dataFlow"){const t=(phase*.45+index*.13)%1;node(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,3,"#38bdf8",7);}}});
        const order=Array.isArray(element.traversalOrder)?element.traversalOrder.map(String):pts.map(p=>p.id);
        const activeId=order[Math.floor(phase*2)%Math.max(1,order.length)];
        pts.forEach((p)=>{const active=(motion==="nodeFire"||motion==="dataFlow")&&p.id===activeId;node(p.x,p.y,15,active?"#38bdf8":fill,active?20:0);label(p.id,p.x,p.y,10);});
        label(`GRAPH · ${element.traversalMode || "BFS"}`,x+w/2,y+h*.95,13);
    } else if (primitive === "intervals3d") {
        const intervals=Array.isArray(element.intervals)&&element.intervals.length?element.intervals:[[1,4],[2,6],[5,8],[7,10]];
        const flat=intervals.flat().map(Number).filter(Number.isFinite),min=Math.min(...flat,0),max=Math.max(...flat,10),range=Math.max(1,max-min);
        const axisY=y+h*.78;
        arrow2d(x+w*.08,axisY,x+w*.94,axisY,stroke,1);
        for(let tick=Math.ceil(min);tick<=Math.floor(max);tick++){const tx=x+w*(.1+.8*((tick-min)/range));line3d(tx,axisY-4,tx,axisY+4,stroke,1,.6);label(tick,tx,axisY+16,9);}
        intervals.forEach((interval,index)=>{const start=Number(interval[0])||0,end=Number(interval[1])||start;const ax=x+w*(.1+.8*((start-min)/range)),bx=x+w*(.1+.8*((end-min)/range)),iy=y+h*(.16+index*.13);const active=motion==="dataFlow"&&Math.floor(phase*1.5)%intervals.length===index;ctx.save();ctx.strokeStyle=["#2563eb","#db2777","#059669","#d97706"][index%4];ctx.lineWidth=active?8:5;ctx.lineCap="round";if(active){ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=16;}ctx.beginPath();ctx.moveTo(ax,iy);ctx.lineTo(bx,iy);ctx.stroke();ctx.restore();node(ax,iy,5,fill,0);node(bx,iy,5,fill,0);label(`[${start}, ${end}]`,(ax+bx)/2,iy-13,10);});
        label("INTERVALS · OVERLAP / MERGE",x+w/2,y+h*.94,13);
    } else if (primitive === "hashtable3d") {
        const values=element.values||[["user:1","Asha"],["user:2","Ranuj"],["user:3","Mina"],["user:4","Dev"]];
        const rh=Math.min(42,h*.7/values.length);
        values.forEach((pair,i)=>{const by=y+h*.12+i*(rh+6);box(x+w*.12,by,w*.22,rh,.25);box(x+w*.42,by,w*.46,rh,.25);label(pair[0]??i,x+w*.23,by+rh/2,10);label(pair[1]??"value",x+w*.65,by+rh/2,11);arrow2d(x+w*.34,by+rh/2,x+w*.42,by+rh/2,stroke,1);});
        label("HASH TABLE",x+w/2,y+h*.94,13);
    } else if (primitive === "sorting3d") {
        const values=element.values||[7,2,9,4,6,1,8],max=Math.max(...values,1),gap=7,bw=(w-gap*(values.length-1))/values.length;
        const active=motion==="wave"?Math.floor(phase*2)%values.length:-1;
        values.forEach((v,i)=>{const bh=h*.65*(v/max),by=y+h*.82-bh;ctx.save();if(i===active){ctx.shadowColor="#38bdf8";ctx.shadowBlur=18;}box(x+i*(bw+gap),by,bw,bh,.3);ctx.restore();label(v,x+i*(bw+gap)+bw/2,by-10,10);});
        label("SORTING / ARRAY BARS",x+w/2,y+h*.94,13);
    } else if (primitive === "neuron3d") {
        const cx=x+w/2,cy=y+h/2; node(cx,cy,Math.min(w,h)*.16,fill,motion==="nodeFire"?12+Math.sin(phase*3)*8:5);
        for(let i=0;i<10;i++){const a=i*Math.PI*2/10+rotationY*.01,r=Math.min(w,h)*(.32+(i%3)*.045);const ex=cx+Math.cos(a)*r,ey=cy+Math.sin(a)*r*.72;line3d(cx,cy,ex,ey,stroke,2,.52);node(ex,ey,4,fill,0);}
        label("NEURON",cx,y+h*.9,13);
    } else if (primitive === "neuralnetwork3d") {
        const layers=Array.isArray(element.layers)?element.layers:[3,5,5,2];
        const layerPts=layers.map((count,li)=>Array.from({length:count},(_,ni)=>({x:x+w*(li+.5)/layers.length+dx*(li/(layers.length-1||1))*.35,y:y+h*(ni+1)/(count+1)+dy*(li/(layers.length-1||1))*.2})));
        layerPts.slice(0,-1).forEach((layer,li)=>layer.forEach(a=>layerPts[li+1].forEach(b=>line3d(a.x,a.y,b.x,b.y,stroke,1,.16))));
        const fireIndex=Math.floor(phase*1.5)%Math.max(1,layers.length);
        layerPts.forEach((layer,li)=>layer.forEach((p,ni)=>node(p.x,p.y,Math.max(6,Math.min(12,h/(layers[li]*3))),li===fireIndex?"#60a5fa":fill,(motion==="nodeFire"||motion==="dataFlow")&&li===fireIndex?16:0)));
        const names=element.layerLabels||["Input","Hidden","Hidden","Output"]; names.slice(0,layers.length).forEach((name,i)=>label(name,layerPts[i][0].x,y+h*.94,10));
    } else if (primitive === "tensor3d") {
        const shape=element.tensorShape||[4,4,3], layers=Math.max(1,Math.min(6,shape[2]||3));
        for(let layer=layers-1;layer>=0;layer--){const off=layer*Math.min(18,d*.22);ctx.save();ctx.globalAlpha*=.45+.5*(1-layer/layers);face([[x+off,y-off],[x+w*.72+off,y-off],[x+w*.72+off,y+h*.72-off],[x+off,y+h*.72-off]],.7);ctx.restore();}
        label(`TENSOR [${shape.join(" × ")}]`,x+w/2,y+h*.9,13);
    } else if (primitive === "embedding3d" || primitive === "vectordb3d") {
        const count=Math.max(12,Math.min(60,Number(element.nodes)||30));
        ctx.save();ctx.strokeStyle=alphaColor(stroke,.22);ctx.strokeRect(x+w*.08,y+h*.08,w*.84,h*.78);ctx.restore();
        for(let i=0;i<count;i++){const seed=(i*9301+49297)%233280;const px=x+w*(.13+((seed%997)/997)*.74),py=y+h*(.13+(((seed*7)%991)/991)*.65);const cluster=i%3;node(px,py,3.5,["#3b82f6","#ec4899","#10b981"][cluster],motion==="wave"?Math.max(0,Math.sin(phase*3-i*.25))*8:0);}
        label(primitive === "vectordb3d" ? "VECTOR DATABASE" : "EMBEDDING SPACE",x+w/2,y+h*.94,13);
    } else if (primitive === "attention3d") {
        const n=Math.max(3,Math.min(10,Number(element.rows)||6)), gap=3, cell=Math.min((w-gap*(n-1))/n,(h*.72-gap*(n-1))/n);
        for(let r=0;r<n;r++)for(let c=0;c<n;c++){const score=(Math.sin(r*2.1+c*1.7)+1)/2;const wave=motion==="wave"?.35+.65*((Math.sin(phase*3-r*.5-c*.35)+1)/2):1;ctx.save();ctx.fillStyle=`rgba(99,102,241,${(.08+score*.82)*wave})`;ctx.fillRect(x+c*(cell+gap),y+r*(cell+gap),cell,cell);ctx.restore();}
        label("SELF-ATTENTION",x+w/2,y+h*.9,13);
    } else if (["transformer3d", "convnet3d", "modelpipeline3d", "autoencoder3d", "gan3d", "diffusion3d", "rag3d"].includes(primitive)) {
        const names=primitive==="transformer3d"?["Tokens","Embedding","Attention","Add + Norm","FFN","Output"]:primitive==="convnet3d"?["Image","Conv","ReLU","Pool","Dense","Class"]:primitive==="autoencoder3d"?["Input","Encoder","Latent z","Decoder","Output"]:primitive==="gan3d"?["Noise z","Generator","Fake","Discriminator","Real/Fake"]:primitive==="diffusion3d"?["Noise","Denoise t3","Denoise t2","Denoise t1","Image"]:primitive==="rag3d"?["Query","Embed","Vector DB","Retrieve","LLM","Answer"]:["Data","Train","Model","Evaluate","Deploy"];
        const visibleCount=motion==="layerReveal"?Math.max(1,Math.ceil(((phase*.35)%1)*names.length)):names.length;
        const gap=Math.max(8,Number(element.gap)||10),bw=(w-gap*(names.length-1))/names.length;
        names.slice(0,visibleCount).forEach((name,i)=>{const bh=h*(.30+(i%3)*.12),by=y+(h-bh)/2;box(x+i*(bw+gap),by,bw,bh,.35);label(name,x+i*(bw+gap)+bw/2,by+bh/2,Math.max(8,Math.min(11,bw/6)));if(i<visibleCount-1)arrow2d(x+i*(bw+gap)+bw+2,y+h/2,x+(i+1)*(bw+gap)-2,y+h/2,stroke,motion==="dataFlow"?.35+((phase*.6+i*.2)%1)*.65:1);});
        const pipelineTitle={transformer3d:"TRANSFORMER",convnet3d:"CONVOLUTIONAL NETWORK",autoencoder3d:"AUTOENCODER",gan3d:"GENERATIVE ADVERSARIAL NETWORK",diffusion3d:"DIFFUSION PROCESS",rag3d:"RETRIEVAL-AUGMENTED GENERATION",modelpipeline3d:"AI MODEL PIPELINE"};
        label(pipelineTitle[primitive]||"AI PIPELINE",x+w/2,y+h*.92,13);
    } else if (primitive === "losslandscape3d") {
        const rows=9,cols=13;
        for(let r=0;r<rows;r++){
            let previous=null;
            for(let c=0;c<cols;c++){
                const nx=c/(cols-1),ny=r/(rows-1),height=(Math.sin(nx*7+phase*.25)*.18+Math.cos(ny*6)*.16+Math.pow(nx-.58,2)+Math.pow(ny-.52,2))*h*.35;
                const p={x:x+nx*w+ny*dx*.45,y:y+h*.28+ny*h*.5-height+ny*dy*.2};
                if(previous)line3d(previous.x,previous.y,p.x,p.y,"#6366f1",1,.45);previous=p;
                if(r&&c%2===0){const py=(r-1)/(rows-1),ph=(Math.sin(nx*7+phase*.25)*.18+Math.cos(py*6)*.16+Math.pow(nx-.58,2)+Math.pow(py-.52,2))*h*.35;line3d(p.x,p.y,x+nx*w+py*dx*.45,y+h*.28+py*h*.5-ph+py*dy*.2,"#8b5cf6",1,.3);}
            }
        }
        const px=x+w*(.58+Math.sin(phase)*.06),py=y+h*.63;node(px,py,7,"#ef4444",motion==="dataFlow"?14:4);label("LOSS LANDSCAPE + GRADIENT DESCENT",x+w/2,y+h*.94,13);
    } else if (primitive === "tokenflow3d") {
        const tokens=element.tokens||["The","model","learns","patterns"],gap=12,bw=(w-gap*(tokens.length-1))/tokens.length;
        tokens.forEach((token,i)=>{const wave=motion==="wave"?Math.sin(phase*3-i*.7)*12:0;const bx=x+i*(bw+gap),by=y+h*.38+wave;box(bx,by,bw,h*.25,.28);label(token,bx+bw/2,by+h*.125,11);if(i<tokens.length-1)arrow2d(bx+bw+2,by+h*.125,bx+bw+gap-2,by+h*.125,"#7c3aed",motion==="dataFlow"?.25+((phase*.5+i*.23)%1)*.75:1);});
        label("TOKEN PIPELINE",x+w/2,y+h*.82,13);
    } else if (["boywalk3d", "boyrun3d", "girlwalk3d", "girlrun3d"].includes(primitive)) {
        const gender = primitive.startsWith("girl") ? "girl" : "boy";
        const action = element.characterAction || "idle";
        const speed = Math.max(0.1, Number(element.characterSpeed || 1));
        const timeMs = Math.max(0, Number(renderOptions.animationTimeMs || 0));
        const cadence = action === "run" ? 0.018 : (action === "walk" ? 0.011 : 0.004);
        const phase = timeMs * cadence * speed;
        const swing = action === "idle" ? Math.sin(phase) * 0.05 : Math.sin(phase);
        const runAmp = action === "run" ? 0.95 : (action === "walk" ? 0.62 : 0.08);
        const cx = x + w / 2;
        const headY = y + h * 0.18;
        const shoulderY = y + h * 0.34;
        const hipY = y + h * 0.60;
        const footY = y + h * 0.91;
        const bodyW = w * 0.25;
        const headR = Math.min(w, h) * 0.10;
        const limb = Math.max(3, Number(element.strokeWidth || 3));

        ctx.strokeStyle = stroke;
        ctx.fillStyle = fill;
        ctx.lineWidth = limb;
        ctx.lineCap = "round";

        // subtle 3D floor shadow
        ctx.save();
        ctx.globalAlpha *= 0.15;
        ctx.beginPath();
        ctx.ellipse(cx, footY + 8, w * 0.28, h * 0.045, 0, 0, Math.PI * 2);
        ctx.fillStyle = stroke;
        ctx.fill();
        ctx.restore();

        // head
        ctx.beginPath();
        ctx.arc(cx, headY, headR, 0, Math.PI * 2);
        ctx.fillStyle = gender === "girl" ? "#f3d6c6" : "#e8c6ad";
        ctx.fill();
        ctx.stroke();

        // hair
        ctx.save();
        ctx.fillStyle = stroke;
        ctx.globalAlpha *= 0.9;
        ctx.beginPath();
        ctx.arc(cx, headY - headR * 0.15, headR * 1.02, Math.PI, Math.PI * 2);
        ctx.fill();
        if (gender === "girl") {
            ctx.fillRect(cx + headR * 0.55, headY - headR * 0.1, headR * 0.45, headR * 1.4);
        }
        ctx.restore();

        // torso
        ctx.fillStyle = fill;
        ctx.beginPath();
        if (gender === "girl") {
            ctx.moveTo(cx - bodyW * 0.45, shoulderY);
            ctx.lineTo(cx + bodyW * 0.45, shoulderY);
            ctx.lineTo(cx + bodyW * 0.70, hipY);
            ctx.lineTo(cx - bodyW * 0.70, hipY);
        } else {
            ctx.rect(cx - bodyW / 2, shoulderY, bodyW, hipY - shoulderY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const armSwing = swing * runAmp * h * 0.10;
        const legSwing = swing * runAmp * w * 0.18;

        // arms
        ctx.beginPath();
        ctx.moveTo(cx - bodyW * 0.48, shoulderY + h * 0.03);
        ctx.lineTo(cx - bodyW * 0.90, shoulderY + h * 0.12 + armSwing);
        ctx.moveTo(cx + bodyW * 0.48, shoulderY + h * 0.03);
        ctx.lineTo(cx + bodyW * 0.90, shoulderY + h * 0.12 - armSwing);
        ctx.stroke();

        // legs
        ctx.beginPath();
        ctx.moveTo(cx - bodyW * 0.22, hipY);
        ctx.lineTo(cx - bodyW * 0.18 - legSwing, footY);
        ctx.moveTo(cx + bodyW * 0.22, hipY);
        ctx.lineTo(cx + bodyW * 0.18 + legSwing, footY);
        ctx.stroke();

        if (action === "run") {
            ctx.save();
            ctx.globalAlpha *= 0.25;
            ctx.beginPath();
            ctx.moveTo(x + w * 0.03, y + h * 0.42);
            ctx.lineTo(x + w * 0.28, y + h * 0.42);
            ctx.moveTo(x + w * 0.00, y + h * 0.50);
            ctx.lineTo(x + w * 0.24, y + h * 0.50);
            ctx.stroke();
            ctx.restore();
        }
    } else if (primitive === "arrow3d") {
        const cy = y + h / 2;
        const shaftH = Math.max(16, h * 0.22);
        box(x + w * 0.08, cy - shaftH / 2, w * 0.58, shaftH, 0.55);
        face([
            [x + w * 0.62, cy - h * 0.28], [x + w * 0.92, cy], [x + w * 0.62, cy + h * 0.28],
            [x + w * 0.62, cy + shaftH / 2], [x + w * 0.55, cy + shaftH / 2],
            [x + w * 0.55, cy - shaftH / 2], [x + w * 0.62, cy - shaftH / 2],
        ], 0.95);
    } else if (primitive === "array3d") {
        const values = Array.isArray(element.values) ? element.values : [4, 8, 2, 7, 1];
        const gap = Math.max(2, Number(element.gap || 8));
        const cell = (w - gap * (values.length - 1)) / Math.max(1, values.length);
        values.forEach((value, index) => {
            const bx = x + index * (cell + gap);
            box(bx, y + h * 0.28, cell, h * 0.44, 0.42);
            ctx.fillStyle = stroke;
            ctx.font = `600 ${Math.max(12, Math.min(22, cell * 0.28))}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(value), bx + cell / 2, y + h * 0.50);
            if (element.showIndexes !== false) {
                ctx.font = "11px sans-serif";
                ctx.fillText(String(index), bx + cell / 2, y + h * 0.84);
            }
        });
    } else if (primitive === "matrix3d") {
        const values = Array.isArray(element.values) && Array.isArray(element.values[0])
            ? element.values
            : [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
        const rows = values.length;
        const cols = Math.max(1, ...values.map((row) => row.length));
        const gap = Math.max(2, Number(element.gap || 6));
        const cw = (w - gap * (cols - 1)) / cols;
        const ch = (h - gap * (rows - 1)) / rows;
        values.forEach((row, r) => row.forEach((value, c) => {
            const bx = x + c * (cw + gap);
            const by = y + r * (ch + gap);
            box(bx, by, cw, ch, 0.25);
            ctx.fillStyle = stroke;
            ctx.font = `600 ${Math.max(10, Math.min(18, Math.min(cw, ch) * 0.28))}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(value), bx + cw / 2, by + ch / 2);
        }));
    } else {
        box(x, y, w, h, 1);
    }

    const dataPoint = resolveDataPathPoint(element, timeMs);
    if (dataPoint) node(x + w / 2 + dataPoint.x, y + h / 2 + dataPoint.y, 6, "#38bdf8", 14);
    if (codeStep.index >= 0 && element.showCodeStepLabel !== false) label(`Step ${codeStep.index + 1}`, x + w / 2, y + 12, 11);
    ctx.restore();
}
