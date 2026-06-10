import { useEffect } from "react";
import {
    cloneElementsForPaste,
    readElementsFromSystemClipboard,
    writeElementsToSystemClipboard,
} from "./canvasClipboard";

export function useCanvasKeyboardShortcuts({
                                               editor,
                                               selectedIds,
                                               elements,
                                               clipboard,
                                               setClipboard,
                                               setElements,
                                               setSelectedIds,
                                               commitHistory,
                                               getPastePoint,
                                           }) {
    useEffect(() => {
        const pasteElements = async () => {
            const systemClipboardElements = await readElementsFromSystemClipboard();

            const source =
                systemClipboardElements && systemClipboardElements.length > 0
                    ? systemClipboardElements
                    : clipboard;

            if (!source || source.length === 0) return;

            const pastePoint = getPastePoint?.() || null;

            const pasted = cloneElementsForPaste(source, {
                offset: 24,
                pastePoint,
            });

            const next = [...elements, ...pasted];

            setElements(next);
            setSelectedIds(pasted.map((el) => el.id));
            commitHistory(next);
        };

        const onKeyDown = async (event) => {
            const tagName = event.target?.tagName?.toLowerCase();
            const isTypingTarget =
                tagName === "textarea" ||
                tagName === "input" ||
                event.target?.isContentEditable;

            if (editor || isTypingTarget) return;

            const isCopy =
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "c";

            const isPaste =
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "v";

            const isSelectAll =
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "a";

            if (isSelectAll) {
                event.preventDefault();
                setSelectedIds(elements.map((el) => el.id));
                return;
            }

            if (isCopy) {
                if (selectedIds.length === 0) return;

                event.preventDefault();

                const selectedSet = new Set(selectedIds);

                const selected = elements.filter(
                    (el) =>
                        selectedSet.has(el.id) ||
                        (el.parentId && selectedSet.has(el.parentId))
                );

                const copied = JSON.parse(JSON.stringify(selected));

                setClipboard(copied);
                await writeElementsToSystemClipboard(copied);

                return;
            }

            if (isPaste) {
                event.preventDefault();
                await pasteElements();
                return;
            }

            if (
                (event.key === "Delete" || event.key === "Backspace") &&
                selectedIds.length > 0
            ) {
                const selectedSet = new Set(selectedIds);

                const parentShapeIds = elements
                    .filter(
                        (el) =>
                            selectedSet.has(el.id) &&
                            (el.type === "rect" ||
                                el.type === "ellipse" ||
                                el.type === "diamond")
                    )
                    .map((el) => el.id);

                let next = elements.filter((el) => !selectedSet.has(el.id));

                if (parentShapeIds.length > 0) {
                    const parentSet = new Set(parentShapeIds);
                    next = next.filter((el) => !parentSet.has(el.parentId));
                }

                setElements(next);
                setSelectedIds([]);
                commitHistory(next);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [
        editor,
        selectedIds,
        elements,
        clipboard,
        setClipboard,
        setElements,
        setSelectedIds,
        commitHistory,
        getPastePoint,
    ]);
}