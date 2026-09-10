from model.predict import FoodPredictor

predictor = FoodPredictor()

image_path = input("Enter image path: ")

with open(image_path, "rb") as f:
    image_bytes = f.read()

result = predictor.predict_image_bytes(image_bytes)

print("\nPrediction Result\n")
print(result)