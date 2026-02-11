export const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) {
        return imagePath;
    }
    return `http://localhost:5000/imgs/${imagePath}`;
};