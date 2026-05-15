import React, { useEffect, useMemo, useState } from "react";
import { isLoggedIn } from "../../utils/auth";
import { getActivePlans } from "../../api/planApi";
import { createPayment, verifyPayment } from "../../api/paymentApi";
import { startCashfreeCheckout } from "../../utils/cashfreeCheckout";
import "./SubscriptionPopup.css";

const CASHFREE_MODE =
    process.env.REACT_APP_CASHFREE_MODE === "production"
        ? "production"
        : "sandbox";

function formatPrice(plan) {
    const symbol = plan.currency === "INR" ? "₹" : plan.currency || "";
    return `${symbol}${Number(plan.price || 0).toLocaleString("en-IN")}`;
}

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
        description: plan.description || "Unlock premium SketchyDraw features.",
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

export default function SubscriptionPopup({ open, onClose, onLoginRequired }) {
    const [plans, setPlans] = useState([]);
    const [selectedPlanCode, setSelectedPlanCode] = useState("");
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [loadingPayment, setLoadingPayment] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!open) return;

        let cancelled = false;

        async function loadPlans() {
            setMessage("");
            setLoadingPlans(true);

            try {
                const data = await getActivePlans();

                const normalized = extractPlans(data)
                    .map(normalizePlan)
                    .filter((plan) => plan.code)
                    .filter((plan) => plan.active !== false)
                    .filter((plan) => !plan.productType || plan.productType === "SUBSCRIPTION")
                    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));

                if (cancelled) return;

                setPlans(normalized);
                setSelectedPlanCode((prev) => prev || normalized[0]?.code || "");
            } catch (e) {
                if (!cancelled) {
                    setPlans([]);
                    setMessage(e?.message || "Unable to load subscription plans.");
                }
            } finally {
                if (!cancelled) {
                    setLoadingPlans(false);
                }
            }
        }

        loadPlans();

        return () => {
            cancelled = true;
        };
    }, [open]);

    const selectedPlan = useMemo(() => {
        return plans.find((plan) => plan.code === selectedPlanCode) || null;
    }, [plans, selectedPlanCode]);


    if (!open) return null;

    const handleSubscribe = async () => {
        setMessage("");

        if (!isLoggedIn()) {
            onLoginRequired?.();
            return;
        }

        if (!selectedPlan?.code) {
            setMessage("Please select a plan.");
            return;
        }

        setLoadingPayment(true);

        try {
            const data = await createPayment(selectedPlan.code);

            const providerOrderId = extractProviderOrderId(data);
            const paymentSessionId = extractPaymentSessionId(data);

            if (!providerOrderId) {
                console.error("Payment response without provider order id:", data);
                throw new Error("Provider order id missing from backend response.");
            }

            if (!paymentSessionId) {
                console.error("Payment response without session id:", data);
                throw new Error("Cashfree payment session id missing from backend response.");
            }

            const checkoutResult = await startCashfreeCheckout({
                paymentSessionId,
                mode: CASHFREE_MODE,
                redirectTarget: "_modal",
            });

            console.log("Cashfree checkout result:", checkoutResult);

            /*
             * For now: after Cashfree modal completes/closes,
             * call backend verify to activate subscription.
             * Later webhook will become the real source of truth.
             */
            await verifyPayment({
                providerOrderId,
                providerPaymentId:
                    checkoutResult?.paymentDetails?.paymentMessage ||
                    checkoutResult?.payment_id ||
                    checkoutResult?.cf_payment_id ||
                    "",
                signature: "",
            });

            setMessage("Payment successful. Pro access activated.");

            window.dispatchEvent(new Event("sketchydraw:subscription-updated"));

            setTimeout(() => {
                onClose?.();
            }, 900);
        } catch (e) {
            console.error("Payment failed:", e);
            setMessage(e?.message || "Unable to complete payment.");
        } finally {
            setLoadingPayment(false);
        }
    };

    return (
        <div className="sub-popup-backdrop" onMouseDown={onClose}>
            <div className="sub-popup" onMouseDown={(e) => e.stopPropagation()}>
                <button className="sub-popup-close" type="button" onClick={onClose}>
                    ×
                </button>

                <div className="sub-popup-badge">PRO</div>

                <h2>Upgrade to SketchyDraw Pro</h2>

                <p className="sub-popup-subtitle">
                    Save drawings, open saved diagrams, groups, and premium SketchyDraw features.
                </p>

                {loadingPlans ? (
                    <div className="sub-popup-message">Loading plans...</div>
                ) : (
                    <div className="sub-plan-list">
                        {plans.map((plan) => {
                            const active = selectedPlanCode === plan.code;

                            return (
                                <button
                                    key={plan.code}
                                    type="button"
                                    className={active ? "sub-plan-card active" : "sub-plan-card"}
                                    onClick={() => setSelectedPlanCode(plan.code)}
                                >
                                    <div>
                                        <strong>{plan.name}</strong>
                                        <span>{plan.description}</span>
                                    </div>

                                    <div className="sub-plan-price">
                                        <b>{formatPrice(plan)}</b>
                                        <em>{getPlanPeriod(plan)}</em>
                                    </div>
                                </button>
                            );
                        })}

                        {!loadingPlans && plans.length === 0 && (
                            <div className="sub-popup-message">
                                No active subscription plans found.
                            </div>
                        )}
                    </div>
                )}

                <div className="sub-popup-features">
                    <div>✓ Save drawings to cloud</div>
                    <div>✓ Open your saved drawings</div>
                    <div>✓ Groups / folders</div>
                    <div>✓ Premium export features later</div>
                </div>

                {message && <div className="sub-popup-message">{message}</div>}

                <button
                    className="sub-popup-primary"
                    type="button"
                    onClick={handleSubscribe}
                    disabled={loadingPlans || loadingPayment || !selectedPlan}
                >
                    {loadingPayment
                        ? "Starting payment..."
                        : selectedPlan
                            ? `Subscribe ${formatPrice(selectedPlan)}`
                            : "Subscribe"}
                </button>

                <button className="sub-popup-secondary" type="button" onClick={onClose}>
                    Maybe later
                </button>
            </div>
        </div>
    );
}
