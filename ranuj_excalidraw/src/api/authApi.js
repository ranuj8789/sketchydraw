import { apiGet, apiPost, publicGet, publicPost } from "./apiClient";

export function register(payload) {
    return publicPost("/api/auth/register", payload);
}

export function login(payload) {
    return publicPost("/api/auth/login", payload);
}

export function googleLogin(credential) {
    return publicPost("/api/auth/google", {
        credential,
    });
}

export function verifyEmail(token) {
    return publicGet(`/api/auth/verify?token=${encodeURIComponent(token)}`);
}

export function forgotPassword(payload) {
    return publicPost("/api/auth/forgot-password", payload);
}

export function resetPassword(payload) {
    return publicPost("/api/auth/reset-password", payload);
}

export function resendVerification(payload) {
    return publicPost("/api/auth/resend-verification", payload);
}
export function getMyProfile() {
    return apiGet("/api/auth/me");
}

export function updateMyProfile(payload) {
    return apiPost("/api/auth/me", payload);
}