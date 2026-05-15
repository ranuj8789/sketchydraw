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
                                             loading = false,
                                             message = "",
                                         }) {
    const [title, setTitle] = useState(DEFAULT_TITLE);
    const [groupName, setGroupName] = useState(DEFAULT_GROUP);
    const [description, setDescription] = useState("");
    const [groups, setGroups] = useState([DEFAULT_GROUP]);
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    useEffect(() => {
        if (!open) return;

        setTitle(initialValues?.title || DEFAULT_TITLE);
        setGroupName(initialValues?.groupName || DEFAULT_GROUP);
        setDescription(initialValues?.description || "");
        setGroups(getStoredGroups());
        setShowNewGroup(false);
        setNewGroupName("");
    }, [open, initialValues]);

    if (!open) return null;

    const finalTitle = title.trim() || DEFAULT_TITLE;
    const finalGroup = groupName.trim() || DEFAULT_GROUP;

    const handleAddGroup = () => {
        const name = newGroupName.trim();
        if (!name) return;

        const nextGroups = saveStoredGroup(name);
        setGroups(nextGroups);
        setGroupName(name);
        setNewGroupName("");
        setShowNewGroup(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        saveStoredGroup(finalGroup);

        onSave?.({
            title: finalTitle,
            groupName: finalGroup,
            description: description.trim(),
        });
    };

    const handleQuickSave = () => {
        saveStoredGroup(finalGroup);

        onSave?.({
            title: finalTitle,
            groupName: finalGroup,
            description: description.trim(),
        });
    };

    return (
        <div className="save-popup-backdrop" onMouseDown={onClose}>
            <div className="save-modal" onMouseDown={(e) => e.stopPropagation()}>
                <button className="save-close" type="button" onClick={onClose}>
                    ×
                </button>

                <div className="save-modal-header">
                    <div className="save-icon">S</div>
                    <div>
                        <span>SketchyDraw Library</span>
                        <h2>Save Drawing</h2>
                        <p>Save this drawing inside a group/workspace.</p>
                    </div>
                </div>

                <div className="save-preview-card">
                    <div>
                        <strong>{finalTitle}</strong>
                        <span>{finalGroup}</span>
                    </div>

                    <button type="button" onClick={handleQuickSave} disabled={loading}>
                        {loading ? "Saving..." : "Quick Save"}
                    </button>
                </div>

                <form className="save-form" onSubmit={handleSubmit}>
                    <label>
                        <span>Drawing title</span>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={DEFAULT_TITLE}
                            autoFocus
                        />
                    </label>

                    <label>
                        <span>Group / Workspace</span>
                        <div className="save-group-row">
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
                                onClick={() => setShowNewGroup((v) => !v)}
                            >
                                + Group
                            </button>
                        </div>
                    </label>

                    {showNewGroup && (
                        <div className="save-new-group-row">
                            <input
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Example: Career, System Design, Display"
                            />

                            <button type="button" onClick={handleAddGroup}>
                                Add
                            </button>
                        </div>
                    )}

                    <label>
                        <span>Description</span>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional notes"
                            rows={3}
                        />
                    </label>

                    {message && <div className="save-message">{message}</div>}

                    <button className="save-primary" type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save Drawing"}
                    </button>

                    <button className="save-secondary" type="button" onClick={onClose}>
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
}