import {
    readDrawingJsonFile,
    loadDrawingJson,
} from "../../canvas/drawingStorage";

export function useDrawingImport({
                                     setElements,
                                     setSelectedIds,
                                     setViewport,
                                     setCanvasSize,
                                     commitHistory,
                                 }) {
    const importDrawingJson = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const json = await readDrawingJsonFile(file);
            const loaded = loadDrawingJson(json);

            setElements(loaded.elements);
            setSelectedIds([]);
            setViewport(loaded.viewport);
            setCanvasSize(loaded.canvasSize);
            commitHistory(loaded.elements);
        } catch (error) {
            alert("Invalid drawing JSON file");
            console.error(error);
        } finally {
            event.target.value = "";
        }
    };

    return {
        importDrawingJson,
    };
}