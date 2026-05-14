import { publicGet } from "./apiClient";

export function getActiveAnnouncement() {
    return publicGet("/api/announcement/active");
}