import { apiGet, apiPost } from "../utils/auth";

export function createPayment(planCode, provider = "RAZORPAY") {
    return apiPost("/payment/create", {
        planCode,
        provider,
    });
}

export function verifyPayment(payloadOrProviderOrderId, providerPaymentId, signature) {
    if (
        payloadOrProviderOrderId &&
        typeof payloadOrProviderOrderId === "object" &&
        !Array.isArray(payloadOrProviderOrderId)
    ) {
        return apiPost("/payment/verify", payloadOrProviderOrderId);
    }

    return apiPost("/payment/verify", {
        providerOrderId: payloadOrProviderOrderId,
        providerPaymentId,
        signature,
    });
}

export function getSubscriptionStatus() {
    return apiGet("/payment/status");
}

export function getPaymentHistory() {
    return apiGet("/payment/history");
}

export function markPaymentFailed(payload) {
    return apiPost("/payment/failed", payload);
}