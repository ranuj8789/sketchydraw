export function formatPlanPrice(price, currency = "INR") {
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
        return "";
    }

    const normalizedCurrency = String(currency || "INR").toUpperCase();

    return new Intl.NumberFormat(
        normalizedCurrency === "USD" ? "en-US" : "en-IN",
        {
            style: "currency",
            currency: normalizedCurrency,
            minimumFractionDigits: 0,
            maximumFractionDigits: normalizedCurrency === "USD" ? 2 : 0,
        }
    ).format(numericPrice);
}

export function filterPlansByCurrency(plans, currency) {
    const normalizedCurrency = String(currency || "").toUpperCase();

    return (Array.isArray(plans) ? plans : []).filter(
        (plan) =>
            plan?.active !== false &&
            String(plan?.currency || "").toUpperCase() === normalizedCurrency
    );
}

export function getPreferredCurrency() {
    if (typeof navigator === "undefined") {
        return "USD";
    }

    const locale = String(
        navigator.languages?.[0] ||
        navigator.language ||
        ""
    ).toLowerCase();

    return locale.endsWith("-in") ? "INR" : "USD";
}
