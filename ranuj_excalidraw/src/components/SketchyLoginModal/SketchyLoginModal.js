import React, { useState } from "react";
import {
    login,
    register,
    forgotPassword,
} from "../../api/authApi";
import { saveAuth, saveUser } from "../../utils/auth";
import { getSubscriptionStatus } from "../../api/paymentApi";
import "./SketchyLoginModal.css";

function SketchyLoginModal({ open, onClose, onLoginSuccess }) {
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    const isLogin = mode === "login";
    const isSignup = mode === "signup";
    const isForgot = mode === "forgot";

    const saveLoginResponse = async (data, fallbackEmail) => {
        const token = data.token;

        if (!token) {
            throw new Error("Login success but token missing");
        }

        const user = {
            email: data.email || fallbackEmail,
            fullName: data.fullName || data.name || data.email || fallbackEmail,
        };

        // pehle token save karo, warna payment/status API authorization fail karegi
        saveAuth(token, user);

        let subscription = {
            active: false,
            endsAt: null,
        };

        try {
            subscription = await getSubscriptionStatus();
        } catch (e) {
            console.warn("Unable to fetch subscription status", e);
        }

        const userWithSubscription = {
            ...user,
            subscription,
        };

        saveUser(userWithSubscription);
        onLoginSuccess?.(userWithSubscription);
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            if (isLogin) {
                const data = await login({ email, password });
                await saveLoginResponse(data, email);
                return;
            }

            if (isSignup) {
                const data = await register({
                    fullName,
                    email,
                    password,
                });

                setMessage(data.message || "Account created. Please verify your email.");
                setMode("login");
                return;
            }

            if (isForgot) {
                const data = await forgotPassword(email);
                setMessage(data.message || "Password reset link sent.");
            }
        } catch (e) {
            setMessage(e.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const title = isLogin
        ? "Login to SketchyDraw"
        : isSignup
            ? "Create your SketchyDraw account"
            : "Reset your password";

    const subtitle = isLogin
        ? "Save diagrams, open saved drawings, and manage your subscription."
        : isSignup
            ? "Create an account to save your SketchyDraw diagrams."
            : "Enter your email and we will send a reset link.";

    return (
        <div className="sk-auth-backdrop" onMouseDown={onClose}>
            <div className="sk-auth-modal" onMouseDown={(e) => e.stopPropagation()}>
                <button className="sk-auth-close" type="button" onClick={onClose}>
                    ×
                </button>

                <div className="sk-auth-header">
                    <div className="sk-auth-badge">S</div>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>

                <form className="sk-auth-form" onSubmit={handleSubmit}>
                    {isSignup && (
                        <label className="sk-auth-field">
                            <span>Full name</span>
                            <input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your name"
                                required
                            />
                        </label>
                    )}

                    <label className="sk-auth-field">
                        <span>Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </label>

                    {!isForgot && (
                        <label className="sk-auth-field">
                            <span>Password</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                required
                            />
                        </label>
                    )}

                    {isLogin && (
                        <button
                            className="sk-auth-link"
                            type="button"
                            onClick={() => {
                                setMode("forgot");
                                setMessage("");
                            }}
                        >
                            Forgot password?
                        </button>
                    )}

                    {message && <div className="sk-auth-message">{message}</div>}

                    <button className="sk-auth-primary" disabled={loading}>
                        {loading
                            ? "Please wait..."
                            : isLogin
                                ? "Login"
                                : isSignup
                                    ? "Create account"
                                    : "Send reset link"}
                    </button>
                </form>

                <div className="sk-auth-switch">
                    {isLogin && (
                        <>
                            New here?{" "}
                            <button type="button" onClick={() => setMode("signup")}>
                                Create account
                            </button>
                        </>
                    )}

                    {isSignup && (
                        <>
                            Already have an account?{" "}
                            <button type="button" onClick={() => setMode("login")}>
                                Login
                            </button>
                        </>
                    )}

                    {isForgot && (
                        <>
                            Remember password?{" "}
                            <button type="button" onClick={() => setMode("login")}>
                                Back to login
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SketchyLoginModal;