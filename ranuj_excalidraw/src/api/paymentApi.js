import { apiGet, apiPost } from "../utils/auth";

export function createPayment(planCode, provider = "RAZORPAY") {
    return apiPost("/api/payment/create", {
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
        return apiPost("/api/payment/verify", payloadOrProviderOrderId);
    }

    return apiPost("/api/payment/verify", {
        providerOrderId: payloadOrProviderOrderId,
        providerPaymentId,
        signature,
    });
}

export function getSubscriptionStatus() {
    return apiGet("/api/payment/status");
}

export function getPaymentHistory() {
    return apiGet("/api/payment/history");
}