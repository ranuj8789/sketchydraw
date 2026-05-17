const API_BASE = process.env.REACT_APP_API_BASE || "";

export const apiUrl = (path) => {
    if (!path) {
        return API_BASE;
    }

    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }

    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    return `${API_BASE}${cleanPath}`;
};

export default API_BASE;