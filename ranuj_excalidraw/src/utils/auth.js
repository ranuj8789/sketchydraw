const TOKEN_KEY = "sketchydraw_token";
const USER_KEY = "sketchydraw_user";
const SESSION_KEY = "sketchydraw_session_id";

const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_URL ||
    "";

function createRandomId() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateSessionId() {
    let sessionId = localStorage.getItem(SESSION_KEY);

    if (!sessionId) {
        sessionId = createRandomId();
        localStorage.setItem(SESSION_KEY, sessionId);
    }

    return sessionId;
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error("Unable to parse SketchyDraw user", error);
        return null;
    }
}

export function saveUser(user) {
    if (!user) return null;

    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
}

export function saveAuth(token, user) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    }

    if (user) {
        saveUser(user);
    }

    return user;
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function isLoggedIn() {
    return Boolean(getToken());
}

export function authHeaders(extraHeaders = {}) {
    const token = getToken();

    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-Session-Id": getOrCreateSessionId(),
        "X-Correlation-Id": createRandomId(),
        ...extraHeaders,
    };
}

function jsonHeaders(extraHeaders = {}) {
    return authHeaders({
        "Content-Type": "application/json",
        ...extraHeaders,
    });
}

function normalizeBackendAuthResponse(data = {}) {
    const existingUser = getUser() || {};

    const token = data.token || getToken();

    const user = {
        ...existingUser,
        email: data.email || existingUser.email || null,
        fullName: data.fullName || existingUser.fullName || "",
        success: data.success,
        message: data.message,
    };

    if (token) {
        saveAuth(token, user);
    } else {
        saveUser(user);
    }

    return {
        token,
        user,
        raw: data,
    };
}

async function parseJsonResponse(response) {
    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const message =
            data?.message ||
            data?.error ||
            `Request failed with status ${response.status}`;

        throw new Error(message);
    }

    return data;
}

export async function apiGet(path) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "GET",
        headers: authHeaders(),
    });

    return parseJsonResponse(response);
}

export async function apiPost(path, body = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(body),
    });

    return parseJsonResponse(response);
}

export async function login(email, password) {
    const data = await apiPost("/api/auth/login", {
        email,
        password,
    });

    return normalizeBackendAuthResponse(data);
}

export async function register(fullName, email, password) {
    const data = await apiPost("/api/auth/register", {
        fullName,
        email,
        password,
    });

    return data;
}

export async function googleLogin(credential) {
    const data = await apiPost("/api/auth/google", {
        credential,
    });

    return normalizeBackendAuthResponse(data);
}

export async function forgotPassword(email) {
    return apiPost("/api/auth/forgot-password", {
        email,
    });
}

export async function resetPassword(token, newPassword) {
    return apiPost("/api/auth/reset-password", {
        token,
        newPassword,
    });
}

export async function resendVerification(email) {
    return apiPost("/api/auth/resend-verification", {
        email,
    });
}

export async function verifyEmail(token) {
    const response = await fetch(
        `${API_BASE_URL}/api/auth/verify?token=${encodeURIComponent(token)}`,
        {
            method: "GET",
            headers: authHeaders(),
        }
    );

    return parseJsonResponse(response);
}

export async function fetchMyProfile() {
    const data = await apiGet("/api/auth/me");

    const { user } = normalizeBackendAuthResponse(data);

    return user;
}

export async function updateMyProfile(profile = {}) {
    const data = await apiPost("/api/auth/me", {
        fullName: profile.fullName,
    });

    const { user } = normalizeBackendAuthResponse(data);

    return user;
}

export async function fetchSubscriptionStatus() {
    return apiGet("/api/payment/status");
}

export function isProUser(user = getUser()) {
    return Boolean(
        user?.isPro === true ||
        user?.pro === true ||
        user?.paid === true ||
        user?.isPaid === true ||
        user?.subscription?.active === true ||
        user?.subscriptionActive === true ||
        user?.activeSubscription === true ||
        user?.subscriptionStatus === "ACTIVE" ||
        user?.planName === "PRO" ||
        user?.plan === "PRO" ||
        user?.planCode === "PRO"
    );
}

export function isPaidUser() {
    return isProUser(getUser());
}

export function mergeSubscriptionIntoUser(status = {}) {
    const user = getUser();

    if (!user) {
        return null;
    }

    const active =
        status?.active === true ||
        status?.isPro === true ||
        status?.pro === true ||
        status?.paid === true ||
        status?.isPaid === true ||
        status?.subscriptionActive === true ||
        status?.activeSubscription === true ||
        status?.subscriptionStatus === "ACTIVE" ||
        status?.planName === "PRO" ||
        status?.plan === "PRO" ||
        status?.planCode === "PRO";

    const endsAt =
        status?.endsAt ||
        status?.ends_at ||
        status?.endDate ||
        status?.end_date ||
        null;

    const updatedUser = {
        ...user,
        isPro: active,
        isPaid: active,
        paid: active,
        planName: active ? "PRO" : "FREE",
        subscriptionStatus: active ? "ACTIVE" : "NONE",
        subscription: {
            ...(user.subscription || {}),
            active,
            endsAt,
        },
    };

    saveUser(updatedUser);

    return updatedUser;
}

export function updateLocalUserProfile(profile = {}) {
    const user = getUser() || {};

    const updatedUser = {
        ...user,
        ...profile,
        email: profile.email || user.email,
        fullName: profile.fullName || user.fullName,
    };

    saveUser(updatedUser);

    return updatedUser;
}

export async function refreshSubscriptionIntoUser() {
    if (!isLoggedIn()) {
        return null;
    }

    const status = await fetchSubscriptionStatus();
    return mergeSubscriptionIntoUser(status);
}

export async function refreshMe() {
    if (!isLoggedIn()) {
        return null;
    }

    const profile = await fetchMyProfile();
    let updatedUser = saveUser({
        ...(getUser() || {}),
        ...profile,
    });

    try {
        updatedUser = await refreshSubscriptionIntoUser();
    } catch (error) {
        console.warn("Unable to refresh subscription status", error);
    }

    return updatedUser;
}

export async function verifyPayment(providerOrderId, providerPaymentId, signature = "") {
    const status = await apiPost("/api/payment/verify", {
        providerOrderId,
        providerPaymentId,
        signature,
    });

    return mergeSubscriptionIntoUser(status);
}

export async function createPayment(planCode) {
    return apiPost("/api/payment/create", {
        planCode,
    });
}

export async function fetchPaymentHistory() {
    return apiGet("/api/payment/history");
}