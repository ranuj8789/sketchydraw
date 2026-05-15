import { apiGet, apiPost } from "./apiClient";

export function listDrawingGroups() {
    return apiGet("/api/drawing-groups");
}

export function createDrawingGroup(name) {
    return apiPost("/api/drawing-groups", { name });
}