import React, { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import {
    forgotPassword,
    googleLogin,
    login,
    register,
    resendVerification,
} from "../../api/authApi";
import { saveAuth } from "../../utils/auth";
import "./SketchyLoginModal.css";

export default function SketchyLoginModal({
                                              open,
                                              onClose,
                                              onLoginSuccess,
                                          }) {
    const [mode, setMode] = useState("login");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;

        setMessage("");
        setSuccessMessage("");
        setPassword("");
    }, [open, mode]);

    if (!open) return null;

    const resetMessages = () => {
        setMessage("");
        setSuccessMessage("");
    };

    const handleClose = () => {
        if (loading) return;
        onClose?.();
    };

    const handleAuthSuccess = (data) => {
        const token = data?.token;
        const user = data?.user || {
            email: data?.email,
            fullName: data?.fullName,
            subscription: data?.subscription,
        };

        if (!token) {
            throw new Error(data?.message || "Login failed. Token missing.");
        }

        saveAuth(token, user);

        onLoginSuccess?.(user);
        onClose?.();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        resetMessages();

        if (!email.trim()) {
            setMessage("Email is required.");
            return;
        }

        if (mode !== "forgot" && !password.trim()) {
            setMessage("Password is required.");
            return;
        }

        if (mode === "register" && !fullName.trim()) {
            setMessage("Full name is required.");
            return;
        }

        setLoading(true);

        try {
            if (mode === "login") {
                const data = await login({
                    email: email.trim(),
                    password,
                });

                handleAuthSuccess(data);
                return;
            }

            if (mode === "register") {
                const data = await register({
                    fullName: fullName.trim(),
                    email: email.trim(),
                    password,
                });

                if (data?.token) {
                    handleAuthSuccess(data);
                    return;
                }

                setSuccessMessage(
                    data?.message ||
                    "Registration successful. Please verify your email before login."
                );
                setMode("login");
                return;
            }

            if (mode === "forgot") {
                const data = await forgotPassword({
                    email: email.trim(),
                });

                setSuccessMessage(
                    data?.message ||
                    "Password reset link/code sent to your email."
                );
                setMode("login");
            }
        } catch (err) {
            setMessage(err?.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        resetMessages();

        const credential = credentialResponse?.credential;

        if (!credential) {
            setMessage("Google login credential missing.");
            return;
        }

        setLoading(true);

        try {
            const data = await googleLogin(credential);
            handleAuthSuccess(data);
        } catch (err) {
            setMessage(err?.message || "Google login failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setMessage("Google login failed. Please try again.");
    };

    const handleResendVerification = async () => {
        resetMessages();

        if (!email.trim()) {
            setMessage("Enter your email first.");
            return;
        }

        setLoading(true);

        try {
            const data = await resendVerification({
                email: email.trim(),
            });

            setSuccessMessage(data?.message || "Verification email sent again.");
        } catch (err) {
            setMessage(err?.message || "Unable to resend verification email.");
        } finally {
            setLoading(false);
        }
    };

    const title =
        mode === "login"
            ? "Login to SketchyDraw"
            : mode === "register"
                ? "Create your SketchyDraw account"
                : "Reset your password";

    const subtitle =
        mode === "login"
            ? "Save drawings, open your library, and unlock Pro features."
            : mode === "register"
                ? "Create an account to save and manage your drawings."
                : "Enter your email and we will send reset instructions.";

    return (
        <div className="sketchy-login-backdrop" onMouseDown={handleClose}>
            <div
                className="sketchy-login-modal"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button
                    className="sketchy-login-close"
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                >
                    ×
                </button>

                <div className="sketchy-login-header">
                    <div className="sketchy-login-logo">S</div>

                    <div>
                        <span>SketchyDraw</span>
                        <h2>{title}</h2>
                        <p>{subtitle}</p>
                    </div>
                </div>

                {mode !== "forgot" && (
                    <>
                        <div className="google-login-wrap">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                                theme="outline"
                                size="large"
                                text="continue_with"
                                shape="pill"
                                width="330"
                            />
                        </div>

                        <div className="login-divider">
                            <span>or continue with email</span>
                        </div>
                    </>
                )}

                <form className="sketchy-login-form" onSubmit={handleSubmit}>
                    {mode === "register" && (
                        <label>
                            <span>Full name</span>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Ranuj Mahajan"
                                autoComplete="name"
                            />
                        </label>
                    )}

                    <label>
                        <span>Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                        />
                    </label>

                    {mode !== "forgot" && (
                        <label>
                            <span>Password</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                autoComplete={
                                    mode === "login"
                                        ? "current-password"
                                        : "new-password"
                                }
                            />
                        </label>
                    )}

                    {message && (
                        <div className="sketchy-login-message error">
                            {message}
                        </div>
                    )}

                    {successMessage && (
                        <div className="sketchy-login-message success">
                            {successMessage}
                        </div>
                    )}

                    <button
                        className="sketchy-login-primary"
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? "Please wait..."
                            : mode === "login"
                                ? "Login"
                                : mode === "register"
                                    ? "Create Account"
                                    : "Send Reset Link"}
                    </button>
                </form>

                <div className="sketchy-login-footer">
                    {mode === "login" && (
                        <>
                            <button
                                type="button"
                                onClick={() => setMode("register")}
                                disabled={loading}
                            >
                                Create account
                            </button>

                            <span>•</span>

                            <button
                                type="button"
                                onClick={() => setMode("forgot")}
                                disabled={loading}
                            >
                                Forgot password?
                            </button>
                        </>
                    )}

                    {mode === "register" && (
                        <>
                            <button
                                type="button"
                                onClick={() => setMode("login")}
                                disabled={loading}
                            >
                                Already have an account? Login
                            </button>
                        </>
                    )}

                    {mode === "forgot" && (
                        <>
                            <button
                                type="button"
                                onClick={() => setMode("login")}
                                disabled={loading}
                            >
                                Back to login
                            </button>
                        </>
                    )}
                </div>

                {mode === "login" && (
                    <button
                        className="resend-verification-btn"
                        type="button"
                        onClick={handleResendVerification}
                        disabled={loading}
                    >
                        Resend verification email
                    </button>
                )}
            </div>
        </div>
    );
}