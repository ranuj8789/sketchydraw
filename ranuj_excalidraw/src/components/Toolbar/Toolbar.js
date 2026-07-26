import React, { useEffect, useRef, useState } from "react";
import "./Toolbar.css";
import { SOCIAL_MEDIA_PRESETS } from "../../utils/socialMediaPresets";

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
import {
    DEFAULT_NOTEBOOK_PAGE_COUNT,
    MAX_NOTEBOOK_PAGE_COUNT,
} from "../../canvas/notebook/notebookPageConstants";

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
                                    exportInstagram,
                                    exportJPEG,
                                    exportSVG,
                                    exportPDF,
                                    printCanvas,
                                    exportJSON,
                                    openJsonPicker,
                                    openImportPicker,
                                    createNewDrawing,
                                    drawingTitle,
                                    onDrawingTitleChange,
                                    timelineFrames = [],
                                    currentFrameIndex = 0,
                                    openFramesPanel,
                                    exportGIF,
                                    gifExporting = false,
                                    gifExportProgress = 0,
                                    socialCreatorPreset = null,
                                    setSocialCreatorPreset,
                                }) {
    const [loginOpen, setLoginOpen] = useState(false);
    const [subscriptionOpen, setSubscriptionOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [alignOpen, setAlignOpen] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [gridOpen, setGridOpen] = useState(false);
    const [videoGapSeconds, setVideoGapSeconds] = useState("2");
    const [videoPreAnimationDelaySeconds, setVideoPreAnimationDelaySeconds] = useState("10");
    const [videoFrameFrom, setVideoFrameFrom] = useState("1");
    const [videoFrameTo, setVideoFrameTo] = useState("1");
    const [videoExportMode, setVideoExportMode] = useState(() => localStorage.getItem("sketchydraw.videoExportMode") || "server");
    const [videoExportState, setVideoExportState] = useState({ exporting: false, progress: 0, status: "" });
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
    const importRef = useRef(null);
    const gridRef = useRef(null);
    const legalRef = useRef(null);

    useEffect(() => {
        const totalFrames = Math.max(1, timelineFrames.length || 1);
        setVideoFrameFrom((current) => {
            const parsed = Number.parseInt(current, 10);
            return String(Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), totalFrames) : 1);
        });
        setVideoFrameTo((current) => {
            const parsed = Number.parseInt(current, 10);
            if (!Number.isFinite(parsed) || parsed <= 1) return String(totalFrames);
            return String(Math.min(Math.max(parsed, 1), totalFrames));
        });
    }, [timelineFrames.length]);

    useEffect(() => {
        const handleVideoExportState = (event) => {
            setVideoExportState(event.detail || { exporting: false, progress: 0, status: "" });
        };
        window.addEventListener("sketchydraw:video-export-state", handleVideoExportState);
        return () => window.removeEventListener("sketchydraw:video-export-state", handleVideoExportState);
    }, []);

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

            if (importRef.current && !importRef.current.contains(e.target)) {
                setImportOpen(false);
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
            setImportOpen(false);
            setGridOpen(false);
            setLegalOpen(false);
        };

        const openLogin = () => {
            setLoginOpen(true);
            setProfileOpen(false);
            setSaveOpen(false);
            setExportOpen(false);
            setImportOpen(false);
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
        if (videoExportState.exporting) {
            alert(`Video export is already running: ${videoExportState.status || "Please wait"}`);
            return;
        }

        const totalFrames = timelineFrames.length;
        if (!totalFrames) {
            alert("There are no timeline frames to export.");
            return;
        }

        const requestedFrom = Number.parseInt(videoFrameFrom, 10);
        const requestedTo = Number.parseInt(videoFrameTo, 10);
        const frameFrom = Math.min(Math.max(Number.isFinite(requestedFrom) ? requestedFrom : 1, 1), totalFrames);
        const frameTo = Math.min(Math.max(Number.isFinite(requestedTo) ? requestedTo : totalFrames, 1), totalFrames);

        if (frameFrom > frameTo) {
            alert(`Start frame (${frameFrom}) cannot be after end frame (${frameTo}).`);
            return;
        }

        const requestedGapSeconds = Number(videoGapSeconds);
        const gapSeconds = Math.max(
            0,
            Math.min(120, Number.isFinite(requestedGapSeconds) ? requestedGapSeconds : 2)
        );
        const requestedPreAnimationDelaySeconds = Number(videoPreAnimationDelaySeconds);
        const preAnimationDelaySeconds = Math.max(
            0,
            Math.min(120, Number.isFinite(requestedPreAnimationDelaySeconds)
                ? requestedPreAnimationDelaySeconds
                : 10)
        );
        const selectedFrames = timelineFrames.slice(frameFrom - 1, frameTo);
        const paddedFrom = String(frameFrom).padStart(2, "0");
        const paddedTo = String(frameTo).padStart(2, "0");

        window.dispatchEvent(
            new CustomEvent("sketchydraw:export-video", {
                detail: {
                    gapSeconds,
                    preAnimationDelaySeconds,
                    timelineFrames: JSON.parse(JSON.stringify(selectedFrames)),
                    mode: videoExportMode,
                    frameFrom,
                    frameTo,
                    totalFrames,
                    fileName: `sketchydraw-frames-${paddedFrom}-${paddedTo}.${videoExportMode === "server" ? "mp4" : "webm"}`,
                },
            })
        );

        setExportOpen(false);
    };

    const applyCanvasPattern = (pattern) => {
        if (pattern === "notebook") {
            updateCanvasProps?.({
                pattern: "notebook",
                pageMode: true,
                pageCount: canvasProps?.pageCount || DEFAULT_NOTEBOOK_PAGE_COUNT,
            });

            setShowGrid?.(false);
            setGridOpen(false);
            return;
        }

        updateCanvasProps?.({
            pattern,
            pageMode: false,
        });

        setShowGrid?.(pattern === "grid");
        setGridOpen(false);
    };
    const addNotebookPage = () => {
        const currentPageCount = Number(
            canvasProps?.pageCount || DEFAULT_NOTEBOOK_PAGE_COUNT
        );

        const nextPageCount = Math.min(
            MAX_NOTEBOOK_PAGE_COUNT,
            Math.max(DEFAULT_NOTEBOOK_PAGE_COUNT, currentPageCount + 1)
        );

        updateCanvasProps?.({
            pattern: "notebook",
            pageMode: true,
            pageCount: nextPageCount,
            pageViewMode: "single",
            currentPageIndex: nextPageCount - 1,
        });

        setShowGrid?.(false);

        window.dispatchEvent(
            new CustomEvent("sketchydraw:notebook-page-added", {
                detail: {
                    pageIndex: nextPageCount - 1,
                },
            })
        );
    };

    const removeNotebookPage = () => {
        const currentPageCount = Number(
            canvasProps?.pageCount || DEFAULT_NOTEBOOK_PAGE_COUNT
        );
        const nextPageCount = Math.max(
            DEFAULT_NOTEBOOK_PAGE_COUNT,
            currentPageCount - 1
        );
        const currentPageIndex = Math.max(
            0,
            Math.min(
                nextPageCount - 1,
                Number(canvasProps?.currentPageIndex || 0)
            )
        );

        updateCanvasProps?.({
            pattern: "notebook",
            pageMode: true,
            pageCount: nextPageCount,
            currentPageIndex,
        });

        setShowGrid?.(false);

        window.dispatchEvent(
            new CustomEvent("sketchydraw:notebook-page-focus", {
                detail: {
                    pageIndex: currentPageIndex,
                    direction: "prev",
                    zoom: 1,
                },
            })
        );
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

                    <span className="history-stack-counter">
                        <span>Frame {Math.min(currentFrameIndex + 1, timelineFrames.length || 1)}/{timelineFrames.length || 1}</span>
                        <span>Undo {canUndo ? "on" : "off"}</span>
                    </span>

                    <button
                        type="button"
                        className="frames-toolbar-btn"
                        onClick={openFramesPanel}
                        title="Open frames timeline"
                    >
                        Frames
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
                                <button
                                    type="button"
                                    onClick={() => {
                                        createNewDrawing?.();
                                        setSaveOpen(false);
                                    }}
                                >
                                    ✨ New Drawing
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerSaveExisting?.();
                                        setSaveOpen(false);
                                    }}
                                >
                                    💾 Save
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerSaveAsNew?.();
                                        setSaveOpen(false);
                                    }}
                                >
                                    🆕 Save As
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

                    <div className="export-menu-wrap" ref={importRef}>
                        <button
                            type="button"
                            className="toolbar-dark-action export-trigger-btn"
                            onClick={() => setImportOpen((value) => !value)}
                            title="Import JSON, PowerPoint, or Excel"
                        >
                            Import <span>⌄</span>
                        </button>

                        {importOpen && (
                            <div className="export-dropdown">
                                <button type="button" onClick={() => { (openImportPicker || openJsonPicker)?.("json"); setImportOpen(false); }}>
                                    📄 Import JSON
                                </button>
                                <button type="button" onClick={() => { openImportPicker?.("ppt"); setImportOpen(false); }}>
                                    📊 Import PowerPoint
                                </button>
                                <button type="button" onClick={() => { openImportPicker?.("excel"); setImportOpen(false); }}>
                                    📈 Import Excel / CSV
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="social-creator-control">
                        <span className="social-creator-label">Creator canvas</span>
                        <select
                            value={socialCreatorPreset || ""}
                            onChange={(event) => setSocialCreatorPreset?.(event.target.value || null)}
                            title="Show Instagram or WhatsApp composition guides"
                        >
                            <option value="">Off / Free canvas</option>
                            {Object.values(SOCIAL_MEDIA_PRESETS).map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.shortLabel} · {preset.width}×{preset.height}
                                </option>
                            ))}
                        </select>
                    </div>

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

                                <button type="button" onClick={() => runExport(() => exportInstagram?.("portrait"))}>
                                    📱 Instagram Portrait (1080×1350)
                                </button>

                                <button type="button" onClick={() => runExport(() => exportInstagram?.("story"))}>
                                    📲 Instagram Story (1080×1920)
                                </button>

                                <button type="button" onClick={() => runExport(() => exportInstagram?.("status"))}>
                                    💬 WhatsApp Status (1080×1920)
                                </button>

                                <button type="button" onClick={() => runExport(() => exportInstagram?.("post"))}>
                                    ⬜ Instagram Post (1080×1080)
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

                                <button type="button" onClick={() => runExport(exportGIF)} disabled={gifExporting}>
                                    🎞️ {gifExporting
                                    ? `Exporting GIF ${Math.round((gifExportProgress || 0) * 100)}%`
                                    : "Export as GIF"}
                                </button>

                                <div className="export-video-box">
                                    <label>
                                        Delay before animation (seconds)
                                        <input
                                            type="number"
                                            min="0"
                                            max="120"
                                            step="0.5"
                                            value={videoPreAnimationDelaySeconds}
                                            onChange={(event) => setVideoPreAnimationDelaySeconds(event.target.value)}
                                        />
                                    </label>

                                    <label>
                                        Hold after animation before next slide (seconds)
                                        <input
                                            type="number"
                                            min="0"
                                            max="120"
                                            step="0.5"
                                            value={videoGapSeconds}
                                            onChange={(event) => setVideoGapSeconds(event.target.value)}
                                        />
                                    </label>

                                    <div className="video-frame-range">
                                        <label>
                                            From frame
                                            <input
                                                type="number"
                                                min="1"
                                                max={Math.max(1, timelineFrames.length)}
                                                step="1"
                                                value={videoFrameFrom}
                                                onChange={(event) => setVideoFrameFrom(event.target.value)}
                                                disabled={videoExportState.exporting || timelineFrames.length === 0}
                                            />
                                        </label>

                                        <label>
                                            To frame
                                            <input
                                                type="number"
                                                min="1"
                                                max={Math.max(1, timelineFrames.length)}
                                                step="1"
                                                value={videoFrameTo}
                                                onChange={(event) => setVideoFrameTo(event.target.value)}
                                                disabled={videoExportState.exporting || timelineFrames.length === 0}
                                            />
                                        </label>
                                    </div>

                                    <div className="video-range-hint">
                                        Exporting {Math.max(0, Math.min(timelineFrames.length, Number(videoFrameTo) || 0) - Math.max(1, Number(videoFrameFrom) || 1) + 1)} of {timelineFrames.length} frames
                                    </div>

                                    <label>
                                        Export using
                                        <select
                                            value={videoExportMode}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setVideoExportMode(value);
                                                localStorage.setItem("sketchydraw.videoExportMode", value);
                                            }}
                                        >
                                            <option value="server">Server MP4 (recommended)</option>
                                            <option value="browser">Browser WebM</option>
                                        </select>
                                    </label>

                                    <button type="button" onClick={runVideoExport} disabled={videoExportState.exporting}>
                                        {videoExportState.exporting
                                            ? `⏳ ${Math.round(videoExportState.progress || 0)}%`
                                            : (videoExportMode === "server" ? "🎬 Export MP4 on server" : "🎬 Export WebM in browser")}
                                    </button>
                                    {videoExportState.exporting && (
                                        <div className="video-export-progress" role="status" aria-live="polite">
                                            <progress max="100" value={Math.round(videoExportState.progress || 0)} />
                                            <span>{videoExportState.status || "Exporting video..."}</span>
                                        </div>
                                    )}
                                </div>
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
                                    📓 Notebook Pages
                                </button>

                                {activePattern === "notebook" && (
                                    <>
                                        <div className="grid-dropdown-divider" />

                                        <div className="grid-dropdown-label">
                                            Notebook Pages: {canvasProps?.pageCount || DEFAULT_NOTEBOOK_PAGE_COUNT}
                                        </div>

                                        <button type="button" onClick={addNotebookPage}>
                                            ➕ Add Page
                                        </button>

                                        <button
                                            type="button"
                                            onClick={removeNotebookPage}
                                            disabled={(canvasProps?.pageCount || DEFAULT_NOTEBOOK_PAGE_COUNT) <= 1}
                                        >
                                            ➖ Remove Last Page
                                        </button>
                                    </>
                                )}

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