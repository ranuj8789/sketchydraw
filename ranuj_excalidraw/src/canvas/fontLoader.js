const GENERIC_FONTS = new Set([
    "arial",
    "georgia",
    "inter",
    "courier new",
    "comic sans ms",
    "sans-serif",
    "serif",
    "monospace",
    "cursive",
    "system-ui",
]);

const loadedFonts = new Set();
const loadingFonts = new Map();

export function cleanCanvasFontName(fontFamily) {
    return String(fontFamily || "")
        .split(",")[0]
        .replace(/['"]/g, "")
        .trim();
}

export function loadCanvasFont(fontFamily) {
    if (typeof document === "undefined") return Promise.resolve();
    const fontName = cleanCanvasFontName(fontFamily);
    const fontKey = fontName.toLowerCase();
    if (!fontName || GENERIC_FONTS.has(fontKey) || loadedFonts.has(fontKey)) {
        return Promise.resolve();
    }
    if (loadingFonts.has(fontKey)) return loadingFonts.get(fontKey);

    const loading = (async () => {
        const id = `sketchydraw-font-${fontName.replace(/\s+/g, "-").toLowerCase()}`;
        let link = document.getElementById(id);
        if (!link) {
            link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName).replace(/%20/g, "+")}&display=swap`;
            document.head.appendChild(link);
        }

        try {
            if (link.dataset.loaded !== "true") {
                await new Promise((resolve) => {
                    const finish = () => {
                        link.dataset.loaded = "true";
                        resolve();
                    };
                    link.addEventListener("load", finish, { once: true });
                    link.addEventListener("error", finish, { once: true });
                });
            }
            await document.fonts?.load?.(`20px "${fontName}"`);
            loadedFonts.add(fontKey);
            window.dispatchEvent(new CustomEvent("sketchydraw:font-loaded", {
                detail: { fontFamily },
            }));
        } catch {}
    })().finally(() => loadingFonts.delete(fontKey));

    loadingFonts.set(fontKey, loading);
    return loading;
}

export function loadCanvasFonts(elements = []) {
    const fonts = new Set();
    (elements || []).forEach((element) => {
        if (element?.type === "text" && element.fontFamily) fonts.add(element.fontFamily);
        (element?.richText || []).forEach((range) => {
            if (range?.fontFamily) fonts.add(range.fontFamily);
        });
    });
    fonts.forEach((fontFamily) => loadCanvasFont(fontFamily));
}
