export const SOCIAL_MEDIA_PRESETS = {
    post: {
        id: "post",
        label: "Instagram Square",
        shortLabel: "Post 1:1",
        width: 1080,
        height: 1080,
        safe: { top: 80, right: 80, bottom: 80, left: 80 },
    },
    portrait: {
        id: "portrait",
        label: "Instagram Portrait",
        shortLabel: "Post 4:5",
        width: 1080,
        height: 1350,
        safe: { top: 90, right: 80, bottom: 90, left: 80 },
    },
    story: {
        id: "story",
        label: "Instagram Story",
        shortLabel: "Story 9:16",
        width: 1080,
        height: 1920,
        safe: { top: 220, right: 80, bottom: 260, left: 80 },
    },
    status: {
        id: "status",
        label: "WhatsApp Status",
        shortLabel: "Status 9:16",
        width: 1080,
        height: 1920,
        safe: { top: 180, right: 70, bottom: 220, left: 70 },
    },
};

export function getSocialMediaPreset(id) {
    return SOCIAL_MEDIA_PRESETS[id] || null;
}
