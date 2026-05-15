const TOKEN_KEY = "sketchydraw_token";
const USER_KEY = "sketchydraw_user";
const SESSION_KEY = "sketchydraw_session_id";

export function saveAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function saveUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
        return null;
    }
}

export function isLoggedIn() {
    return Boolean(getToken());
}

export function isPaidUser() {
    const user = getUser();
    return user?.subscription?.active === true;
}

export function authHeaders() {
    const token = getToken();

    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-Session-Id": getOrCreateSessionId(),
        "X-Correlation-Id": crypto.randomUUID(),
    };
}

function getOrCreateSessionId() {
    let sessionId = localStorage.getItem(SESSION_KEY);

    if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem(SESSION_KEY, sessionId);
    }

    return sessionId;
}