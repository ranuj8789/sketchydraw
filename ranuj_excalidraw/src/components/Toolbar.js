import React, { useEffect, useState } from "react";
import { getUser, isLoggedIn, logout, getToken } from "../utils/auth";
import SketchyLoginModal from "./SketchyLoginModal/SketchyLoginModal";
import SubscriptionPopup from "./SubscriptionPopup/SubscriptionPopup";
import { getActiveAnnouncement } from "../api/announcementApi";

export default function Toolbar({ undo, redo, clearCanvas, canUndo, canRedo }) {
    const [loginOpen, setLoginOpen] = useState(false);
    const [subscriptionOpen, setSubscriptionOpen] = useState(false);
    const [user, setUser] = useState(getUser());
    const [loggedIn, setLoggedIn] = useState(isLoggedIn());
    const [token, setToken] = useState(getToken());
    const [announcement, setAnnouncement] = useState("");

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

    const refreshAuthState = () => {
        setUser(getUser());
        setLoggedIn(isLoggedIn());
        setToken(getToken());
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
        setToken(null);
    };

    return (
        <>
            <div className="announcement-strip">
        <span>
          {announcement || "Simple online whiteboard for sketches and diagrams"}
        </span>
            </div>

            <div className="topbar">
                <div className="topbar-left">
                    <div>
                        <h1>Sketchydraw</h1>
                        <p></p>
                    </div>

                    {!loggedIn ? (
                        <button
                            type="button"
                            className="login-btn"
                            onClick={() => setLoginOpen(true)}
                        >
                            Login
                        </button>
                    ) : (
                        <div className="toolbar-user-box">
                            <div className="toolbar-avatar">
                                {(user?.fullName || user?.email || "U")
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>

                            <div className="toolbar-user-meta">
                                <strong>{user?.fullName || "User"}</strong>
                                <span>{user?.email}</span>
                            </div>

                            <button
                                type="button"
                                className="logout-btn"
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        className="login-btn"
                        onClick={() => setSubscriptionOpen(true)}
                    >
                        Subscribe
                    </button>
                </div>

                <div className="topbar-actions">
                    <button onClick={undo} disabled={!canUndo}>
                        Undo
                    </button>

                    <button onClick={redo} disabled={!canRedo}>
                        Redo
                    </button>

                    <button onClick={clearCanvas} className="danger">
                        Clear
                    </button>
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
                    setToken(getToken());
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