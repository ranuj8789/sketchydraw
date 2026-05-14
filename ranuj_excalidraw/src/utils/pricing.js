import { PLAN_CODES } from "../constants/planCodes";

export function isIndiaUser() {
    const locale = navigator.language || "";
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

    return (
        locale.toLowerCase().includes("in") ||
        timeZone.toLowerCase().includes("kolkata") ||
        timeZone.toLowerCase().includes("calcutta")
    );
}

export function getSketchyDisplayPrice() {
    if (isIndiaUser()) {
        return {
            planCode: PLAN_CODES.INDIA_MONTHLY,
            currency: "INR",
            symbol: "₹",
            amount: 349,
            label: "₹349/month",
        };
    }

    return {
        planCode: PLAN_CODES.GLOBAL_MONTHLY,
        currency: "USD",
        symbol: "$",
        amount: 4,
        label: "$4/month",
    };
}