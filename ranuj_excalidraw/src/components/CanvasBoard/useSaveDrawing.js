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
import { saveLocalDrawing } from "../DrawingGroupStore/localDrawingStore";

function normalizeGroupName(groupName) {
    const value = String(groupName || "").trim();
    return value || DEFAULT_GROUP;
}

function normalizeTitle(title) {
    const value = String(title || "").trim();
    return value || DEFAULT_TITLE;
}

function isLocalId(id) {
    return !!id && String(id).startsWith("local_");
}

function getServerSafeId(id) {
    if (!id) return undefined;
    if (isLocalId(id)) return undefined;
    return id;
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
            userEmail: user?.email || "",
            data: localDrawingJson,
            savedAt: new Date().toISOString(),
        };

        const currentServerSafeId = getServerSafeId(currentDrawingMeta?.id);

        const localRow = saveLocalDrawing({
            id: saveAsNew ? undefined : currentDrawingMeta?.id,
            title: finalTitle,
            groupName: finalGroup,
            description: finalDescription,
            elements,
            viewport,
            canvasSize,
            drawingJson: JSON.stringify(drawingPayload),
            userEmail: user?.email || "",
        });

        const localMeta = {
            // IMPORTANT:
            // Do not put local_ id into currentDrawingMeta.id.
            // Backend may expect numeric/server id.
            id: saveAsNew ? null : currentServerSafeId || null,
            title: localRow?.title || finalTitle,
            groupName: localRow?.groupName || finalGroup,
            description: localRow?.description || finalDescription,
        };

        setCurrentDrawingMeta?.(localMeta);
        upsertDrawingGroup(localMeta.groupName);

        if (!isLoggedIn()) {
            setSaveMessage("Saved locally. Login to sync this drawing.");
            window.dispatchEvent(new Event("sketchydraw:open-login"));

            setTimeout(() => {
                setSavePopupOpen(false);
                setSaveMessage("");
                setSaveAsNewMode(false);
            }, 900);

            return;
        }

        const allowed = await requireProAccess(saveAsNew ? "Save As New" : "Save Drawing");

        if (!allowed) {
            setSaveMessage("Saved locally. Upgrade to sync this drawing.");

            setTimeout(() => {
                setSavePopupOpen(false);
                setSaveMessage("");
                setSaveAsNewMode(false);
            }, 900);

            return;
        }

        setIsSavingDrawing(true);
        setSaveMessage("Saved locally. Syncing...");

        try {
            upsertDrawingGroup(finalGroup);

            const saved = await saveDrawing({
                id: saveAsNew ? undefined : currentServerSafeId,
                title: finalTitle,
                groupName: finalGroup,
                workspace: finalGroup,
                description: finalDescription,
                drawingJson: JSON.stringify(drawingPayload),
            });

            const savedId =
                saved?.id ||
                saved?.drawingId ||
                (!saveAsNew ? currentServerSafeId : undefined) ||
                null;

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

            saveLocalDrawing({
                id: savedId || localRow?.id,
                title: nextMeta.title,
                groupName: nextMeta.groupName,
                description: nextMeta.description,
                drawingJson: JSON.stringify({
                    ...drawingPayload,
                    id: savedId,
                    title: nextMeta.title,
                    groupName: nextMeta.groupName,
                    workspace: nextMeta.groupName,
                    description: nextMeta.description,
                }),
                userEmail: user?.email || "",
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
            console.error("Drawing sync failed:", error);
            setSaveMessage("Saved locally. Server sync failed.");
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