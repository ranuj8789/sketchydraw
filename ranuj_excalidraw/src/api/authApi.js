import { publicGet, publicPost } from "./apiClient";

export function login(payload) {
    return publicPost("/api/auth/login", payload);
}

export function register(payload) {
    return publicPost("/api/auth/register", payload);
}

export function googleLogin(credential) {
    return publicPost("/api/auth/google", { credential });
}

export function forgotPassword(email) {
    return publicPost("/api/auth/forgot-password", { email });
}

export function resetPassword(payload) {
    return publicPost("/api/auth/reset-password", payload);
}

export function verifyEmail(token) {
    return publicGet(`/api/auth/verify?token=${encodeURIComponent(token)}`);
}

export function resendVerification(email) {
    return publicPost("/api/auth/resend-verification", { email });
}