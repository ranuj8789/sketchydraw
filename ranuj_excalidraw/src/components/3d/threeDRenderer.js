export function draw3DPrimitive(ctx, element, renderOptions = {}) {
    const x = Number(element.x || 0);
    const y = Number(element.y || 0);
    const w = Math.max(20, Math.abs(Number(element.w || 180)));
    const h = Math.max(20, Math.abs(Number(element.h || 180)));
    const d = Math.max(8, Number(element.depth || 70));
    const scale = Math.max(0.1, Number(element.scale3d || 1));
    const dx = Math.cos((Number(element.rotationY || 28) * Math.PI) / 180) * d * 0.55 * scale;
    const dy = Math.sin((Number(element.rotationX || -18) * Math.PI) / 180) * d * 0.55 * scale - d * 0.35 * scale;
    const stroke = element.stroke || "#0f172a";
    const fill = element.fill && element.fill !== "transparent" ? element.fill : "#e2e8f0";
    const primitive = element.primitive3d || "box";

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
    ctx.lineWidth = Math.max(1.5, Number(element.strokeWidth || 2));
    ctx.lineJoin = "round";

    if (primitive === "sphere") {
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

    ctx.restore();
}
