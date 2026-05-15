import { apiGet, apiPost } from "./apiClient";

export function getSubscriptionStatus() {
    return apiGet("/api/payment/status");
}

export function getPaymentHistory() {
    return apiGet("/api/payment/history");
}

export function createPayment(planCode) {
    return apiPost("/api/payment/create", {
        planCode,
    });
}

export function verifyPayment(payload) {
    return apiPost("/api/payment/verify", payload);
}
