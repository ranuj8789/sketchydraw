import { verifyPayment } from "../api/paymentApi";
import { getUser, mergeSubscriptionIntoUser } from "./auth";

const RAZORPAY_KEY_ID = "rzp_test_SrzxT6qVNIVV7H";

function loadRazorpayScript() {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;

        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);

        document.body.appendChild(script);
    });
}

function getAmountInPaise(order) {
    const amount = Number(order?.amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid Razorpay amount from backend.");
    }

    return Math.round(amount * 100);
}

export async function openRazorpayCheckout(order, passedUser) {
    const loaded = await loadRazorpayScript();

    if (!loaded) {
        throw new Error("Razorpay SDK failed to load");
    }

    const user = passedUser || getUser();

    const orderId = order?.providerOrderId || order?.orderId;
    const amount = getAmountInPaise(order);
    const currency = order?.currency || "INR";

    if (!orderId || !String(orderId).startsWith("order_")) {
        throw new Error(`Razorpay order id missing/invalid: ${orderId || "missing"}`);
    }

    console.log("SKETCHYDRAW RAZORPAY CHECKOUT:", {
        key: RAZORPAY_KEY_ID,
        amount,
        currency,
        order_id: orderId,
        paymentId: order?.paymentId,
    });

    return new Promise((resolve, reject) => {
        const options = {
            key: RAZORPAY_KEY_ID,
            amount,
            currency,
            name: "SketchyDraw",
            description: "SketchyDraw Pro Subscription",
            order_id: orderId,

            handler: async function (response) {
                try {
                    console.log("SKETCHYDRAW RAZORPAY SUCCESS:", response);

                    const verified = await verifyPayment({
                        paymentId: order?.paymentId,
                        provider: "RAZORPAY",

                        providerOrderId: response.razorpay_order_id,
                        providerPaymentId: response.razorpay_payment_id,
                        signature: response.razorpay_signature,

                        razorpayOrderId: response.razorpay_order_id,
                        razorpayPaymentId: response.razorpay_payment_id,
                        razorpaySignature: response.razorpay_signature,
                    });

                    const updatedUser = mergeSubscriptionIntoUser(verified);

                    resolve({
                        status: verified,
                        user: updatedUser,
                        raw: response,
                    });
                } catch (error) {
                    console.error("SKETCHYDRAW VERIFY FAILED:", error);
                    reject(error);
                }
            },

            /*
             * Do NOT send contact.
             * Razorpay was using old saved-card token for contact +919167580878,
             * causing invalid_token.
             */
            prefill: {
                name: user?.fullName || user?.name || "",
                email: user?.email || "",
            },

            notes: {
                app: "SketchyDraw",
                paymentId: String(order?.paymentId || ""),
                provider: "RAZORPAY",
            },

            theme: {
                color: "#4f46e5",
            },

            modal: {
                ondismiss: function () {
                    reject(new Error("Payment cancelled"));
                },
            },
        };

        const razorpay = new window.Razorpay(options);

        razorpay.on("payment.failed", function (response) {
            console.error("SKETCHYDRAW RAZORPAY FAILED:", response);

            const error = response?.error || {};
            const reason =
                error.description ||
                error.reason ||
                error.code ||
                "Payment failed";

            reject(new Error(reason));
        });

        razorpay.open();
    });
}