import React, { useEffect, useMemo, useState } from "react";
import {
    getUser,
    isLoggedIn,
    isProUser,
    mergeSubscriptionIntoUser,
} from "../../utils/auth";
import { getActivePlans } from "../../api/planApi";
import {
    createPayment,
    verifyPayment,
    getSubscriptionStatus,
} from "../../api/paymentApi";
import { startCashfreeCheckout } from "../../utils/cashfreeCheckout";
import { openRazorpayCheckout } from "../../utils/razorpayCheckout";
import {
    filterPlansByCurrency,
    formatPlanPrice,
    getPreferredCurrency,
} from "../../utils/pricing";
import "./SubscriptionPopup.css";

const CASHFREE_MODE =
    process.env.REACT_APP_CASHFREE_MODE === "production"
        ? "production"
        : "sandbox";

const DEFAULT_PAYMENT_PROVIDER =
    process.env.REACT_APP_PAYMENT_PROVIDER === "CASHFREE"
        ? "CASHFREE"
        : "RAZORPAY";

function getPlanPeriod(plan) {
    const days = Number(plan.validityDays || 0);

    if (days >= 365) return "/ year";
    if (days >= 180) return "/ 6 months";
    if (days >= 30) return "/ month";
    if (days > 0) return `/${days} days`;

    return "";
}

function normalizePlan(plan) {
    return {
        id: plan.id,
        code: plan.code || plan.planCode || plan.plan_code,
        name: plan.name || "SketchyDraw Pro",
        price: plan.price,
        currency: plan.currency || "INR",
        active: plan.active,
        productType: plan.productType || plan.product_type,
        validityDays: plan.validityDays || plan.validity_days,
        description:
            plan.description || "Unlock premium SketchyDraw features.",
    };
}

function extractPlans(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.plans)) return data.plans;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.content)) return data.content;

    return [];
}

function extractPaymentSessionId(data) {
    return (
        data?.paymentSessionId ||
        data?.payment_session_id ||
        data?.cashfreePaymentSessionId ||
        data?.order?.payment_session_id ||
        data?.data?.paymentSessionId ||
        data?.data?.payment_session_id ||
        null
    );
}

function extractProviderOrderId(data) {
    return (
        data?.providerOrderId ||
        data?.provider_order_id ||
        data?.orderId ||
        data?.order_id ||
        data?.order?.order_id ||
        ""
    );
}

function extractProviderPaymentIdFromCashfree(
    checkoutResult,
    orderResponse
) {
    return (
        checkoutResult?.paymentDetails?.paymentMessage ||
        checkoutResult?.paymentDetails?.paymentId ||
        checkoutResult?.payment_id ||
        checkoutResult?.cf_payment_id ||
        orderResponse?.providerPaymentId ||
        orderResponse?.cfOrderId ||
        ""
    );
}

function getExpiryDate(user, status) {
    return (
        user?.subscription?.endsAt ||
        status?.endsAt ||
        status?.endDate ||
        status?.validTill ||
        status?.subscriptionEndDate ||
        null
    );
}

