import React, { useEffect, useState } from "react";
import { getUser, isLoggedIn, logout } from "../../utils/auth";
import SketchyLoginModal from "../../components/SketchyLoginModal/SketchyLoginModal";
import "./SketchyHeader.css";

function SketchyHeader({
                           undo,
                           redo,
                           clearCanvas,
                           canUndo,
                           canRedo,
                           onOpenDrawings,
                           onOpenPayments,
                       }) {
    const [loginOpen, setLoginOpen] = useState(false);
    const [user, setUser] = useState(getUser());
    const [loggedIn, setLoggedIn] = useState(isLoggedIn());

    useEffect(() => {
        setUser(getUser());
        setLoggedIn(isLoggedIn());
    }, [loginOpen]);

    const handleLogout = () => {
        logout();
        setUser(null);
        setLoggedIn(false);
    };

    return (
        <>
            <header className="sk-header">
                <div className="sk-header-left">
                    <div className="sk-brand">
                        <h1>Sketchy</h1>
                        <p>Simple online whiteboard for sketches and diagrams</p>
                    </div>

                    {!loggedIn ? (
                        <button
                            type="button"
                            className="sk-login-btn"
                            onClick={() => setLoginOpen(true)}
                        >
                            Login
                        </button>
                    ) : (
                        <div className="sk-user-area">
                            <button className="sk-head-btn" onClick={onOpenDrawings}>
                                My Drawings
                            </button>

                            <button className="sk-head-btn" onClick={onOpenPayments}>
                                Payments
                            </button>

                            <div className="sk-user-box">
                                <div className="sk-avatar">
                                    {(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
                                </div>

                                <div className="sk-user-meta">
                                    <strong>{user?.fullName || "User"}</strong>
                                    <span>{user?.email}</span>
                                </div>

                                <button className="sk-logout-btn" onClick={handleLogout}>
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="sk-board-actions">
                    <button type="button" onClick={undo} disabled={!canUndo}>
                        Undo
                    </button>

                    <button type="button" onClick={redo} disabled={!canRedo}>
                        Redo
                    </button>

                    <button type="button" onClick={clearCanvas} className="danger">
                        Clear
                    </button>
                </div>
            </header>

            <SketchyLoginModal
                open={loginOpen}
                onClose={() => setLoginOpen(false)}
                onLoginSuccess={(u) => {
                    setUser(u);
                    setLoggedIn(true);
                    setLoginOpen(false);
                }}
            />
        </>
    );
}

export default SketchyHeader;