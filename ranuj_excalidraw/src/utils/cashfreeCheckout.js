const DEFAULT_MODE =
    process.env.REACT_APP_CASHFREE_MODE === "production"
        ? "production"
        : "sandbox";

export function getCashfreeSdk() {
    if (!window.Cashfree) {
        throw new Error(
            "Cashfree SDK not loaded. Add this script in public/index.html: https://sdk.cashfree.com/js/v3/cashfree.js"
        );
    }

    return window.Cashfree;
}

export async function startCashfreeCheckout({
                                                paymentSessionId,
                                                mode = DEFAULT_MODE,
                                                redirectTarget = "_modal",
                                            }) {
    if (!paymentSessionId) {
        throw new Error("Payment session id missing.");
    }

    const Cashfree = getCashfreeSdk();

    const cashfree = Cashfree({
        mode,
    });

    return cashfree.checkout({
        paymentSessionId,
        redirectTarget,
    });
}
