import React, { useEffect, useState } from "react";
import {
    DEFAULT_GROUP,
    DEFAULT_TITLE,
    getStoredGroups,
    saveStoredGroup,
} from "../DrawingGroupStore/drawingGroupStore";
import "./SaveDrawingPopup.css";

export default function SaveDrawingPopup({
                                             open,
                                             onClose,
                                             onSave,
                                             initialValues,
                                             loading,
                                             message,
                                         }) {
    const [title, setTitle] = useState(DEFAULT_TITLE);
    const [groupName, setGroupName] = useState(DEFAULT_GROUP);
    const [groups, setGroups] = useState([DEFAULT_GROUP]);
    const [newGroupName, setNewGroupName] = useState("");
    const [showNewGroup, setShowNewGroup] = useState(false);

    useEffect(() => {
        if (!open) return;

        setTitle(initialValues?.title || DEFAULT_TITLE);
        setGroupName(initialValues?.groupName || DEFAULT_GROUP);
        setGroups(getStoredGroups());
        setNewGroupName("");
        setShowNewGroup(false);
    }, [open, initialValues]);

    if (!open) return null;

    const handleAddGroup = () => {
        const name = newGroupName.trim();
        if (!name) return;

        const nextGroups = saveStoredGroup(name);

        setGroups(nextGroups);
        setGroupName(name);
        setNewGroupName("");
        setShowNewGroup(false);
    };

    const handleSave = () => {
        const finalTitle = title.trim() || DEFAULT_TITLE;
        const finalGroup = groupName.trim() || DEFAULT_GROUP;

        onSave?.({
            title: finalTitle,
            groupName: finalGroup,
            description: "",
        });
    };

    const handleBackdropMouseDown = (event) => {
        if (event.target === event.currentTarget && !loading) {
            onClose?.();
        }
    };

    return (
        <div className="save-drawing-backdrop" onMouseDown={handleBackdropMouseDown}>
            <div className="save-drawing-modal">
                <button
                    type="button"
                    className="save-drawing-close"
                    onClick={onClose}
                    disabled={loading}
                    aria-label="Close"
                >
                    ×
                </button>

                <div className="save-drawing-header">
                    <h2>Save Drawing</h2>
                    <p>Choose a name and workspace.</p>
                </div>

                <div className="save-drawing-form">
                    <label className="save-field">
                        <span>Drawing name</span>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Untitled"
                            autoFocus
                        />
                    </label>

                    <label className="save-field">
                        <span>Workspace</span>

                        <div className="workspace-row">
                            <select
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                            >
                                {groups.map((group) => (
                                    <option key={group} value={group}>
                                        {group}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                className="new-workspace-btn"
                                onClick={() => setShowNewGroup((v) => !v)}
                            >
                                + New
                            </button>
                        </div>
                    </label>

                    {showNewGroup && (
                        <div className="new-workspace-box">
                            <input
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Workspace name"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddGroup();
                                    }
                                }}
                            />

                            <button type="button" onClick={handleAddGroup}>
                                Add
                            </button>
                        </div>
                    )}

                    {message && (
                        <div className="save-drawing-message">
                            {message}
                        </div>
                    )}

                    <button
                        type="button"
                        className="save-drawing-primary"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? "Saving..." : "Save Drawing"}
                    </button>

                    <button
                        type="button"
                        className="save-drawing-cancel"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}