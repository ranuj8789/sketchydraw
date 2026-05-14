import { apiDelete, apiGet, apiPost } from "./apiClient";

export function listDrawings() {
    return apiGet("/api/drawings");
}

export function getDrawing(id) {
    return apiGet(`/api/drawings/${id}`);
}

export function saveDrawing({ id, title, drawingJson }) {
    return apiPost("/api/drawings", {
        id,
        title,
        drawingJson,
    });
}

export function deleteDrawing(id) {
    return apiDelete(`/api/drawings/${id}`);
}