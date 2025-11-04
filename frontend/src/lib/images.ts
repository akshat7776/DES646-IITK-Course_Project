import placeholderData from './placeholder-images.json';

type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

const images: ImagePlaceholder[] = placeholderData.placeholderImages;
const DEFAULT_IMAGE_URL = '/images/departments/default.svg';

function normalizeUnsplash(url: string): string {
  try {
    const u = new URL(url);
    // Convert Unsplash HTML photo pages to direct image URLs via source.unsplash.com
    if (u.hostname === 'unsplash.com' && u.pathname.startsWith('/photos/')) {
      const parts = u.pathname.split('/');
      // Expected path: /photos/<photoId>[/...]
      const id = parts[2];
      if (id) {
        return `https://source.unsplash.com/${id}/800x800`;
      }
    }
  } catch {
    // ignore parsing errors and keep original url
  }
  return url;
}

export const getImageById = (id: string) => {
  const img = images.find(img => img.id === id);
  if (!img) {
    // Fallback to a local default placeholder
    return {
      id: 'default',
      description: 'Default placeholder',
      imageUrl: DEFAULT_IMAGE_URL,
      imageHint: 'placeholder image',
    } as ImagePlaceholder;
  }
  return { ...img, imageUrl: normalizeUnsplash(img.imageUrl) } as ImagePlaceholder;
}
