import { publicGet } from "./apiClient";

export function getActivePlans() {
    return publicGet("/api/plans/active");
}
