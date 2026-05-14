export function getCursorForHandle(handle) {
    switch (handle) {
        case "nw":
        case "se":
            return "nwse-resize";
        case "ne":
        case "sw":
            return "nesw-resize";
        case "n":
        case "s":
            return "ns-resize";
        case "e":
        case "w":
            return "ew-resize";
        default:
            return "default";
    }
}