export default function SubscriptionPopup({
                                              open,
                                              onClose,
                                              onLoginRequired,
                                          }) {
    const [plans, setPlans] = useState([]);
    const [selectedPlanCode, setSelectedPlanCode] = useState("");
    const [selectedProvider] = useState(DEFAULT_PAYMENT_PROVIDER);

    const [loadingPlans, setLoadingPlans] = useState(false);
    const [loadingPayment, setLoadingPayment] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [message, setMessage] = useState("");

    const [status, setStatus] = useState(null);
    const [user, setUser] = useState(getUser());

    useEffect(() => {
        if (!open) return undefined;

        const handleEscape = (event) => {
            if (event.key !== "Escape") return;

            event.preventDefault();
            onClose?.();
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return undefined;

        let cancelled = false;

        async function loadPlans() {
            setMessage("");
            setLoadingPlans(true);

            try {
                const data = await getActivePlans();
                const preferredCurrency = getPreferredCurrency();

                const activeSubscriptionPlans = extractPlans(data)
                    .map(normalizePlan)
                    .filter((plan) => plan.code)
                    .filter((plan) => plan.active !== false)
                    .filter(
                        (plan) =>
                            !plan.productType ||
                            String(plan.productType).toUpperCase() ===
                            "SUBSCRIPTION"
                    );

                const normalized = filterPlansByCurrency(
                    activeSubscriptionPlans,
                    preferredCurrency
                ).sort(
                    (a, b) =>
                        Number(a.validityDays || 0) -
                        Number(b.validityDays || 0)
                );

                if (cancelled) return;

                setPlans(normalized);
                setSelectedPlanCode((previousCode) => {
                    if (
                        previousCode &&
                        normalized.some(
                            (plan) => plan.code === previousCode
                        )
                    ) {
                        return previousCode;
                    }

                    return normalized[0]?.code || "";
                });
            } catch (error) {
                if (!cancelled) {
                    setPlans([]);
                    setSelectedPlanCode("");
                    setMessage(
                        error?.message ||
                        "Unable to load subscription plans."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingPlans(false);
                }
            }
        }

        async function loadStatus() {
            if (!isLoggedIn()) {
                setStatus(null);
                setUser(getUser());
                return;
            }

            setLoadingStatus(true);

            try {
                const data = await getSubscriptionStatus();
                const updatedUser =
                    mergeSubscriptionIntoUser(data) || getUser();

                if (cancelled) return;

                setStatus(data);
                setUser(updatedUser);
            } catch {
                if (!cancelled) {
                    setStatus(null);
                    setUser(getUser());
                }
            } finally {
                if (!cancelled) {
                    setLoadingStatus(false);
                }
            }
        }

        loadPlans();
        loadStatus();

        return () => {
            cancelled = true;
        };
    }, [open]);

    const selectedPlan = useMemo(() => {
        return (
            plans.find((plan) => plan.code === selectedPlanCode) ||
            null
        );
    }, [plans, selectedPlanCode]);

    const activePro =
        isProUser(user) ||
        status?.active === true ||
        status?.isPro === true ||
        status?.pro === true ||
        status?.subscriptionStatus === "ACTIVE" ||
        status?.planName === "PRO";

    const expiryDate = getExpiryDate(user, status);

    if (!open) return null;

    async function activateFromVerifyResponse(verifyResponse) {
        const updatedUser =
            mergeSubscriptionIntoUser(verifyResponse) ||
            mergeSubscriptionIntoUser({
                active: true,
                isPro: true,
                planName: "PRO",
                subscriptionStatus: "ACTIVE",
            }) ||
            getUser();

        setUser(updatedUser);
        setStatus(verifyResponse);

        window.dispatchEvent(
            new Event("sketchydraw:subscription-updated")
        );

        return updatedUser;
    }

    async function handleSubscribeCashfree() {
        setMessage("");

        if (!isLoggedIn()) {
            onLoginRequired?.();
            return;
        }

        if (activePro) {
            setMessage(
                "You already have an active Pro subscription. No new payment is required."
            );
            return;
        }

        if (!selectedPlan?.code) {
            setMessage("Please select a plan.");
            return;
        }

        setLoadingPayment(true);

        try {
            const data = await createPayment(
                selectedPlan.code,
                "CASHFREE"
            );

            const providerOrderId = extractProviderOrderId(data);
            const paymentSessionId = extractPaymentSessionId(data);

            if (!providerOrderId) {
                console.error(
                    "Payment response without provider order id:",
                    data
                );
                throw new Error(
                    "Provider order id missing from backend response."
                );
            }

            if (!paymentSessionId) {
                console.error(
                    "Payment response without session id:",
                    data
                );
                throw new Error(
                    "Cashfree payment session id missing from backend response."
                );
            }

            const checkoutResult = await startCashfreeCheckout({
                paymentSessionId,
                mode: CASHFREE_MODE,
                redirectTarget: "_modal",
            });

            const verifyResponse = await verifyPayment({
                providerOrderId,
                providerPaymentId:
                    extractProviderPaymentIdFromCashfree(
                        checkoutResult,
                        data
                    ),
                signature: "",
            });

            await activateFromVerifyResponse(verifyResponse);

            setMessage(
                "Payment successful. Pro access activated."
            );

            window.setTimeout(() => {
                onClose?.();
            }, 900);
        } catch (error) {
            console.error("Cashfree payment failed:", error);
            setMessage(
                error?.message ||
                "Unable to complete Cashfree payment."
            );
        } finally {
            setLoadingPayment(false);
        }
    }

    async function handleSubscribeRazorpay() {
        setMessage("");

        if (!isLoggedIn()) {
            onLoginRequired?.();
            return;
        }

        if (activePro) {
            setMessage(
                "You already have an active Pro subscription. No new payment is required."
            );
            return;
        }

        if (!selectedPlan?.code) {
            setMessage("Please select a plan.");
            return;
        }

        setLoadingPayment(true);

        try {
            const order = await createPayment(
                selectedPlan.code,
                "RAZORPAY"
            );

            const result = await openRazorpayCheckout(
                order,
                getUser()
            );

            if (result?.status) {
                await activateFromVerifyResponse(result.status);
            } else {
                const freshStatus =
                    await getSubscriptionStatus();
                await activateFromVerifyResponse(freshStatus);
            }

            setMessage(
                "Payment successful. Pro access activated."
            );

            window.setTimeout(() => {
                onClose?.();
            }, 900);
        } catch (error) {
            console.error("Razorpay payment failed:", error);
            setMessage(
                error?.message ||
                "Unable to complete Razorpay payment."
            );
        } finally {
            setLoadingPayment(false);
        }
    }

    async function handleSubscribe() {
        if (selectedProvider === "CASHFREE") {
            await handleSubscribeCashfree();
            return;
        }

        await handleSubscribeRazorpay();
    }

    return (
        <div
            className="sub-popup-backdrop"
            onMouseDown={onClose}
        >
            <div
                className="sub-popup"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <button
                    className="sub-popup-close"
                    type="button"
                    onClick={onClose}
                    aria-label="Close subscription popup"
                >
                    ×
                </button>

                <div
                    className={
                        activePro
                            ? "sub-popup-badge active"
                            : "sub-popup-badge"
                    }
                >
                    {activePro ? "PRO ACTIVE" : "PRO"}
                </div>

                <h2>
                    {activePro
                        ? "You are already on SketchyDraw Pro"
                        : "Upgrade to SketchyDraw Pro"}
                </h2>

                <p className="sub-popup-subtitle">
                    Save drawings, open saved diagrams, groups, and
                    premium SketchyDraw features.
                </p>

                {loadingStatus && (
                    <div className="sub-popup-message">
                        Checking subscription status...
                    </div>
                )}

                {activePro && (
                    <div className="sub-popup-active-card">
                        <strong>
                            ⭐ Your Pro subscription is active.
                        </strong>

                        <span>
                            {expiryDate
                                ? `Valid till ${new Date(
                                    expiryDate
                                ).toLocaleDateString()}`
                                : "Your Pro features are active."}
                        </span>

                        <em>No need to pay again.</em>
                    </div>
                )}

                {loadingPlans ? (
                    <div className="sub-popup-message">
                        Loading plans...
                    </div>
                ) : (
                    <div className="sub-plan-list">
                        {plans.map((plan) => {
                            const active =
                                selectedPlanCode === plan.code;

                            return (
                                <button
                                    key={plan.code}
                                    type="button"
                                    className={
                                        active
                                            ? "sub-plan-card active"
                                            : "sub-plan-card"
                                    }
                                    onClick={() => {
                                        if (!activePro) {
                                            setSelectedPlanCode(
                                                plan.code
                                            );
                                        }
                                    }}
                                    disabled={activePro}
                                >
                                    <div>
                                        <strong>{plan.name}</strong>
                                        <span>
                                            {plan.description}
                                        </span>
                                    </div>

                                    <div className="sub-plan-price">
                                        <b>
                                            {formatPlanPrice(
                                                plan.price,
                                                plan.currency
                                            )}
                                        </b>
                                        <em>
                                            {getPlanPeriod(plan)}
                                        </em>
                                    </div>
                                </button>
                            );
                        })}

                        {!loadingPlans &&
                            plans.length === 0 && (
                                <div className="sub-popup-message">
                                    No active subscription plans
                                    found.
                                </div>
                            )}
                    </div>
                )}

                <div className="sub-popup-features">
                    <div>✓ Save drawings to cloud</div>
                    <div>✓ Open your saved drawings</div>
                    <div>✓ Groups / folders</div>
                    <div>✓ Clean exports with small SketchyDraw credit</div>
                    <div>✓ Premium export features later</div>
                </div>

                {message && (
                    <div className="sub-popup-message">
                        {message}
                    </div>
                )}

                <button
                    className="sub-popup-primary"
                    type="button"
                    onClick={handleSubscribe}
                    disabled={
                        activePro ||
                        loadingPlans ||
                        loadingPayment ||
                        !selectedPlan
                    }
                >
                    {activePro
                        ? "Pro Active"
                        : loadingPayment
                            ? `Starting ${
                                selectedProvider === "CASHFREE"
                                    ? "Cashfree"
                                    : "Razorpay"
                            }...`
                            : selectedPlan
                                ? `Subscribe ${formatPlanPrice(
                                    selectedPlan.price,
                                    selectedPlan.currency
                                )}`
                                : "Subscribe"}
                </button>

                <button
                    className="sub-popup-secondary"
                    type="button"
                    onClick={onClose}
                >
                    {activePro ? "Close" : "Maybe later"}
                </button>
            </div>
        </div>
    );
}
