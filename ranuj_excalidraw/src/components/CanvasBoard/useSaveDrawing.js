import { useState } from "react";
import { createDrawingJson } from "../../canvas/drawingStorage";
import { getUser, isLoggedIn } from "../../utils/auth";
import { requireProAccess } from "../../utils/proAccess";
import { saveDrawing } from "../../api/drawingApi";
import {
    DEFAULT_GROUP,
    DEFAULT_TITLE,
    upsertDrawingGroup,
} from "../DrawingGroupStore/drawingGroupStore";

const LOCAL_DRAWINGS_KEY = "sketchydraw_saved_drawings_cache";

function getLocalDrawings() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_DRAWINGS_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveDrawingToLocalCache(savedDrawing) {
    const existing = getLocalDrawings();

    const filtered = existing.filter(
        (item) => String(item.id) !== String(savedDrawing.id)
    );

    const next = [savedDrawing, ...filtered];

    localStorage.setItem(LOCAL_DRAWINGS_KEY, JSON.stringify(next));
}

function normalizeGroupName(groupName) {
    const value = String(groupName || "").trim();
    return value || DEFAULT_GROUP;
}

function normalizeTitle(title) {
    const value = String(title || "").trim();
    return value || DEFAULT_TITLE;
}

export function useSaveDrawing({
                                   elements,
                                   viewport,
                                   canvasSize,
                                   currentDrawingMeta,
                                   setCurrentDrawingMeta,
                               }) {
    const [isSavingDrawing, setIsSavingDrawing] = useState(false);
    const [savePopupOpen, setSavePopupOpen] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [saveAsNewMode, setSaveAsNewMode] = useState(false);

    const openSavePopup = async ({ saveAsNew = false } = {}) => {
        setSaveMessage("");
        setSaveAsNewMode(saveAsNew);

        const allowed = await requireProAccess(saveAsNew ? "Save As New" : "Save Drawing");
        if (!allowed) return;

        setSavePopupOpen(true);
    };

    const closeSavePopup = () => {
        if (isSavingDrawing) return;
        setSavePopupOpen(false);
        setSaveMessage("");
    };

    const saveCurrentDrawing = async ({
                                          title,
                                          groupName,
                                          description,
                                          saveAsNew = saveAsNewMode,
                                      } = {}) => {
        if (isSavingDrawing) return;

        if (!isLoggedIn()) {
            window.dispatchEvent(new Event("sketchydraw:open-login"));
            return;
        }

        const allowed = await requireProAccess(saveAsNew ? "Save As New" : "Save Drawing");
        if (!allowed) return;

        const user = getUser();

        const finalTitle = normalizeTitle(title || currentDrawingMeta?.title);
        const finalGroup = normalizeGroupName(groupName || currentDrawingMeta?.groupName);
        const finalDescription =
            String(description || currentDrawingMeta?.description || "").trim();

        const localDrawingJson = createDrawingJson({
            elements,
            viewport,
            canvasSize,
            name: finalTitle,
        });

        const drawingPayload = {
            version: 1,
            app: "SketchyDraw",
            title: finalTitle,
            groupName: finalGroup,
            workspace: finalGroup,
            description: finalDescription,
            userEmail: user?.email,
            data: localDrawingJson,
            savedAt: new Date().toISOString(),
        };

        setIsSavingDrawing(true);
        setSaveMessage("");

        try {
            upsertDrawingGroup(finalGroup);

            const saved = await saveDrawing({
                id: saveAsNew ? undefined : currentDrawingMeta?.id || undefined,
                title: finalTitle,
                groupName: finalGroup,
                workspace: finalGroup,
                description: finalDescription,
                drawingJson: JSON.stringify(drawingPayload),
            });

            const savedId =
                saved?.id ||
                saved?.drawingId ||
                (!saveAsNew ? currentDrawingMeta?.id : undefined);

            const serverGroup = normalizeGroupName(
                saved?.groupName ||
                saved?.group_name ||
                saved?.workspace ||
                finalGroup
            );

            const nextMeta = {
                id: savedId,
                title: saved?.title || finalTitle,
                groupName: serverGroup,
                description: saved?.description || finalDescription,
            };

            setCurrentDrawingMeta?.(nextMeta);

            saveDrawingToLocalCache({
                id: savedId,
                title: nextMeta.title,
                groupName: nextMeta.groupName,
                workspace: nextMeta.groupName,
                description: nextMeta.description,
                drawingJson: JSON.stringify({
                    ...drawingPayload,
                    id: savedId,
                    title: nextMeta.title,
                    groupName: nextMeta.groupName,
                    workspace: nextMeta.groupName,
                    description: nextMeta.description,
                }),
                updatedAt: new Date().toISOString(),
            });

            upsertDrawingGroup(nextMeta.groupName);

            setSaveMessage(
                saveAsNew
                    ? "Drawing saved as new successfully."
                    : "Drawing saved successfully."
            );

            setTimeout(() => {
                setSavePopupOpen(false);
                setSaveMessage("");
                setSaveAsNewMode(false);
            }, 700);
        } catch (error) {
            console.error("Drawing save failed:", error);
            setSaveMessage(error?.message || "Failed to save drawing.");
        } finally {
            setIsSavingDrawing(false);
        }
    };

    return {
        isSavingDrawing,
        savePopupOpen,
        saveMessage,
        openSavePopup,
        closeSavePopup,
        saveCurrentDrawing,
    };
}
