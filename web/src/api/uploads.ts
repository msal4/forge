// ============================================
// Uploads API - Image uploads for markdown
// ============================================

export interface UploadImageResponse {
  url: string;
  filename: string;
}

export const uploadsApi = {
  /**
   * Upload an image for use in markdown content
   * @param file - The image file to upload
   * @returns The URL and original filename of the uploaded image
   */
  uploadImage: async (file: File): Promise<UploadImageResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/uploads/images', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || 'Upload failed');
    }

    return res.json();
  },
};
