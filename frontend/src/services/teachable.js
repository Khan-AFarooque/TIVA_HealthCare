/**
 * Teachable Machine prediction service (dual-model).
 *
 * Loads two trained Teachable Machine image models (25 + 25 = 50 Indian food
 * classes) with the @teachablemachine/image library and runs predictions
 * entirely in the browser — no backend call is needed for recognition.
 *
 *  - Model 1 files are bundled under `public/tm-model/`.
 *  - Model 2 files are bundled under `public/food-model-2/`.
 *
 * Each model is loaded once and cached. A model that fails to load is simply
 * "unavailable": prediction falls back to the other model rather than
 * crashing the frontend.
 */

import * as tmImage from "@teachablemachine/image";

/** Local bundled model files (served by Vite from /public). */
const MODEL_URL = "/tm-model/model.json";
const METADATA_URL = "/tm-model/metadata.json";

/** Local bundled Model 2 files (served by Vite from /public). */
const MODEL_URL_2 = "/food-model-2/model.json";
const METADATA_URL_2 = "/food-model-2/metadata.json";

/** Confidence below this = "Unknown Food" (untrained/unrelated image). */
export const CONFIDENCE_THRESHOLD = 0.2;

let _model = null;
let _model2 = null;

/**
 * Load (once) and cache Teachable Machine model 1.
 * @returns {Promise<object>} the TeachableMobileNet instance (has predict())
 */
export async function loadTeachableModel() {
  if (_model) return _model;
  const model = await tmImage.load(MODEL_URL, METADATA_URL);
  _model = model;
  return model;
}

/**
 * Load (once) and cache Teachable Machine model 2.
 * @returns {Promise<object>} the TeachableMobileNet instance (has predict())
 */
export async function loadTeachableModel2() {
  if (_model2) return _model2;
  const model2 = await tmImage.load(MODEL_URL_2, METADATA_URL_2);
  _model2 = model2;
  return model2;
}

/**
 * Preload both models so the first user scan is instant.
 * Best-effort only: each model failure is swallowed so one bad model never
 * blocks the other.
 */
export async function preloadModel() {
  const results = await Promise.allSettled([
    loadTeachableModel(),
    loadTeachableModel2(),
  ]);
  const first = results[0];
  if (first.status === "fulfilled") return first.value;
  const second = results[1];
  if (second.status === "fulfilled") return second.value;
  throw new Error("Neither Teachable Machine model could be loaded.");
}

/**
 * Run Teachable Machine model 1 on an HTMLImageElement or canvas.
 * @param {HTMLImageElement|HTMLCanvasElement} element
 * @returns {Promise<Array<{className: string, probability: number}>>}
 */
export async function predictElement(element) {
  const model = await loadTeachableModel();
  return predictWithModel(model, element);
}

/**
 * Run Teachable Machine model 2 on an HTMLImageElement or canvas.
 * @param {HTMLImageElement|HTMLCanvasElement} element
 * @returns {Promise<Array<{className: string, probability: number}>>}
 */
export async function predictElement2(element) {
  const model = await loadTeachableModel2();
  return predictWithModel(model, element);
}

/**
 * Run a given TeachableMobileNet instance on an image element.
 * @param {object} model
 * @param {HTMLImageElement|HTMLCanvasElement} element
 * @returns {Promise<Array<{className: string, probability: number}>>}
 */
function predictWithModel(model, element) {
  if (!model || !element || !element.width) {
    throw new Error("Invalid image element for prediction.");
  }
  return model.predict(element);
}

/**
 * Run BOTH models on the same image element and merge their prediction
 * lists. Each model runs in its own try/catch so one failure never crashes
 * the other. Only throws when BOTH models produced nothing.
 * @param {HTMLImageElement|HTMLCanvasElement} element
 * @returns {Promise<Array<{className: string, probability: number}>>}
 */
export async function predictAllModels(element) {
  const results = [];

  const p1 = await predictElement(element).catch(() => null);
  if (p1) results.push(...p1);
  else {
    const p2 = await predictElement2(element).catch(() => null);
    if (p2) return p2;
    throw new Error(
      "Food recognition is temporarily unavailable. Please try again."
    );
  }

  try {
    const p2 = await predictElement2(element);
    if (p2 && p2.length) results.push(...p2);
  } catch {
    /* model 2 unavailable — model 1 results already returned above */
  }

  return results;
}

/**
 * Convenience: predict from an uploaded File/Blob (runs both models).
 * @param {File|Blob} file
 * @returns Promise<Array<{className, probability}>>
 */
export async function predictFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return await predictAllModels(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draw a File/Blob into an offscreen 224x224 canvas. */
export async function fileToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const resized = document.createElement("canvas");
    resized.width = 224;
    resized.height = 224;
    const ctx = resized.getContext("2d");
    ctx.drawImage(img, 0, 0, 224, 224);
    return resized;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load the image."));
    img.src = src;
  });
}

/** Clean up TF backends (call on unmount if desired). */
export async function disposeModel() {
  if (_model) {
    await _model.dispose?.();
    _model = null;
  }
  if (_model2) {
    await _model2.dispose?.();
    _model2 = null;
  }
}