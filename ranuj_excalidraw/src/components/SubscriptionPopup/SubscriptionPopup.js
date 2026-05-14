import React, { useMemo, useState } from "react";
import { isLoggedIn } from "../../utils/auth";
import { getSketchyDisplayPrice } from "../../utils/pricing";
import { createPayment } from "../../api/paymentApi";
import "./SubscriptionPopup.css";

export default function SubscriptionPopup({ open, onClose, onLoginRequired }) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const plan = useMemo(() => getSketchyDisplayPrice(), []);

    if (!open) return null;

    const handleSubscribe = async () => {
        setMessage("");

        if (!isLoggedIn()) {
            onLoginRequired?.();
            return;
        }

        setLoading(true);

        try {
            const data = await createPayment(plan.planCode);

            setMessage(data?.message || "Payment order created successfully.");
            console.log("Payment order response:", data);
        } catch (e) {
            setMessage(e?.message || "Unable to create payment order.");
        } finally {
            setLoading(false);
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
                    Save drawings, open saved diagrams, and unlock premium SketchyDraw
                    features.
                </p>

                <div className="sub-popup-price">
                    <span>{plan.symbol}</span>
                    <strong>{plan.amount}</strong>
                    <em>/ month</em>
                </div>

                <div className="sub-popup-features">
                    <div>✓ Save drawings to cloud</div>
                    <div>✓ Open your saved drawings</div>
                    <div>✓ Payment history</div>
                    <div>✓ Premium features later</div>
                </div>

                {message && <div className="sub-popup-message">{message}</div>}

                <button
                    className="sub-popup-primary"
                    type="button"
                    onClick={handleSubscribe}
                    disabled={loading}
                >
                    {loading ? "Creating order..." : `Subscribe ${plan.label}`}
                </button>

                <button className="sub-popup-secondary" type="button" onClick={onClose}>
                    Maybe later
                </button>
            </div>
        </div>
    );
}