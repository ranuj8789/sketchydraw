import { useEffect } from "react";

const SITE_URL = "https://sketchydraw.com";
const DEFAULT_IMAGE = `${SITE_URL}/og-sketchydraw.svg`;

function ensureMeta(selector, attrs) {
    let node = document.head.querySelector(selector);
    if (!node) {
        node = document.createElement("meta");
        document.head.appendChild(node);
    }
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
}

function ensureLink(rel, href) {
    let node = document.head.querySelector(`link[rel="${rel}"]`);
    if (!node) {
        node = document.createElement("link");
        node.rel = rel;
        document.head.appendChild(node);
    }
    node.href = href;
}

export default function SEO({
    title,
    description,
    path = "/",
    image = DEFAULT_IMAGE,
    noindex = false,
    schema = [],
}) {
    useEffect(() => {
        const canonical = `${SITE_URL}${path === "/" ? "" : path}`;
        const fullTitle = title.includes("SketchyDraw")
            ? title
            : `${title} | SketchyDraw`;

        document.title = fullTitle;
        ensureMeta('meta[name="description"]', { name: "description", content: description });
        ensureMeta('meta[name="robots"]', {
            name: "robots",
            content: noindex
                ? "noindex,nofollow"
                : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
        });
        ensureMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
        ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
        ensureMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
        ensureMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
        ensureMeta('meta[property="og:image"]', { property: "og:image", content: image });
        ensureMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
        ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: fullTitle });
        ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
        ensureMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });
        ensureLink("canonical", canonical);

        document.getElementById("sketchydraw-seo-schema")?.remove();
        const script = document.createElement("script");
        script.id = "sketchydraw-seo-schema";
        script.type = "application/ld+json";
        script.textContent = JSON.stringify([
            {
                "@context": "https://schema.org",
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: "SketchyDraw",
                url: SITE_URL,
                logo: DEFAULT_IMAGE,
            },
            {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                url: SITE_URL,
                name: "SketchyDraw",
                publisher: { "@id": `${SITE_URL}/#organization` },
            },
            ...schema,
        ]);
        document.head.appendChild(script);

        return () => document.getElementById("sketchydraw-seo-schema")?.remove();
    }, [title, description, path, image, noindex, schema]);

    return null;
}
