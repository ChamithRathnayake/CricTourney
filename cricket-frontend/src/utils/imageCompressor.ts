/**
 * Compress and resize an image file on the client-side before uploading.
 * Guarantees that smartphone camera photos (5MB - 20MB) are automatically resized & compressed
 * into high-quality, lightweight web images (~100KB - 300KB) that upload instantly without size errors.
 */
export async function compressImageFile(
  file: File,
  maxDimension: number = 1024,
  quality: number = 0.85
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const extension = mimeType === 'image/png' ? '.png' : '.jpg';
          const cleanName = file.name.replace(/\.[^/.]+$/, "") + extension;
          const compressedFile = new File([blob], cleanName, {
            type: mimeType,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
