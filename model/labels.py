"""
HypoGuard AI - Labels configuration.

Central registry of all food classes the model is trained on.
This maps to the class names inside `dataset/train/` and the nutritional
database keys inside `nutrition/indian_foods.json`.

The model predicts an index -> label, then the backend looks up nutrition
by `label` (food name).
"""

# Ordered list of class labels. The index = the class id used in training.
# These MUST match the subfolder names in dataset/train/ (and validation/).
FOOD_CLASSES = [
    # Breads
    "Chapati", "Phulka", "Paratha", "Aloo Paratha", "Poori", "Bhatura", "Naan",
    # Rice
    "White Rice", "Brown Rice", "Jeera Rice", "Lemon Rice", "Pulao", "Khichdi",
    "Biryani", "Curd Rice",
    # Dal
    "Dal Tadka", "Moong Dal", "Masoor Dal", "Toor Dal", "Dal Makhani", "Chana Dal",
    # Sabzi
    "Aloo Gobi", "Bhindi", "Palak Paneer", "Paneer Butter Masala", "Mix Veg",
    "Baingan Bharta", "Pumpkin Curry", "Bottle Gourd", "Matar Paneer",
    "Cabbage Sabzi", "Cauliflower Sabzi",
    # South Indian
    "Idli", "Dosa", "Masala Dosa", "Medu Vada", "Uttapam", "Sambar", "Upma", "Pongal",
    # Snacks
    "Poha", "Samosa", "Kachori", "Pav Bhaji", "Bhel Puri", "Pani Puri", "Vada Pav", "Dhokla",
    # Fruits
    "Apple", "Banana", "Orange", "Papaya", "Guava", "Watermelon", "Mango",
    "Pomegranate", "Pineapple", "Grapes",
    # Vegetables
    "Tomato", "Potato", "Onion", "Carrot", "Beans", "Capsicum", "Spinach", "Peas",
    "Cucumber", "Brinjal",
    # Dairy
    "Milk", "Curd", "Paneer", "Buttermilk",
    # Others
    "Boiled Egg", "Omelette", "Chicken Curry", "Fish Curry", "Peanuts", "Sprouts",
]

# A label the model output maps to when confidence is too low.
UNKNOWN_FOOD = "Unknown Food"


def get_index_to_label_mapping():
    """Return a dict {index: class_name}."""
    return {i: name for i, name in enumerate(FOOD_CLASSES)}


def get_label_to_index_mapping():
    """Return a dict {class_name: index}."""
    return {name: i for i, name in enumerate(FOOD_CLASSES)}


def num_classes():
    """Convenience helper for the model output layer size."""
    return len(FOOD_CLASSES)