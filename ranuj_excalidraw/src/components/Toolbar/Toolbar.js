import React, { useEffect, useRef, useState } from "react";
import "./Toolbar.css";
import { getUser, isLoggedIn, logout } from "../../utils/auth";
import SketchyLoginModal from "../SketchyLoginModal/SketchyLoginModal";
import SubscriptionPopup from "../SubscriptionPopup/SubscriptionPopup";
import { getActiveAnnouncement } from "../../api/announcementApi";

export default function Toolbar({
                                    undo,
                                    redo,
                                    clearCanvas,
                                    canUndo,
                                    canRedo,
                                    showGrid,
                                    setShowGrid,
                                    onExport,
                                    openJsonPicker,
                                }) {
    const [loginOpen, setLoginOpen] = useState(false);
    const [subscriptionOpen, setSubscriptionOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [alignOpen, setAlignOpen] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [legalOpen, setLegalOpen] = useState(false);

    const [user, setUser] = useState(getUser());
    const [loggedIn, setLoggedIn] = useState(isLoggedIn());
    const [announcement, setAnnouncement] = useState("");

    const profileRef = useRef(null);
    const alignRef = useRef(null);
    const saveRef = useRef(null);
    const legalRef = useRef(null);

    useEffect(() => {
        refreshAuthState();
    }, [loginOpen]);

    useEffect(() => {
        loadAnnouncement();

        const intervalId = setInterval(() => {
            loadAnnouncement();
        }, 3 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }

            if (alignRef.current && !alignRef.current.contains(e.target)) {
                setAlignOpen(false);
            }

            if (saveRef.current && !saveRef.current.contains(e.target)) {
                setSaveOpen(false);
            }

            if (legalRef.current && !legalRef.current.contains(e.target)) {
                setLegalOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const openSubscription = () => {
            setSubscriptionOpen(true);
            setProfileOpen(false);
            setSaveOpen(false);
            setLegalOpen(false);
        };

        const openLogin = () => {
            setLoginOpen(true);
            setProfileOpen(false);
            setSaveOpen(false);
            setLegalOpen(false);
        };

        window.addEventListener("sketchydraw:open-subscription", openSubscription);
        window.addEventListener("sketchydraw:open-login", openLogin);

        return () => {
            window.removeEventListener("sketchydraw:open-subscription", openSubscription);
            window.removeEventListener("sketchydraw:open-login", openLogin);
        };
    }, []);

    const refreshAuthState = () => {
        setUser(getUser());
        setLoggedIn(isLoggedIn());
    };

    const loadAnnouncement = async () => {
        try {
            const data = await getActiveAnnouncement();

            if (data?.enabled && data?.message) {
                setAnnouncement(data.message);
            } else {
                setAnnouncement("");
            }
        } catch {
            setAnnouncement("");
        }
    };

    const handleLogout = () => {
        logout();
        setUser(null);
        setLoggedIn(false);
        setProfileOpen(false);
    };

    const goToLegalPage = (path) => {
        window.location.href = path;
    };

    const triggerSaveExisting = () => {
        window.dispatchEvent(
            new CustomEvent("sketchydraw:save-drawing", {
                detail: { saveAsNew: false },
            })
        );

        setSaveOpen(false);
    };

    const triggerSaveAsNew = () => {
        window.dispatchEvent(
            new CustomEvent("sketchydraw:save-drawing", {
                detail: { saveAsNew: true },
            })
        );

        setSaveOpen(false);
    };

    const triggerMyDrawings = () => {
        window.dispatchEvent(new Event("sketchydraw:open-my-drawings"));
        setProfileOpen(false);
    };

    const triggerAlign = (type) => {
        window.dispatchEvent(
            new CustomEvent("sketchydraw:align-selected", {
                detail: { type },
            })
        );

        setAlignOpen(false);
    };

    return (
        <>
            <div className="legal-floating-menu-wrap" ref={legalRef}>
                <button
                    type="button"
                    className="legal-floating-burger"
                    onClick={() => setLegalOpen((v) => !v)}
                    title="Menu"
                >
                    ☰
                </button>

                {legalOpen && (
                    <div className="legal-floating-menu">
                        <div className="legal-menu-brand">
                            <strong>SketchyDraw</strong>
                            <span>Legal & support</span>
                        </div>

                        <button type="button" onClick={() => goToLegalPage("/terms")}>
                            Terms and Conditions
                        </button>

                        <button type="button" onClick={() => goToLegalPage("/privacy-policy")}>
                            Privacy Policy
                        </button>

                        <button type="button" onClick={() => goToLegalPage("/refund-policy")}>
                            Refund Policy
                        </button>

                        <button type="button" onClick={() => goToLegalPage("/cancellation-policy")}>
                            Cancellation Policy
                        </button>

                        <button type="button" onClick={() => goToLegalPage("/delivery-policy")}>
                            Delivery Policy
                        </button>

                        <button type="button" onClick={() => goToLegalPage("/contact-us")}>
                            Contact Us
                        </button>
                    </div>
                )}
            </div>

            <div className="topbar">
                <div className="topbar-actions">
                    <button type="button" onClick={undo} disabled={!canUndo}>
                        Undo
                    </button>

                    <button type="button" onClick={redo} disabled={!canRedo}>
                        Redo
                    </button>

                    <button type="button" onClick={clearCanvas} className="danger">
                        Clear
                    </button>

                    <button
                        type="button"
                        className="toolbar-dark-action"
                        onClick={onExport}
                    >
                        Export
                    </button>

                    <button
                        type="button"
                        className="toolbar-dark-action"
                        onClick={openJsonPicker}
                    >
                        Open JSON
                    </button>

                    <span className="topbar-separator" />

                    <div className="save-menu-wrap" ref={saveRef}>
                        <button
                            type="button"
                            className="toolbar-primary-action save-trigger-btn"
                            onClick={() => setSaveOpen((v) => !v)}
                        >
                            Save
                            <span>⌄</span>
                        </button>

                        {saveOpen && (
                            <div className="save-dropdown">
                                <button type="button" onClick={triggerSaveExisting}>
                                    💾 Save Existing
                                </button>

                                <button type="button" onClick={triggerSaveAsNew}>
                                    🆕 Save As New
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        className="toolbar-dark-action"
                        onClick={triggerMyDrawings}
                    >
                        My Drawings
                    </button>

                    <div className="align-menu-wrap" ref={alignRef}>
                        <button
                            type="button"
                            className="toolbar-align-trigger"
                            onClick={() => setAlignOpen((v) => !v)}
                        >
                            Align
                            <span>⌄</span>
                        </button>

                        {alignOpen && (
                            <div className="align-dropdown">
                                <button type="button" onClick={() => triggerAlign("left")}>
                                    Align Left
                                </button>

                                <button type="button" onClick={() => triggerAlign("center")}>
                                    Align Center
                                </button>

                                <button type="button" onClick={() => triggerAlign("right")}>
                                    Align Right
                                </button>

                                <div className="align-divider" />

                                <button type="button" onClick={() => triggerAlign("top")}>
                                    Align Top
                                </button>

                                <button type="button" onClick={() => triggerAlign("middle")}>
                                    Align Middle
                                </button>

                                <button type="button" onClick={() => triggerAlign("bottom")}>
                                    Align Bottom
                                </button>
                            </div>
                        )}
                    </div>

                    <label className="grid-toggle-btn">
                        <input
                            type="checkbox"
                            checked={!!showGrid}
                            onChange={(e) => setShowGrid?.(e.target.checked)}
                        />
                        <span>Gridlines</span>
                    </label>
                </div>

                <div className="topbar-title">

                </div>

                <div className="topbar-auth">
                    {!loggedIn ? (
                        <>
                            <button
                                type="button"
                                className="login-btn"
                                onClick={() => setLoginOpen(true)}
                            >
                                Login
                            </button>

                            <button
                                type="button"
                                className="login-btn"
                                onClick={() => setSubscriptionOpen(true)}
                            >
                                Subscribe
                            </button>
                        </>
                    ) : (
                        <div className="profile-menu-wrap" ref={profileRef}>
                            <button
                                type="button"
                                className="profile-trigger"
                                onClick={() => setProfileOpen((v) => !v)}
                            >
                                <span className="profile-avatar">
                                    {(user?.fullName || user?.email || "U")
                                        .charAt(0)
                                        .toUpperCase()}
                                </span>

                                <span className="profile-email">
                                    {user?.email || user?.fullName || "My Account"}
                                </span>

                                <span className="profile-caret">⌄</span>
                            </button>

                            {profileOpen && (
                                <div className="profile-dropdown">
                                    <div className="profile-signed-box">
                                        <span>SIGNED IN AS</span>
                                        <strong>
                                            {user?.email || user?.fullName || "User"}
                                        </strong>
                                    </div>

                                    <button type="button" className="profile-menu-item">
                                        👤 My Profile
                                    </button>

                                    <button
                                        type="button"
                                        className="profile-menu-item"
                                        onClick={triggerMyDrawings}
                                    >
                                        🖼️ My Drawings
                                    </button>

                                    <button type="button" className="profile-menu-item">
                                        🧾 Payment History
                                    </button>

                                    <button
                                        type="button"
                                        className="profile-menu-item"
                                        onClick={() => {
                                            setProfileOpen(false);
                                            setSubscriptionOpen(true);
                                        }}
                                    >
                                        ⭐ Subscribe / Buy Credits
                                    </button>

                                    <div className="profile-menu-divider" />

                                    <button
                                        type="button"
                                        className="profile-menu-item logout-menu-item"
                                        onClick={handleLogout}
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <SketchyLoginModal
                open={loginOpen}
                onClose={() => {
                    setLoginOpen(false);
                    refreshAuthState();
                }}
                onLoginSuccess={(u) => {
                    setUser(u);
                    setLoggedIn(true);
                    setLoginOpen(false);
                }}
            />

            <SubscriptionPopup
                open={subscriptionOpen}
                onClose={() => setSubscriptionOpen(false)}
                onLoginRequired={() => {
                    setSubscriptionOpen(false);
                    setLoginOpen(true);
                }}
            />
        </>
    );
}