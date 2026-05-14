import React, { useState } from "react";
import "./SaveDrawingPopup.css";

export default function SaveDrawingPopup({
                                             open,
                                             onClose,
                                             onSave,
                                             loading = false,
                                             message = "",
                                         }) {
    const [title, setTitle] = useState("");
    const [groupName, setGroupName] = useState("");
    const [description, setDescription] = useState("");

    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        const finalTitle = title.trim() || `Drawing ${new Date().toLocaleString()}`;
        const finalGroup = groupName.trim() || "My Drawings";

        onSave?.({
            title: finalTitle,
            groupName: finalGroup,
            description: description.trim(),
        });
    };

    return (
        <div className="save-popup-backdrop" onMouseDown={onClose}>
            <div className="save-popup" onMouseDown={(e) => e.stopPropagation()}>
                <button className="save-popup-close" type="button" onClick={onClose}>
                    ×
                </button>

                <h2>Save your drawing</h2>

                <p className="save-popup-subtitle">
                    Give your drawing a title and organize it inside a group.
                </p>

                <form onSubmit={handleSubmit}>
                    <label className="save-popup-field">
                        <span>Drawing title</span>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Example: Login flow diagram"
                            autoFocus
                        />
                    </label>

                    <label className="save-popup-field">
                        <span>Group / Folder</span>
                        <input
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Example: System Design"
                        />
                    </label>

                    <label className="save-popup-field">
                        <span>Description</span>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional notes about this drawing"
                            rows={3}
                        />
                    </label>

                    {message && (
                        <div className="save-popup-message">
                            {message}
                        </div>
                    )}

                    <button className="save-popup-primary" type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save Drawing"}
                    </button>

                    <button
                        className="save-popup-secondary"
                        type="button"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
}