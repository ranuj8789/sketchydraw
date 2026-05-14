import React, { useEffect, useMemo, useState } from "react";
import "./subscribepage.css";
import {
    getPlans,
    getSubscriptionStatus,
    createPayment,
    verifyPayment,
} from "../api/paymentApi";
import { isLoggedIn, getUser } from "../../utils/auth";

const PLACEHOLDER_PLANS = [
    {
        id: "sketchy_monthly_349",
        code: "SKETCHY_MONTHLY_349",
        name: "SketchyDraw Pro",
        price: 349,
        duration: "Monthly",
        description: "Save drawings, open saved drawings, export, and use premium tools.",
        features: [
            "Save drawings to cloud",
            "Open saved drawings",
            "Export PNG, SVG, PDF",
            "Premium drawing tools",
        ],
    },
];

function SubscribePage({ onLoginRequired }) {
    const [plans, setPlans] = useState(PLACEHOLDER_PLANS);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [payingPlanCode, setPayingPlanCode] = useState(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const loggedIn = isLoggedIn();
    const user = getUser();

    const sortedPlans = useMemo(() => {
        return [...plans].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }, [plans]);

    useEffect(() => {
        loadPage();
    }, []);

    const loadPage = async () => {
        setLoading(true);
        setError("");
        setMessage("");

        try {
            try {
                const planRes = await getPlans();

                if (Array.isArray(planRes)) {
                    setPlans(planRes);
                } else if (Array.isArray(planRes?.plans)) {
                    setPlans(planRes.plans);
                } else if (Array.isArray(planRes?.data)) {
                    setPlans(planRes.data);
                }
            } catch {
                setPlans(PLACEHOLDER_PLANS);
            }

            if (loggedIn) {
                try {
                    const statusRes = await getSubscriptionStatus();
                    setStatus(statusRes);
                } catch {
                    setStatus(null);
                }
            }
        } catch (e) {
            setError(e.message || "Failed to load subscription page");
        } finally {
            setLoading(false);
        }
    };

    const requireLogin = () => {
        if (loggedIn) return true;

        if (onLoginRequired) {
            onLoginRequired();
        } else {
            alert("Please login first");
        }

        return false;
    };

    const startPayment = async (plan) => {
        if (!requireLogin()) return;

        setError("");
        setMessage("Creating payment order...");
        setPayingPlanCode(plan.code || plan.planCode || plan.id);

        try {
            const planCode = plan.code || plan.planCode || plan.id;

            const order = await createPayment(planCode);

            setMessage(
                `Payment placeholder created for ${plan.name}. Backend order id: ${
                    order?.orderId || order?.id || "N/A"
                }`
            );

            /*
              Later Razorpay/Cashfree open checkout here.

              After payment success:
              await verifyPayment({
                orderId,
                paymentId,
                signature
              });
            */
        } catch (e) {
            setError(e.message || "Failed to create payment");
        } finally {
            setPayingPlanCode(null);
        }
    };

    return (
        <div className="sub-page">
            <div className="sub-container">
                <div className="sub-hero">
                    <div>
                        <p className="sub-kicker">SketchyDraw Billing</p>
                        <h1 className="sub-title">Upgrade to SketchyDraw Pro</h1>
                        <p className="sub-subtitle">
                            Subscribe to save diagrams, reopen drawings, export boards, and unlock
                            premium SketchyDraw features.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="sub-refresh-btn"
                        onClick={loadPage}
                        disabled={loading}
                    >
                        {loading ? "Loading..." : "Refresh"}
                    </button>
                </div>

                {status && (
                    <div className="sub-info-card">
                        <h2>Your Subscription</h2>
                        <p>
                            Current status: <strong>{status.status || "Active"}</strong>
                        </p>
                    </div>
                )}

                {error && <div className="sub-error">⚠ {error}</div>}
                {message && <div className="sub-message">✅ {message}</div>}

                <div className="sub-plan-grid">
                    {sortedPlans.map((plan) => {
                        const planCode = plan.code || plan.planCode || plan.id;
                        const paying = payingPlanCode === planCode;

                        return (
                            <div className="sub-plan-card sub-plan-popular" key={planCode}>
                                <div className="sub-badge">Best Value</div>

                                <div className="sub-plan-header">
                                    <h2>{plan.name || "SketchyDraw Pro"}</h2>
                                    <p>
                                        {plan.description ||
                                            "Premium drawing, saving, and export features."}
                                    </p>
                                </div>

                                <div className="sub-price">
                                    <span>₹</span>
                                    <strong>{Number(plan.price || 349)}</strong>
                                </div>

                                <div className="sub-benefits">
                                    {(plan.features || PLACEHOLDER_PLANS[0].features).map((feature) => (
                                        <div key={feature}>
                                            <span>Included</span>
                                            <strong>{feature}</strong>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    className="sub-primary-btn"
                                    onClick={() => startPayment(plan)}
                                    disabled={paying}
                                >
                                    {paying
                                        ? "Creating Order..."
                                        : loggedIn
                                            ? "Subscribe Now"
                                            : "Login to Subscribe"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default SubscribePage;