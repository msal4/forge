import { useState, useCallback } from 'react';
import { uploadsApi } from '../api/uploads';

// ============================================
// useImageUpload Hook
// Handles image upload with loading state
// ============================================

interface UseImageUploadOptions {
  onSuccess?: (url: string, filename: string) => void;
  onError?: (error: Error) => void;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<{ url: string; filename: string } | null> => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      const err = new Error('Only JPEG, PNG, and GIF images are allowed');
      setError(err.message);
      options.onError?.(err);
      return null;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const err = new Error('Image must be less than 10MB');
      setError(err.message);
      options.onError?.(err);
      return null;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await uploadsApi.uploadImage(file);
      options.onSuccess?.(result.url, result.filename);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Upload failed');
      setError(err.message);
      options.onError?.(err);
      return null;
    } finally {
      setUploading(false);
    }
  }, [options]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    upload,
    uploading,
    error,
    clearError,
  };
}
