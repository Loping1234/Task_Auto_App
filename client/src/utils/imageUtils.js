export const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http') || imagePath.startsWith('blob:')) {
        return imagePath;
    }
    // Use VITE_API_URL from environment, defaulting to localhost for dev
    // Strip trailing /api if present because images are usually served from root/imgs
    const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
    return `${API_URL}/imgs/${imagePath}`;
};