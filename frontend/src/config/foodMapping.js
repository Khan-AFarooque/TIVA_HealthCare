import nutritionData from "../data/indian_foods.json";

/**
 * Teachable Machine model 1 metadata (25 Indian food classes).
 * IMPORTANT: these exact keys come from `metadata.json` labels and MUST match
 * the trained classes (spelling + separators, e.g. `litti_choka`,
 * `sohan-papadi`, `butter_chicken`).
 */
export const TM_LABELS = [
  "aloo_tikki",
  "basundi",
  "bhatura",
  "butter_chicken",
  "chana_masala",
  "chapati",
  "chicken_tikka",
  "chikki",
  "dal_makhani",
  "gajar_ka_halwa",
  "gulab_jamun",
  "jalebi",
  "kachori",
  "kadai_paneer",
  "lassi",
  "litti_choka",
  "naan",
  "palak_paneer",
  "paneer_butter_masala",
  "poha",
  "ras_malai",
  "sheera",
  "shrikhand",
  "sohan-papadi",
  "unni_appam",
];

/**
 * Teachable Machine model 2 metadata (25 Indian food classes).
 * These exact keys come from `food-model-2/metadata.json` labels.
 */
export const TM_LABELS_2 = [
  "aloo_methi",
  "apple fruit",
  "banana fruit",
  "bhindi_masala",
  "biryani",
  "boondi",
  "cherry fruit",
  "chickoo fruit",
  "dum_aloo",
  "ghevar",
  "grapes fruit",
  "kadhi_pakoda",
  "kalakand",
  "karela_bharta",
  "mango fruit",
  "mysore_pak",
  "rabri",
  "shankarpali",
  "strawberry fruit",
  "orange fruit",
  "modak",
  "anarsa",
  "dal_tadka",
  "kiwi fruit",
  "kofta",
];

/** Combined class label list (Model 1 + Model 2 = 50 classes). */
export const ALL_TM_LABELS = [...TM_LABELS, ...TM_LABELS_2];

/**
 * Display names for each Teachable Machine model 2 class label.
 * The keys are the raw class labels (spaced format from `metadata.json`);
 * the values are what we show in the UI.
 */
export const DISPLAY_NAMES_2 = {
  aloo_methi: "Aloo Methi",
  "apple fruit": "Apple",
  "banana fruit": "Banana",
  bhindi_masala: "Bhindi Masala",
  biryani: "Biryani",
  boondi: "Boondi",
  "cherry fruit": "Cherry",
  "chickoo fruit": "Chickoo",
  dum_aloo: "Dum Aloo",
  ghevar: "Ghevar",
  "grapes fruit": "Grapes",
  kadhi_pakoda: "Kadhi Pakoda",
  kalakand: "Kalakand",
  karela_bharta: "Karela Bharta",
  "mango fruit": "Mango",
  mysore_pak: "Mysore Pak",
  rabri: "Rabri",
  shankarpali: "Shankarpali",
  "strawberry fruit": "Strawberry",
  "orange fruit": "Orange",
  modak: "Modak",
  anarsa: "Anarsa",
  dal_tadka: "Dal Tadka",
  "kiwi fruit": "Kiwi",
  kofta: "Kofta",
};

/**
 * Display names for each Teachable Machine class label.
 * The keys are the raw class labels; the values are what we show in the UI.
 */
export const DISPLAY_NAMES = {
  aloo_tikki: "Aloo Tikki",
  basundi: "Basundi",
  bhatura: "Bhatura",
  butter_chicken: "Butter Chicken",
  chana_masala: "Chana Masala",
  chapati: "Chapati",
  chicken_tikka: "Chicken Tikka",
  chikki: "Chikki",
  dal_makhani: "Dal Makhani",
  gajar_ka_halwa: "Gajar Ka Halwa",
  gulab_jamun: "Gulab Jamun",
  jalebi: "Jalebi",
  kachori: "Kachori",
  kadai_paneer: "Kadai Paneer",
  lassi: "Lassi",
  litti_choka: "Litti Chokha",
  naan: "Naan",
  palak_paneer: "Palak Paneer",
  paneer_butter_masala: "Paneer Butter Masala",
  poha: "Poha",
  ras_malai: "Ras Malai",
  sheera: "Sheera",
  shrikhand: "Shrikhand",
  "sohan-papadi": "Sohan Papdi",
  unni_appam: "Unni Appam",
  ...DISPLAY_NAMES_2,
};

/**
 * Robust normalizer: lowercases, trims, and collapses any run of
 * whitespace/underscores/hyphens/etc into a single space so that
 * "Paneer Butter Masala", "paneer_butter_masala" and "Paneer-Butter-Masala"
 * all resolve to the same key.
 */
export const normalizeKey = (key) =>
  String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Pre-normalized nutrition DB index for fast lookups. */
const NUTRITION_INDEX = new Map(
  nutritionData.foods.map((f) => [normalizeKey(f.name), f])
);

/**
 * Canonical mapping: Teachable Machine class -> nutrition DB food name.
 * Kept explicit so foods that genuinely exist in the DB always resolve
 * regardless of case/spacer/separator differences. Model 2 labels use the
 * spaced format that `food-model-2/metadata.json` reports.
 */
const FOOD_CLASS_TO_DB_NAME = {
  /* --- Model 1 --- */
  bhatura: "Bhatura",
  chapati: "Chapati",
  dal_makhani: "Dal Makhani",
  kachori: "Kachori",
  naan: "Naan",
  palak_paneer: "Palak Paneer",
  paneer_butter_masala: "Paneer Butter Masala",
  poha: "Poha",
  /* --- Model 2 --- */
  "apple fruit": "Apple",
  "banana fruit": "Banana",
  bhindi_masala: "Bhindi",
  biryani: "Biryani",
  "dal_tadka": "Dal Tadka",
  "grapes fruit": "Grapes",
  "mango fruit": "Mango",
  "orange fruit": "Orange",
};

/** Look up a nutrition record by food name (case/spacing/separator tolerant). */
export function getNutritionByName(foodName) {
  if (!foodName) return null;
  return NUTRITION_INDEX.get(normalizeKey(foodName)) || null;
}

/**
 * Maps a Teachable Machine raw class label to its nutrition DB record.
 * Resolves the class through the explicit canonical map first, then falls
 * back to the display name as a tolerant key. Returns null when the food
 * genuinely has no record in `indian_foods.json`.
 */
export function getNutritionForClass(tmClassKey) {
  const dbName = FOOD_CLASS_TO_DB_NAME[tmClassKey] || DISPLAY_NAMES[tmClassKey];
  if (!dbName) return null;
  return getNutritionByName(dbName);
}

/**
 * Maps a Teachable Machine raw class label to a full prediction result.
 * - adds display name
 * - attaches nutrition record when one legitimately exists
 * - otherwise `nutrition` is null so the UI can show "Nutrition data unavailable".
 */
export function mapTmClassToResult(tmClassKey, confidence) {
  const display = DISPLAY_NAMES[tmClassKey] || tmClassKey;
  const nutrition = getNutritionForClass(tmClassKey);
  return {
    tm_class: tmClassKey,
    food_name: display,
    confidence,
    nutrition,
  };
}

/** True when a predicted food has nutrition data in the JSON DB. */
export function hasNutrition(tmClassKey) {
  return getNutritionForClass(tmClassKey) !== null;
}

/** Number of modeled classes (50 = 25 + 25) and count with nutrition coverage. */
export const nutritionCoverage =
  ALL_TM_LABELS.filter((l) => hasNutrition(l)).length;
export const MODEL_CLASS_COUNT = ALL_TM_LABELS.length;

export { nutritionData };