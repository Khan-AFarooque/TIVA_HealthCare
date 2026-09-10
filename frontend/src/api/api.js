/**
 * API service for the HypoGuard AI backend.
 * Uses the Vite dev-server proxy (/api -> http://localhost:8000) so no CORS
 * issues occur in development. Override with REACT_APP_API_URL for prod.
 */

const API_BASE =
  import.meta.env.VITE_API_URL ||
  `${window.location.origin}/api/v1`;

const ACCEPTED_FORMATS = ["image/jpeg", "image/png", "image/webp", "image/bmp"];

export function validateFile(file) {
  if (!file) throw new Error("No file selected.");
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image is too large. Please upload an image under 10 MB.");
  }
  if (!ACCEPTED_FORMATS.includes(file.type)) {
    throw new Error("Unsupported image type. Please upload JPG, PNG, JPEG, WEBP or BMP.");
  }
}

/**
 * Send an image Blob (File or captured camera frame) to the prediction API.
 * @param {Blob} blob
 * @param {string} source 'upload' | 'camera'
 * @returns parsed prediction payload
 */
export async function predictImage(blob, source = "upload") {
  const form = new FormData();
  const filename = blob.name || `${source === "camera" ? "camera" : "food"}.jpg`;
  form.append("image", new File([blob], filename, { type: blob.type || "image/jpeg" }));
  form.append("source", source);

  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let message = `Prediction failed (${res.status})`;
    try {
      const err = await res.json();
      message = err.detail || message;
    } catch {
      /* ignore parse error */
    }
    throw new Error(message);
  }
  return res.json();
}

export { API_BASE };