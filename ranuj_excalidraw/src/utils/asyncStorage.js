export function runWhenIdle(task) {
    if ("requestIdleCallback" in window) {
        return window.requestIdleCallback(task, { timeout: 2000 });
    }

    return window.setTimeout(task, 0);
}

export function asyncSetLocalStorage(key, value) {
    return new Promise((resolve, reject) => {
        runWhenIdle(() => {
            try {
                localStorage.setItem(key, value);
                resolve(true);
            } catch (error) {
                reject(error);
            }
        });
    });
}

export function asyncGetLocalStorage(key) {
    return new Promise((resolve) => {
        runWhenIdle(() => {
            try {
                resolve(localStorage.getItem(key));
            } catch {
                resolve(null);
            }
        });
    });
}

export async function asyncSetJson(key, data) {
    const json = JSON.stringify(data);
    return asyncSetLocalStorage(key, json);
}

export async function asyncGetJson(key, fallback = null) {
    const raw = await asyncGetLocalStorage(key);

    if (!raw) return fallback;

    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}