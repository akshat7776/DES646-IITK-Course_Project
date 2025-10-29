import placeholderData from './placeholder-images.json';

type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

const images: ImagePlaceholder[] = placeholderData.placeholderImages;

export const getImageById = (id: string) => {
  return images.find(img => img.id === id);
}
