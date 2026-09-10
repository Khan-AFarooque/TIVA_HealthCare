from icrawler.builtin import BingImageCrawler
import os

foods = [
    "Chapati","Phulka","Paratha","Aloo Paratha","Poori","Bhatura","Naan",
    "White Rice","Brown Rice","Jeera Rice","Lemon Rice","Vegetable Pulao","Khichdi","Biryani","Curd Rice",
    "Dal Tadka","Moong Dal","Masoor Dal","Toor Dal","Dal Makhani","Chana Dal",
    "Aloo Gobi","Bhindi","Palak Paneer","Paneer Butter Masala","Mix Veg","Baingan Bharta",
    "Pumpkin Curry","Bottle Gourd Curry","Matar Paneer","Cabbage Sabzi","Cauliflower Sabzi",
    "Idli","Dosa","Masala Dosa","Medu Vada","Uttapam","Sambar","Upma","Pongal",
    "Poha","Samosa","Kachori","Pav Bhaji","Bhel Puri","Pani Puri","Vada Pav","Dhokla",
    "Apple","Banana","Orange","Papaya","Guava","Watermelon","Mango","Pomegranate","Pineapple","Grapes",
    "Tomato","Potato","Onion","Carrot","Beans","Capsicum","Spinach","Peas","Cucumber","Brinjal",
    "Milk","Curd","Paneer","Buttermilk",
    "Boiled Egg","Omelette","Chicken Curry","Fish Curry","Peanuts","Sprouts"
]

base_dir = "dataset/train"

for food in foods:
    save_dir = os.path.join(base_dir, food)

    os.makedirs(save_dir, exist_ok=True)

    print(f"Downloading {food}...")

    crawler = BingImageCrawler(storage={'root_dir': save_dir})

    crawler.crawl(
        keyword=f"{food} indian food",
        max_num=200
    )

print("Dataset download completed.")