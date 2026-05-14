import { apiUrl } from "../config/api";
import { authHeaders } from "../utils/auth";

async function readError(res, fallback) {
    try {
        const text = await res.text();

        if (!text) {
            return fallback;
        }

        try {
            const json = JSON.parse(text);
            return json.message || json.error || fallback;
        } catch {
            return text;
        }
    } catch {
        return fallback;
    }
}

export async function apiGet(path, options = {}) {
    const res = await fetch(apiUrl(path), {
        method: "GET",
        headers: {
            ...authHeaders(),
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        throw new Error(await readError(res, "Request failed"));
    }

    return res.json();
}

export async function apiPost(path, body, options = {}) {
    const res = await fetch(apiUrl(path), {
        method: "POST",
        headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        body: JSON.stringify(body || {}),
    });

    if (!res.ok) {
        throw new Error(await readError(res, "Request failed"));
    }

    return res.json();
}

export async function apiDelete(path, options = {}) {
    const res = await fetch(apiUrl(path), {
        method: "DELETE",
        headers: {
            ...authHeaders(),
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        throw new Error(await readError(res, "Request failed"));
    }

    return res.json();
}

export async function publicGet(path, options = {}) {
    const res = await fetch(apiUrl(path), {
        method: "GET",
        headers: {
            "X-Session-Id": authHeaders()["X-Session-Id"],
            "X-Correlation-Id": authHeaders()["X-Correlation-Id"],
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        throw new Error(await readError(res, "Request failed"));
    }

    return res.json();
}

export async function publicPost(path, body, options = {}) {
    const res = await fetch(apiUrl(path), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Session-Id": authHeaders()["X-Session-Id"],
            "X-Correlation-Id": authHeaders()["X-Correlation-Id"],
            ...(options.headers || {}),
        },
        body: JSON.stringify(body || {}),
    });

    if (!res.ok) {
        throw new Error(await readError(res, "Request failed"));
    }

    return res.json();
}