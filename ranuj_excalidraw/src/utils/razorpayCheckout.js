import { verifyPayment, markPaymentFailed } from "../api/paymentApi";
import { getUser, mergeSubscriptionIntoUser } from "./auth";

const FALLBACK_RAZORPAY_KEY_ID = "rzp_live_TJDhUpDzvfjBgg";

function getRazorpayKeyId(order) {
    return (
        order?.razorpayKeyId ||
        process.env.REACT_APP_RAZORPAY_KEY_ID ||
        FALLBACK_RAZORPAY_KEY_ID
    );
}

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

    // Backend amount is rupees. Razorpay checkout needs paise.
    return Math.round(amount * 100);
}

function extractFailureReason(response) {
    const error = response?.error || {};

    return (
        error.description ||
        error.reason ||
        error.code ||
        "RAZORPAY_PAYMENT_FAILED_OR_CANCELLED"
    );
}

function extractFailurePaymentId(response) {
    const error = response?.error || {};

    return (
        error?.metadata?.payment_id ||
        error?.metadata?.razorpay_payment_id ||
        error?.payment_id ||
        ""
    );
}

async function safelyMarkPaymentFailed(order, responseOrReason) {
    const providerOrderId =
        order?.providerOrderId ||
        order?.orderId ||
        responseOrReason?.error?.metadata?.order_id ||
        responseOrReason?.error?.metadata?.razorpay_order_id ||
        "";

    if (!providerOrderId) {
        console.warn("Cannot mark payment failed. Provider order id missing.", {
            order,
            responseOrReason,
        });
        return;
    }

    try {
        await markPaymentFailed({
            providerOrderId,
            providerPaymentId:
                typeof responseOrReason === "string"
                    ? ""
                    : extractFailurePaymentId(responseOrReason),
            reason:
                typeof responseOrReason === "string"
                    ? responseOrReason
                    : extractFailureReason(responseOrReason),
        });
    } catch (error) {
        console.warn("Unable to mark Razorpay payment as failed:", error);
    }
}

export async function openRazorpayCheckout(order, passedUser) {
    const loaded = await loadRazorpayScript();

    if (!loaded) {
        throw new Error("Razorpay SDK failed to load");
    }

    const user = passedUser || getUser();

    const keyId = getRazorpayKeyId(order);
    const orderId = order?.providerOrderId || order?.orderId;
    const amount = getAmountInPaise(order);
    const currency = order?.currency || "INR";

    if (!keyId) {
        throw new Error("Razorpay key id missing.");
    }

    if (!orderId || !String(orderId).startsWith("order_")) {
        throw new Error(`Razorpay order id missing/invalid: ${orderId || "missing"}`);
    }

    console.log("SKETCHYDRAW RAZORPAY CHECKOUT:", {
        key: keyId,
        amount,
        currency,
        order_id: orderId,
        paymentId: order?.paymentId,
    });

    return new Promise((resolve, reject) => {
        const options = {
            key: keyId,
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
             * Razorpay may use old saved-card/token for contact and cause invalid_token.
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
                ondismiss: async function () {
                    const reason = "Payment cancelled by user";
                    await safelyMarkPaymentFailed(order, reason);
                    reject(new Error(reason));
                },
            },
        };

        const razorpay = new window.Razorpay(options);

        razorpay.on("payment.failed", async function (response) {
            console.error("SKETCHYDRAW RAZORPAY FAILED:", response);

            const reason = extractFailureReason(response);
            await safelyMarkPaymentFailed(order, response);

            reject(new Error(reason));
        });

        razorpay.open();
    });
}