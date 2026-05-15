import { getUser, isLoggedIn, saveUser } from "./auth";
import { getSubscriptionStatus } from "../api/paymentApi";

const CACHE_TTL_MS = 30 * 1000;

let subscriptionCache = {
    loadedAt: 0,
    active: false,
    endsAt: null,
};

function openLoginPopup() {
    window.dispatchEvent(new Event("sketchydraw:open-login"));
}

function openSubscriptionPopup(featureName) {
    window.dispatchEvent(
        new CustomEvent("sketchydraw:open-subscription", {
            detail: { featureName },
        })
    );
}

function updateLocalUserSubscription(active, endsAt) {
    const user = getUser();
    if (!user) return;

    saveUser({
        ...user,
        subscription: {
            ...(user.subscription || {}),
            active,
            endsAt: endsAt || null,
        },
    });
}

export function clearSubscriptionAccessCache() {
    subscriptionCache = {
        loadedAt: 0,
        active: false,
        endsAt: null,
    };
}

export async function getProAccessStatus({ force = false } = {}) {
    if (!isLoggedIn()) {
        return {
            active: false,
            reason: "LOGIN_REQUIRED",
            endsAt: null,
        };
    }

    const now = Date.now();
    if (!force && subscriptionCache.loadedAt && now - subscriptionCache.loadedAt < CACHE_TTL_MS) {
        return {
            active: subscriptionCache.active,
            reason: subscriptionCache.active ? "ACTIVE" : "SUBSCRIPTION_REQUIRED",
            endsAt: subscriptionCache.endsAt,
        };
    }

    try {
        const status = await getSubscriptionStatus();
        const active = status?.active === true;
        const endsAt = status?.endsAt || status?.ends_at || null;

        subscriptionCache = {
            loadedAt: now,
            active,
            endsAt,
        };

        updateLocalUserSubscription(active, endsAt);

        return {
            active,
            reason: active ? "ACTIVE" : "SUBSCRIPTION_REQUIRED",
            endsAt,
        };
    } catch (error) {
        console.error("Subscription status check failed", error);

        subscriptionCache = {
            loadedAt: now,
            active: false,
            endsAt: null,
        };

        return {
            active: false,
            reason: "SUBSCRIPTION_CHECK_FAILED",
            endsAt: null,
        };
    }
}

export async function requireProAccess(featureName = "this premium feature") {
    if (!isLoggedIn()) {
        openLoginPopup();
        return false;
    }

    const status = await getProAccessStatus({ force: true });

    if (status.active) {
        return true;
    }

    openSubscriptionPopup(featureName);
    return false;
}
