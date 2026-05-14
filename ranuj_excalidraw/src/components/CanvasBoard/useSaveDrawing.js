import { useState } from "react";
import { createDrawingJson } from "../../canvas/drawingStorage";
import { getUser, isLoggedIn, isPaidUser } from "../../utils/auth";
import { saveDrawing } from "../../api/drawingApi";

export function useSaveDrawing({
                                   elements,
                                   viewport,
                                   canvasSize,
                               }) {
    const [isSavingDrawing, setIsSavingDrawing] = useState(false);

    const saveCurrentDrawing = async () => {
        if (!isLoggedIn()) {
            alert("Please login first to save your drawing.");
            return;
        }

        if (!isPaidUser()) {
            alert("Active subscription required to save drawings.");
            return;
        }

        if (isSavingDrawing) {
            return;
        }

        const user = getUser();

        const title =
            prompt("Enter drawing title", `Drawing ${new Date().toLocaleString()}`) ||
            "Untitled Drawing";

        const localDrawingJson = createDrawingJson({
            elements,
            viewport,
            canvasSize,
            name: title,
        });

        const drawingPayload = {
            version: 1,
            app: "SketchyDraw",
            title,
            userEmail: user?.email,
            data: localDrawingJson,
            savedAt: new Date().toISOString(),
        };

        setIsSavingDrawing(true);

        try {
            const saved = await saveDrawing({
                title,
                drawingJson: JSON.stringify(drawingPayload),
            });

            alert(`Drawing saved successfully. ID: ${saved.id}`);
        } catch (error) {
            console.error("Drawing save failed:", error);
            alert(error?.message || "Failed to save drawing.");
        } finally {
            setIsSavingDrawing(false);
        }
    };

    return {
        isSavingDrawing,
        saveCurrentDrawing,
    };
}