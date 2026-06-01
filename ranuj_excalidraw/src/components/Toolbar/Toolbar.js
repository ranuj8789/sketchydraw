import React, { useEffect, useRef, useState } from "react";
import "./Toolbar.css";

import {
    getUser,
    isLoggedIn,
    logout,
    isProUser,
    mergeSubscriptionIntoUser,
    updateLocalUserProfile,
} from "../../utils/auth";

import SketchyLoginModal from "../SketchyLoginModal/SketchyLoginModal";
import SubscriptionPopup from "../SubscriptionPopup/SubscriptionPopup";

import { getActiveAnnouncement } from "../../api/announcementApi";
import { getSubscriptionStatus, getPaymentHistory } from "../../api/paymentApi";
import { getMyProfile, updateMyProfile } from "../../api/authApi";

export default function Toolbar({
                                    undo,
                                    redo,
                                    clearCanvas,
                                    canUndo,
                                    canRedo,
                                    showGrid,
                                    setShowGrid,
                                    canvasProps,
                                    updateCanvasProps,
                                    exportPNG,
                                    exportJPEG,
                                    exportSVG,
                                    exportPDF,
                                    printCanvas,
                                    exportJSON,
                                    openJsonPicker,
                                    drawingTitle,
                                    onDrawingTitleChange,
                                }) {
    const [loginOpen, setLoginOpen] = useState(false);
    const [subscriptionOpen, setSubscriptionOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [alignOpen, setAlignOpen] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [gridOpen, setGridOpen] = useState(false);
    const [videoGapSeconds, setVideoGapSeconds] = useState("0.5");
    const [legalOpen, setLegalOpen] = useState(false);

    const [user, setUser] = useState(getUser());
    const [loggedIn, setLoggedIn] = useState(isLoggedIn());
    const [announcement, setAnnouncement] = useState("");

    const [subscriptionStatus, setSubscriptionStatus] = useState(null);

    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);

    const [paymentRows, setPaymentRows] = useState([]);
    const [paymentLoading, setPaymentLoading] = useState(false);

    const [profileName, setProfileName] = useState(getUser()?.fullName || "");
    const [profileMessage, setProfileMessage] = useState("");

    const proUser = isProUser(user);

    const profileRef = useRef(null);
    const alignRef = useRef(null);
    const saveRef = useRef(null);
    const exportRef = useRef(null);
    const gridRef = useRef(null);
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
        if (!loggedIn) {
            setSubscriptionStatus(null);
            return;
        }

        refreshSubscriptionStatus();

        const onUpdated = () => refreshSubscriptionStatus();
        window.addEventListener("sketchydraw:subscription-updated", onUpdated);

        return () => {
            window.removeEventListener("sketchydraw:subscription-updated", onUpdated);
        };
    }, [loggedIn]);

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

            if (exportRef.current && !exportRef.current.contains(e.target)) {
                setExportOpen(false);
            }

            if (gridRef.current && !gridRef.current.contains(e.target)) {
                setGridOpen(false);
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
            setExportOpen(false);
            setGridOpen(false);
            setLegalOpen(false);
        };

        const openLogin = () => {
            setLoginOpen(true);
            setProfileOpen(false);
            setSaveOpen(false);
            setExportOpen(false);
            setGridOpen(false);
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
        const nextUser = getUser();

        setUser(nextUser);
        setLoggedIn(isLoggedIn());
        setProfileName(nextUser?.fullName || "");
    };

    const refreshSubscriptionStatus = async () => {
        if (!isLoggedIn()) return null;

        try {
            const status = await getSubscriptionStatus();
            const updatedUser = mergeSubscriptionIntoUser(status);

            setSubscriptionStatus(status);

            if (updatedUser) {
                setUser(updatedUser);
                setProfileName(updatedUser.fullName || "");
            }

            return status;
        } catch (error) {
            console.error("Unable to load subscription status", error);
            return null;
        }
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

    const openProfileModal = async () => {
        setProfileOpen(false);
        setProfileMessage("");
        setProfileModalOpen(true);

        try {
            const data = await getMyProfile();
            const updated = updateLocalUserProfile(data);

            setUser(updated);
            setProfileName(updated?.fullName || "");
        } catch (error) {
            console.error("Unable to load profile", error);
        }
    };

    const saveProfileName = async (event) => {
        event.preventDefault();
        setProfileMessage("Saving profile...");

        try {
            const data = await updateMyProfile({
                fullName: profileName,
            });

            const updated = updateLocalUserProfile(data);

            setUser(updated);
            setProfileName(updated?.fullName || "");
            setProfileMessage("Profile updated successfully.");
        } catch (error) {
            setProfileMessage(error?.message || "Unable to update profile.");
        }
    };

    const openPaymentHistory = async () => {
        setProfileOpen(false);
        setPaymentsModalOpen(true);
        setPaymentLoading(true);

        try {
            const rows = await getPaymentHistory();

            const allRows = Array.isArray(rows)
                ? rows
                : rows?.data || rows?.payments || rows?.content || [];

            const successRows = allRows.filter(
                (row) => String(row.status || "").toUpperCase() === "SUCCESS"
            );

            setPaymentRows(successRows);
        } catch (error) {
            console.error("Unable to load payment history", error);
            setPaymentRows([]);
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        setUser(null);
        setLoggedIn(false);
        setSubscriptionStatus(null);
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

    const runExport = (fn) => {
        fn?.();
        setExportOpen(false);
    };

    const runVideoExport = () => {
        const gapSeconds = Math.max(
            0.1,
            Math.min(5, Number(videoGapSeconds) || 0.5)
        );

        window.dispatchEvent(
            new CustomEvent("sketchydraw:export-video", {
                detail: { gapSeconds },
            })
        );

        setExportOpen(false);
    };

    const applyCanvasPattern = (pattern) => {
        updateCanvasProps?.({
            pattern,
        });

        // Keep old showGrid state in sync, but canvasProps.pattern is the source of truth.
        setShowGrid?.(pattern === "grid" || pattern === "notebook");
        setGridOpen(false);
    };

    const activePattern = canvasProps?.pattern || (showGrid ? "grid" : "blank");

    const currentGridLabel =
        activePattern === "notebook"
            ? "Notebook"
            : activePattern === "dots"
                ? "Dot Grid"
                : activePattern === "blocks"
                    ? "Blocks"
                    : activePattern === "grid"
                        ? "Grid Lines"
                        : "Blank";

    const getExpiryDate = () => {
        return (
            user?.subscription?.endsAt ||
            subscriptionStatus?.endsAt ||
            subscriptionStatus?.endDate ||
            subscriptionStatus?.validTill ||
            null
        );
    };

    const expiryDate = getExpiryDate();

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
                    <button type="button" onClick={undo} disabled={!canUndo} title="Undo last action">
                        Undo
                    </button>

                    <button type="button" onClick={redo} disabled={!canRedo} title="Redo last action">
                        Redo
                    </button>

                    <button type="button" onClick={clearCanvas} className="danger" title="Clear current canvas">
                        Clear
                    </button>

                    <span className="topbar-separator" />

                    <div className="save-menu-wrap" title="Save this drawing" ref={saveRef}>
                        <button
                            type="button"
                            className="toolbar-primary-action save-trigger-btn"
                            onClick={() => setSaveOpen((v) => !v)}
                            title="Save this drawing"
                        >
                            Save as <span title="Save this drawing">⌄</span>
                        </button>

                        {saveOpen && (
                            <div className="save-dropdown">
                                <button type="button" onClick={triggerSaveExisting}>
                                    💾 Save Current
                                </button>

                                <button type="button" onClick={triggerSaveAsNew}>
                                    🆕 Save as New
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        window.dispatchEvent(new Event("sketchydraw:open-my-drawings"));
                                        setSaveOpen(false);
                                    }}
                                >
                                    📂 View Saved Drawings
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        className="toolbar-dark-action"
                        onClick={openJsonPicker}
                        title="Import a SketchyDraw JSON file"
                    >
                        Import json
                    </button>

                    <div className="export-menu-wrap" ref={exportRef}>
                        <button
                            type="button"
                            className="toolbar-dark-action export-trigger-btn"
                            onClick={() => setExportOpen((v) => !v)}
                            title="Export this drawing"
                        >
                            Export as <span>⌄</span>
                        </button>

                        {exportOpen && (
                            <div className="export-dropdown">
                                <button type="button" onClick={() => runExport(exportPNG)}>
                                    🖼️ Export as PNG
                                </button>

                                <button type="button" onClick={() => runExport(exportJPEG)}>
                                    🖼️ Export as JPEG
                                </button>

                                <button type="button" onClick={() => runExport(exportSVG)}>
                                    🧩 Export as SVG
                                </button>

                                <button type="button" onClick={() => runExport(exportPDF)}>
                                    📕 Export as PDF
                                </button>

                                <button type="button" onClick={() => runExport(printCanvas)}>
                                    🖨️ Print Canvas
                                </button>

                                <button type="button" onClick={() => runExport(exportJSON)}>
                                    📄 Export as JSON
                                </button>

                                {/*<div className="export-video-box">*/}
                                {/*    <label>*/}
                                {/*        Gap seconds*/}
                                {/*        <input*/}
                                {/*            type="number"*/}
                                {/*            min="0.1"*/}
                                {/*            max="5"*/}
                                {/*            step="0.1"*/}
                                {/*            value={videoGapSeconds}*/}
                                {/*            onChange={(event) => setVideoGapSeconds(event.target.value)}*/}
                                {/*        />*/}
                                {/*    </label>*/}

                                {/*    <button type="button" onClick={runVideoExport}>*/}
                                {/*        🎬 Export Video*/}
                                {/*    </button>*/}
                                {/*</div>*/}
                            </div>
                        )}
                    </div>

                    <div className="align-menu-wrap" ref={alignRef}>
                        <button
                            type="button"
                            className="toolbar-align-trigger"
                            onClick={() => setAlignOpen((v) => !v)}
                        >
                            Align <span>⌄</span>
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

                    <div className="grid-menu-wrap" ref={gridRef}>
                        <button
                            type="button"
                            className="toolbar-dark-action grid-trigger-btn"
                            onClick={() => setGridOpen((v) => !v)}
                            title="Canvas grid style"
                        >
                            Grid <span>{currentGridLabel} ⌄</span>
                        </button>

                        {gridOpen && (
                            <div className="grid-dropdown">
                                <button type="button" onClick={() => applyCanvasPattern("blank")}>
                                    ⬜ Blank
                                </button>

                                <button type="button" onClick={() => applyCanvasPattern("grid")}>
                                    #️⃣ Grid Lines
                                </button>

                                <button type="button" onClick={() => applyCanvasPattern("notebook")}>
                                    📓 Notebook Lines
                                </button>

                                <button type="button" onClick={() => applyCanvasPattern("dots")}>
                                    ⠿ Dot Grid
                                </button>

                                <button type="button" onClick={() => applyCanvasPattern("blocks")}>
                                    ▦ Blocks
                                </button>
                            </div>
                        )}
                    </div>

                    {announcement && (
                        <div className="topbar-announcement" title={announcement}>
                            {announcement}
                        </div>
                    )}
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
                                    {(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
                                </span>

                                <span className="profile-email">
                                    {user?.email || user?.fullName || "My Account"}
                                </span>

                                <span className={proUser ? "topbar-pro-pill" : "topbar-free-pill"}>
                                    {proUser ? "PRO" : "FREE"}
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

                                        <div className={proUser ? "profile-plan-badge pro" : "profile-plan-badge free"}>
                                            {proUser ? "⭐ PRO ACTIVE" : "FREE PLAN"}
                                        </div>

                                        {proUser && expiryDate && (
                                            <small className="profile-plan-expiry">
                                                Valid till {new Date(expiryDate).toLocaleDateString()}
                                            </small>
                                        )}

                                        {!proUser && (
                                            <small className="profile-plan-expiry">
                                                Free exports include SketchyDraw watermark.
                                            </small>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        className="profile-menu-item"
                                        onClick={openProfileModal}
                                    >
                                        👤 My Profile
                                    </button>

                                    <button
                                        type="button"
                                        className="profile-menu-item"
                                        onClick={triggerMyDrawings}
                                    >
                                        🖼️ My Drawings
                                    </button>

                                    <button
                                        type="button"
                                        className="profile-menu-item"
                                        onClick={openPaymentHistory}
                                    >
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
                                        {proUser ? "⭐ Manage Pro" : "⭐ Subscribe / Buy Credits"}
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

                    setTimeout(() => {
                        refreshSubscriptionStatus();
                    }, 0);
                }}
            />

            <ProfileModal
                open={profileModalOpen}
                user={user}
                proUser={proUser}
                subscriptionStatus={subscriptionStatus}
                profileName={profileName}
                profileMessage={profileMessage}
                setProfileName={setProfileName}
                onSubmit={saveProfileName}
                onClose={() => setProfileModalOpen(false)}
            />

            <PaymentHistoryModal
                open={paymentsModalOpen}
                rows={paymentRows}
                loading={paymentLoading}
                onClose={() => setPaymentsModalOpen(false)}
            />

            <SubscriptionPopup
                open={subscriptionOpen}
                onClose={() => {
                    setSubscriptionOpen(false);
                    refreshSubscriptionStatus();
                }}
                onLoginRequired={() => {
                    setSubscriptionOpen(false);
                    setLoginOpen(true);
                }}
            />
        </>
    );
}

function ProfileModal({
                          open,
                          user,
                          proUser,
                          subscriptionStatus,
                          profileName,
                          profileMessage,
                          setProfileName,
                          onSubmit,
                          onClose,
                      }) {
    if (!open) return null;

    const expiryDate =
        user?.subscription?.endsAt ||
        subscriptionStatus?.endsAt ||
        subscriptionStatus?.endDate ||
        subscriptionStatus?.validTill ||
        null;

    const openMyDrawingsFromProfile = () => {
        onClose?.();

        setTimeout(() => {
            window.dispatchEvent(new Event("sketchydraw:open-my-drawings"));
        }, 0);
    };

    return (
        <div className="account-modal-backdrop" onMouseDown={onClose}>
            <div className="account-modal" onMouseDown={(e) => e.stopPropagation()}>
                <button type="button" className="account-modal-close" onClick={onClose}>
                    ×
                </button>

                <div className="account-modal-header">
                    <span className={proUser ? "account-status-badge pro" : "account-status-badge free"}>
                        {proUser ? "⭐ SketchyDraw Pro" : "Free Plan"}
                    </span>

                    <h2>My Profile</h2>
                    <p>{user?.email}</p>
                </div>

                <div className="account-status-card">
                    <strong>
                        {proUser
                            ? "Your Pro subscription is active."
                            : "You are currently on the Free plan."}
                    </strong>

                    {proUser && expiryDate && (
                        <span>
                            Valid till {new Date(expiryDate).toLocaleString()}
                        </span>
                    )}

                    {!proUser && (
                        <span>Free exports include a SketchyDraw watermark.</span>
                    )}
                </div>

                <div className="account-profile-actions">
                    <button
                        type="button"
                        className="account-secondary-btn"
                        onClick={openMyDrawingsFromProfile}
                    >
                        🖼️ Open My Drawings
                    </button>
                </div>

                <form onSubmit={onSubmit} className="account-form">
                    <label>
                        <span>Name</span>
                        <input
                            value={profileName || ""}
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder="Enter your name"
                            minLength={2}
                            maxLength={120}
                            required
                        />
                    </label>

                    <label>
                        <span>Email</span>
                        <input value={user?.email || ""} disabled />
                    </label>

                    {profileMessage && (
                        <div className="account-modal-message">
                            {profileMessage}
                        </div>
                    )}

                    <button type="submit" className="account-primary-btn">
                        Save Profile
                    </button>
                </form>
            </div>
        </div>
    );
}

function PaymentHistoryModal({ open, rows, loading, onClose }) {
    if (!open) return null;

    return (
        <div className="account-modal-backdrop" onMouseDown={onClose}>
            <div
                className="account-modal account-modal-wide"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button type="button" className="account-modal-close" onClick={onClose}>
                    ×
                </button>

                <div className="account-modal-header">
                    <span className="account-status-badge pro">🧾 Billing</span>
                    <h2>Payment History</h2>
                    <p>All your SketchyDraw payment attempts and successful payments.</p>
                </div>

                {loading ? (
                    <div className="account-empty-state">Loading payment history...</div>
                ) : rows.length === 0 ? (
                    <div className="account-empty-state">No successful payments found yet.</div>
                ) : (
                    <div className="payment-history-table-wrap">
                        <table className="payment-history-table">
                            <thead>
                            <tr>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Order ID</th>
                            </tr>
                            </thead>

                            <tbody>
                            {rows.map((row, index) => (
                                <tr key={row.id || row.providerOrderId || row.orderId || index}>
                                    <td>
                                        {row.createdAt
                                            ? new Date(row.createdAt).toLocaleString()
                                            : row.created_at
                                                ? new Date(row.created_at).toLocaleString()
                                                : "-"}
                                    </td>

                                    <td>
                                        {row.currency || "INR"}{" "}
                                        {Number(row.amount || row.amountInRupees || 0).toLocaleString("en-IN")}
                                    </td>

                                    <td>
                                            <span className={`payment-status ${String(row.status || "").toLowerCase()}`}>
                                                {row.status || "-"}
                                            </span>
                                    </td>

                                    <td>
                                        {row.providerOrderId ||
                                            row.orderId ||
                                            row.razorpayOrderId ||
                                            "-"}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}