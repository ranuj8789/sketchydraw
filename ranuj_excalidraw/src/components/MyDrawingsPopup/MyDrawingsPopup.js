import React, { useEffect, useMemo, useState } from "react";
import { listDrawings, getDrawing, deleteDrawing } from "../../api/drawingApi";
import {
    DEFAULT_GROUP,
    DEFAULT_TITLE,
    getStoredGroups,
    saveStoredGroup,
    mergeGroupsFromDrawings,
    getGroupNameFromDrawing,
} from "../DrawingGroupStore/drawingGroupStore";
import "./MyDrawingsPopup.css";

export default function MyDrawingsPopup({
                                            open,
                                            onClose,
                                            onOpenDrawing,
                                        }) {
    const [drawings, setDrawings] = useState([]);
    const [groups, setGroups] = useState([DEFAULT_GROUP]);
    const [selectedGroup, setSelectedGroup] = useState("All");
    const [searchText, setSearchText] = useState("");
    const [newGroupName, setNewGroupName] = useState("");
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [openingId, setOpeningId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [message, setMessage] = useState("");

    const getGroupName = (drawing) => getGroupNameFromDrawing(drawing);

    const normalizeRows = (rows) => {
        return rows.map((drawing) => ({
            ...drawing,
            groupName: getGroupNameFromDrawing(drawing),
        }));
    };

    const loadDrawings = async () => {
        setLoading(true);
        setMessage("");

        try {
            const data = await listDrawings();

            const rows = Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : Array.isArray(data?.drawings)
                        ? data.drawings
                        : [];

            const normalizedRows = normalizeRows(rows);

            setDrawings(normalizedRows);
            setGroups(mergeGroupsFromDrawings(normalizedRows));
        } catch (error) {
            console.error("Failed to load drawings", error);
            setMessage(error?.message || "Failed to load drawings.");
            setGroups(getStoredGroups());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            setSelectedGroup("All");
            setSearchText("");
            setNewGroupName("");
            setShowNewGroup(false);
            setGroups(getStoredGroups());
            loadDrawings();
        }
    }, [open]);

    const allGroups = useMemo(() => {
        const drawingGroups = drawings.map(getGroupName);
        return Array.from(new Set([DEFAULT_GROUP, ...groups, ...drawingGroups]));
    }, [drawings, groups]);

    const sidebarGroups = useMemo(() => ["All", ...allGroups], [allGroups]);

    const filteredDrawings = useMemo(() => {
        const q = searchText.trim().toLowerCase();

        return drawings.filter((drawing) => {
            const title = drawing.title || DEFAULT_TITLE;
            const group = getGroupName(drawing);

            const groupOk = selectedGroup === "All" || selectedGroup === group;
            const searchOk =
                !q ||
                title.toLowerCase().includes(q) ||
                group.toLowerCase().includes(q);

            return groupOk && searchOk;
        });
    }, [drawings, selectedGroup, searchText]);

    if (!open) return null;

    const handleAddGroup = () => {
        const name = newGroupName.trim();
        if (!name) return;

        const next = saveStoredGroup(name);
        setGroups(next);
        setSelectedGroup(name);
        setNewGroupName("");
        setShowNewGroup(false);
    };

    const handleOpen = async (drawing) => {
        if (!drawing?.id) {
            setMessage("Drawing id missing.");
            return;
        }

        setOpeningId(drawing.id);
        setMessage("");

        try {
            const fullDrawing = await getDrawing(drawing.id);

            const normalizedFullDrawing = {
                ...fullDrawing,
                groupName: getGroupNameFromDrawing(fullDrawing),
            };

            saveStoredGroup(normalizedFullDrawing.groupName);

            onOpenDrawing?.(normalizedFullDrawing);
            onClose?.();
        } catch (error) {
            console.error("Open drawing failed", error);
            setMessage(error?.message || "Failed to open drawing.");
        } finally {
            setOpeningId(null);
        }
    };

    const handleDelete = async (drawingId) => {
        const ok = window.confirm("Delete this drawing?");
        if (!ok) return;

        setDeletingId(drawingId);
        setMessage("");

        try {
            await deleteDrawing(drawingId);
            setDrawings((prev) => prev.filter((d) => d.id !== drawingId));
            setMessage("Drawing deleted.");
        } catch (error) {
            console.error("Delete failed", error);
            setMessage(error?.message || "Failed to delete drawing.");
        } finally {
            setDeletingId(null);
        }
    };

    const countForGroup = (group) => {
        if (group === "All") return drawings.length;
        return drawings.filter((drawing) => getGroupName(drawing) === group).length;
    };

    const formatDate = (drawing) => {
        const raw = drawing.updatedAt || drawing.createdAt || drawing.savedAt;
        if (!raw) return "No date";

        try {
            return new Date(raw).toLocaleString();
        } catch {
            return raw;
        }
    };

    return (
        <div className="drawings-backdrop" onMouseDown={onClose}>
            <div className="drawings-modal" onMouseDown={(e) => e.stopPropagation()}>
                <button className="drawings-close" type="button" onClick={onClose}>
                    ×
                </button>

                <aside className="drawings-sidebar">
                    <div className="drawings-logo-row">
                        <div className="drawings-logo">S</div>
                        <div>
                            <strong>SketchyDraw</strong>
                            <span>Drawing Library</span>
                        </div>
                    </div>

                    <div className="drawings-sidebar-head">
                        <span>Groups</span>
                        <button type="button" onClick={() => setShowNewGroup((v) => !v)}>
                            +
                        </button>
                    </div>

                    {showNewGroup && (
                        <div className="drawings-new-group">
                            <input
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="New group"
                            />
                            <button type="button" onClick={handleAddGroup}>
                                Add
                            </button>
                        </div>
                    )}

                    <div className="drawings-group-list">
                        {sidebarGroups.map((group) => (
                            <button
                                key={group}
                                type="button"
                                className={selectedGroup === group ? "active" : ""}
                                onClick={() => setSelectedGroup(group)}
                            >
                                <span>{group}</span>
                                <em>{countForGroup(group)}</em>
                            </button>
                        ))}
                    </div>

                    <div className="drawings-version-card">
                        <strong>Coming next</strong>
                        <p>Auto-save, versions and Git-style drawing diff.</p>
                    </div>
                </aside>

                <main className="drawings-main">
                    <header className="drawings-header">
                        <div>
                            <span>Your saved diagrams</span>
                            <h2>My Drawings</h2>
                            <p>Open, filter and manage drawings by group.</p>
                        </div>

                        <button type="button" onClick={loadDrawings} disabled={loading}>
                            {loading ? "Refreshing..." : "Refresh"}
                        </button>
                    </header>

                    <div className="drawings-toolbar">
                        <input
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Search by title or group..."
                        />

                        <div className="drawings-count">
                            {filteredDrawings.length} shown
                        </div>
                    </div>

                    {message && <div className="drawings-message">{message}</div>}

                    {loading && (
                        <div className="drawings-grid">
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                                <div className="drawing-card skeleton" key={n}>
                                    <div />
                                    <span />
                                    <span />
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && filteredDrawings.length === 0 && (
                        <div className="drawings-empty">
                            <div>◇</div>
                            <strong>No drawings found</strong>
                            <span>Save a drawing or select another group.</span>
                        </div>
                    )}

                    {!loading && filteredDrawings.length > 0 && (
                        <div className="drawings-grid">
                            {filteredDrawings.map((drawing) => {
                                const isOpening = openingId === drawing.id;
                                const isDeleting = deletingId === drawing.id;

                                return (
                                    <article className="drawing-card" key={drawing.id}>
                                        <div className="drawing-preview">
                                            <span />
                                            <span />
                                            <span />
                                        </div>

                                        <div className="drawing-card-body">
                                            <div className="drawing-badges">
                                                <em>{getGroupName(drawing)}</em>
                                                <b>v{drawing.latestVersion || drawing.version || 1}</b>
                                            </div>

                                            <h3 title={drawing.title || DEFAULT_TITLE}>
                                                {drawing.title || DEFAULT_TITLE}
                                            </h3>

                                            <p>{formatDate(drawing)}</p>

                                            <div className="drawing-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpen(drawing)}
                                                    disabled={isOpening || isDeleting}
                                                >
                                                    {isOpening ? "Opening..." : "Open"}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="danger"
                                                    onClick={() => handleDelete(drawing.id)}
                                                    disabled={isOpening || isDeleting}
                                                >
                                                    {isDeleting ? "..." : "Delete"}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}