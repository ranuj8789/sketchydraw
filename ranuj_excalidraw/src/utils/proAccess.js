import { getUser, isLoggedIn, isProUser, saveUser } from "./auth";
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

function parseDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLocalProStatus() {
    const user = getUser();
    if (!user || !isProUser(user)) {
        return { active: false, endsAt: null };
    }

    const endsAt =
        user?.subscription?.endsAt ||
        user?.subscription?.ends_at ||
        user?.endsAt ||
        user?.endDate ||
        null;

    const parsedEnd = parseDate(endsAt);
    if (parsedEnd && parsedEnd.getTime() < Date.now()) {
        return { active: false, endsAt };
    }

    return { active: true, endsAt };
}

function updateLocalUserSubscription(active, endsAt) {
    const user = getUser();
    if (!user) return;

    saveUser({
        ...user,
        isPro: active,
        isPaid: active,
        paid: active,
        planName: active ? "PRO" : "FREE",
        subscriptionStatus: active ? "ACTIVE" : "NONE",
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
        return { active: false, reason: "LOGIN_REQUIRED", endsAt: null };
    }

    const now = Date.now();
    const localStatus = getLocalProStatus();

    if (!force && localStatus.active) {
        return { active: true, reason: "ACTIVE_LOCAL", endsAt: localStatus.endsAt };
    }

    if (!force && subscriptionCache.loadedAt && now - subscriptionCache.loadedAt < CACHE_TTL_MS) {
        return {
            active: subscriptionCache.active,
            reason: subscriptionCache.active ? "ACTIVE" : "SUBSCRIPTION_REQUIRED",
            endsAt: subscriptionCache.endsAt,
        };
    }

    try {
        const status = await getSubscriptionStatus();
        const active =
            status?.active === true ||
            status?.isPro === true ||
            status?.paid === true ||
            status?.subscriptionStatus === "ACTIVE" ||
            status?.planName === "PRO" ||
            status?.planCode === "PRO";
        const endsAt = status?.endsAt || status?.ends_at || status?.endDate || null;

        subscriptionCache = { loadedAt: now, active, endsAt };
        updateLocalUserSubscription(active, endsAt);

        return {
            active,
            reason: active ? "ACTIVE" : "SUBSCRIPTION_REQUIRED",
            endsAt,
        };
    } catch (error) {
        console.error("Subscription status check failed", error);

        if (localStatus.active) {
            subscriptionCache = {
                loadedAt: now,
                active: true,
                endsAt: localStatus.endsAt,
            };
            return {
                active: true,
                reason: "ACTIVE_LOCAL_FALLBACK",
                endsAt: localStatus.endsAt,
            };
        }

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

    const localStatus = getLocalProStatus();
    if (localStatus.active) {
        return true;
    }

    const status = await getProAccessStatus({ force: true });
    if (status.active) {
        return true;
    }

    openSubscriptionPopup(featureName);
    return false;
}
