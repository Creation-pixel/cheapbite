
/**
 * Converts a Data URL (e.g., data:image/jpeg;base64,...) into a Blob object.
 * This is the crucial step needed before uploading to Firebase Storage.
 * @param dataUrl The Data URL string to convert.
 * @returns A Promise that resolves with the Blob.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return blob;
}

    