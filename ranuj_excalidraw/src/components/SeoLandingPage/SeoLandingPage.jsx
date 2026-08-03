import React from "react";
import SEO from "../SEO/SEO";
import "./SeoLandingPage.css";

export const SEO_PAGES = {
    "/features": {
        title: "Animated Diagram Maker Features",
        description: "Create diagrams, animations, frame-based explainers, presentations, GIFs and videos in one browser workspace.",
        eyebrow: "SketchyDraw features",
        heading: "Turn ideas into animated visual explanations",
        intro: "SketchyDraw combines drawing, object animation, frames, narration, presentations and export tools for educators, developers and creators.",
        bullets: [
            "Draw shapes, arrows, text, images and technical diagrams",
            "Animate objects with familiar presentation-style controls",
            "Build multi-frame storyboards and replay every frame",
            "Record narration for individual frames",
            "Export as PNG, SVG, PDF, GIF and video",
            "Create square, portrait and story social content",
        ],
    },
    "/animated-diagram-maker": {
        title: "Animated Diagram Maker Online",
        description: "Make animated diagrams online with frames, object animations, narration, GIF export and video playback.",
        eyebrow: "Animated diagrams",
        heading: "Create animated diagrams without a complex video editor",
        intro: "Draw a process, animate each object, arrange the explanation into frames and replay the complete story before exporting it.",
        bullets: [
            "Live animation preview",
            "Entrance and emphasis effects",
            "Frame timing and transitions",
            "Full-screen playback",
            "Audio narration per frame",
            "GIF and MP4 export",
        ],
    },
    "/ai-diagram-maker": {
        title: "AI Diagram Maker for Visual Explanations",
        description: "Create clear AI, machine-learning and data-flow diagrams with animated frames, arrows, text and video export.",
        eyebrow: "AI visualisation",
        heading: "Explain AI concepts with clear animated diagrams",
        intro: "Visualise data, training, models, inference and agents using editable objects and frame-by-frame animation.",
        bullets: [
            "AI foundation explainers",
            "Machine-learning workflows",
            "Animated data and request flows",
            "Editable text, shapes and arrows",
            "LinkedIn and YouTube formats",
            "Reusable visual templates",
        ],
    },
    "/system-design-diagram-maker": {
        title: "System Design Diagram Maker Online",
        description: "Draw and animate architecture with servers, databases, caches, queues, APIs and presentation frames.",
        eyebrow: "System design",
        heading: "Build system design diagrams that explain themselves",
        intro: "Create editable architecture diagrams and animate requests through services, databases, caches and queues.",
        bullets: [
            "Servers, APIs and databases",
            "Queues, caches and load balancers",
            "Animated request and response flows",
            "Interview and course diagrams",
            "Frame-based presentations",
            "SVG, PDF, GIF and video export",
        ],
    },
    "/presentation-maker": {
        title: "Animated Presentation Maker Online",
        description: "Create editable visual presentations with frames, object animations, narration, full-screen playback and export.",
        eyebrow: "Visual presentations",
        heading: "Make visual presentations frame by frame",
        intro: "Combine a whiteboard, animation panel and storyboard to build presentations that remain fully editable.",
        bullets: [
            "Add, duplicate and reorder frames",
            "Animate objects inside each frame",
            "Replay one frame or all frames",
            "Full-screen focus mode",
            "Narration for each frame",
            "GIF, video and PDF workflows",
        ],
    },
    "/gif-maker": {
        title: "Animated GIF Maker from Diagrams",
        description: "Turn editable diagrams and frames into animated GIFs for lessons, documentation, social posts and product explainers.",
        eyebrow: "Diagram to GIF",
        heading: "Turn your visual explanation into an animated GIF",
        intro: "Create the drawing once, animate it, preview the frames and export a shareable GIF without rebuilding it elsewhere.",
        bullets: [
            "Frame-based GIF creation",
            "Object timing controls",
            "Preview before export",
            "Square and portrait formats",
            "Text, arrows, shapes and images",
            "Useful for social and documentation",
        ],
    },
};

export default function SeoLandingPage({ page, path }) {
    const appSchema = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "SketchyDraw",
        applicationCategory: "DesignApplication",
        operatingSystem: "Web browser",
        url: "https://sketchydraw.com",
        description: page.description,
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
        },
        featureList: page.bullets.join("; "),
    };

    return (
        <>
            <SEO title={page.title} description={page.description} path={path} schema={[appSchema]} />
            <main className="seo-landing">
                <header className="seo-nav">
                    <a className="seo-brand" href="/">SketchyDraw</a>
                    <nav>
                        <a href="/features">Features</a>
                        <a href="/animated-diagram-maker">Animations</a>
                        <a href="/system-design-diagram-maker">System design</a>
                        <a className="seo-small-cta" href="/">Open app</a>
                    </nav>
                </header>

                <section className="seo-hero">
                    <div>
                        <span>{page.eyebrow}</span>
                        <h1>{page.heading}</h1>
                        <p>{page.intro}</p>
                        <div className="seo-actions">
                            <a className="seo-primary" href="/">Start drawing</a>
                            <a className="seo-secondary" href="/features">Explore features</a>
                        </div>
                    </div>
                    <div className="seo-preview">
                        <div className="seo-preview-bar">Frame 2 / 6</div>
                        <div className="seo-preview-canvas">
                            <div className="seo-node purple">Draw</div>
                            <div className="seo-node blue">Animate</div>
                            <div className="seo-node green">Share</div>
                            <div className="seo-line" />
                            <strong>Frames • GIF • Video</strong>
                        </div>
                    </div>
                </section>

                <section className="seo-section">
                    <span>What you can do</span>
                    <h2>A visual workspace, not just a drawing canvas</h2>
                    <div className="seo-grid">
                        {page.bullets.map((bullet) => (
                            <article key={bullet}><b>✓</b><p>{bullet}</p></article>
                        ))}
                    </div>
                </section>

                <section className="seo-steps">
                    <div><span>Simple workflow</span><h2>Draw. Animate. Arrange. Share.</h2></div>
                    <ol>
                        <li><b>1</b><p>Draw with editable objects.</p></li>
                        <li><b>2</b><p>Add animation and preview it.</p></li>
                        <li><b>3</b><p>Arrange the explanation into frames.</p></li>
                        <li><b>4</b><p>Present or export for your audience.</p></li>
                    </ol>
                </section>

                <section className="seo-final">
                    <h2>Make your next explanation visual</h2>
                    <p>Start with a blank canvas and turn your idea into an animated story.</p>
                    <a className="seo-primary" href="/">Open SketchyDraw</a>
                </section>

                <footer className="seo-footer">
                    <div><b>SketchyDraw</b><span>Animated diagrams and visual explanations.</span></div>
                    <nav><a href="/privacy-policy">Privacy</a><a href="/terms">Terms</a><a href="/contact-us">Contact</a></nav>
                </footer>
            </main>
        </>
    );
}
