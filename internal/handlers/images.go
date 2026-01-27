package handlers

import (
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"sarray-forge/internal/middleware"

	"golang.org/x/image/draw"
)

// ImageDir is where markdown images are stored
var ImageDir = "./data/uploads/images"

// MaxImageSize is the maximum image upload size (10MB)
const MaxImageSize = 10 << 20

// MaxImageWidth is the maximum width before resizing
const MaxImageWidth = 1920

// JPEGQuality is the quality for JPEG encoding
const JPEGQuality = 85

func init() {
	if dir := os.Getenv("IMAGES_DIR"); dir != "" {
		ImageDir = dir
	}
}

// UploadImageResponse is the response for image uploads
type UploadImageResponse struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
}

// UploadImage handles POST /api/uploads/images
func (h *Handlers) UploadImage(w http.ResponseWriter, r *http.Request) {
	_, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	// Limit upload size
	r.Body = http.MaxBytesReader(w, r.Body, MaxImageSize)

	// Parse multipart form
	if err := r.ParseMultipartForm(MaxImageSize); err != nil {
		writeError(w, http.StatusBadRequest, "file_too_large", "File too large (max 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing_file", "No file provided")
		return
	}
	defer file.Close()

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/gif" {
		writeError(w, http.StatusBadRequest, "invalid_type", "Only JPEG, PNG, and GIF images are allowed")
		return
	}

	// Ensure image directory exists
	if err := os.MkdirAll(ImageDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "storage_error", "Failed to create storage directory")
		return
	}

	// Generate unique filename
	ext := ".jpg"
	switch contentType {
	case "image/png":
		ext = ".png"
	case "image/gif":
		ext = ".gif"
	}
	uniqueFilename := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), randomString(8), ext)
	filePath := filepath.Join(ImageDir, uniqueFilename)

	// Handle GIF separately (preserve animation, no resize)
	if contentType == "image/gif" {
		dst, err := os.Create(filePath)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "storage_error", "Failed to save image")
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			os.Remove(filePath)
			writeError(w, http.StatusInternalServerError, "storage_error", "Failed to save image")
			return
		}

		writeJSON(w, http.StatusOK, UploadImageResponse{
			URL:      "/uploads/images/" + uniqueFilename,
			Filename: sanitizeFilename(header.Filename),
		})
		return
	}

	// Decode image
	var img image.Image
	switch contentType {
	case "image/jpeg":
		img, err = jpeg.Decode(file)
	case "image/png":
		img, err = png.Decode(file)
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_image", "Could not decode image")
		return
	}

	// Resize if too wide
	bounds := img.Bounds()
	if bounds.Dx() > MaxImageWidth {
		img = resizeToMaxWidth(img, MaxImageWidth)
	}

	// Save as JPEG for consistent compression (PNG stays as PNG for transparency)
	dst, err := os.Create(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "storage_error", "Failed to save image")
		return
	}
	defer dst.Close()

	if contentType == "image/png" {
		// Keep as PNG to preserve transparency
		if err := png.Encode(dst, img); err != nil {
			os.Remove(filePath)
			writeError(w, http.StatusInternalServerError, "storage_error", "Failed to encode image")
			return
		}
	} else {
		// Encode as JPEG with compression
		if err := jpeg.Encode(dst, img, &jpeg.Options{Quality: JPEGQuality}); err != nil {
			os.Remove(filePath)
			writeError(w, http.StatusInternalServerError, "storage_error", "Failed to encode image")
			return
		}
	}

	writeJSON(w, http.StatusOK, UploadImageResponse{
		URL:      "/uploads/images/" + uniqueFilename,
		Filename: sanitizeFilename(header.Filename),
	})
}

// resizeToMaxWidth resizes an image to a maximum width, preserving aspect ratio
func resizeToMaxWidth(src image.Image, maxWidth int) image.Image {
	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	// Calculate new dimensions
	newWidth := maxWidth
	newHeight := int(float64(srcH) * (float64(maxWidth) / float64(srcW)))

	// Create resized image
	dst := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)

	return dst
}

// randomString generates a random alphanumeric string
func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(1) // Ensure different values
	}
	return string(b)
}
