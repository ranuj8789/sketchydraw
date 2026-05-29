import {
    copyCanvasToClipboard,
    copyCanvasAreaToClipboard,
} from "../../utils/exportBoard";

export const createCanvasCopyHandlers = ({
                                             canvasRef,
                                             getSelectedScreenCrop,
                                         }) => {
    const handleCopyWholePNG = async () => {
        try {
            await copyCanvasToClipboard(canvasRef.current, "image/png");
        } catch (error) {
            console.error("Copy whole PNG failed", error);
            alert("Copy PNG failed. Use HTTPS or localhost.");
        }
    };

    const handleCopyWholeJPEG = async () => {
        try {
            await copyCanvasToClipboard(canvasRef.current, "image/jpeg");
        } catch (error) {
            console.error("Copy whole JPEG failed", error);
            alert("Copy JPEG failed. Use HTTPS or localhost.");
        }
    };

    const handleCopyWholeSVG = async () => {
        try {
            alert("SVG copy needs one small exportBoard refactor. PNG/JPEG copy is ready.");
        } catch (error) {
            console.error("Copy whole SVG failed", error);
        }
    };

    const handleCopySelectedPNG = async () => {
        try {
            const crop = getSelectedScreenCrop();

            if (!crop) {
                alert("Select something first.");
                return;
            }

            await copyCanvasAreaToClipboard(canvasRef.current, crop, "image/png");
        } catch (error) {
            console.error("Copy selected PNG failed", error);
            alert("Copy selected PNG failed. Use HTTPS or localhost.");
        }
    };

    const handleCopySelectedJPEG = async () => {
        try {
            const crop = getSelectedScreenCrop();

            if (!crop) {
                alert("Select something first.");
                return;
            }

            await copyCanvasAreaToClipboard(canvasRef.current, crop, "image/jpeg");
        } catch (error) {
            console.error("Copy selected JPEG failed", error);
            alert("Copy selected JPEG failed. Use HTTPS or localhost.");
        }
    };

    const handleCopySelectedSVG = async () => {
        try {
            alert("SVG selected copy needs one small exportBoard refactor. PNG/JPEG copy is ready.");
        } catch (error) {
            console.error("Copy selected SVG failed", error);
        }
    };

    return {
        handleCopyWholePNG,
        handleCopyWholeJPEG,
        handleCopyWholeSVG,
        handleCopySelectedPNG,
        handleCopySelectedJPEG,
        handleCopySelectedSVG,
    };
};