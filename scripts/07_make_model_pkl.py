"""สร้าง model.pkl (โมเดลสุดท้ายที่ใช้จริง) สำหรับ FastAPI

โมเดลสุดท้าย = Decision Tree (ไม่ใช้ scaler) เทรนบนข้อมูลทั้งหมด
ตัวเลขประเมินผล (accuracy ฯลฯ) ให้ใช้จาก models/results.json ซึ่งมาจากตัวที่เทรนบน 80%
"""
import pickle
import pandas as pd
from sklearn.tree import DecisionTreeClassifier

SEED = 42
FEATURES = ["potassium_mg", "phosphorus_mg", "sodium_mg", "protein_g", "energy_kcal",
            "carb_g", "fat_g", "fiber_g", "sugar_g", "water_g", "stage_group"]
CLASSES = ["green", "yellow", "red"]

# เกณฑ์เดียวกับ 02_label_foods.py (ถ้าแก้ที่นั่น ต้องแก้ที่นี่ด้วย)
THRESH = {
    "1": {"potassium_mg": [350, 500], "phosphorus_mg": [200, 300], "sodium_mg": [400, 800], "protein_g": [20, 30]},
    "2": {"potassium_mg": [250, 400], "phosphorus_mg": [150, 250], "sodium_mg": [300, 600], "protein_g": [15, 25]},
    "3": {"potassium_mg": [200, 300], "phosphorus_mg": [120, 200], "sodium_mg": [200, 400], "protein_g": [12, 20]},
}

data = pd.read_csv("data/foods_labeled.csv")
X = data[FEATURES]
y = data["label"].map({c: i for i, c in enumerate(CLASSES)})

model = DecisionTreeClassifier(class_weight="balanced", random_state=SEED).fit(X, y)
print("train accuracy (ข้อมูลที่เห็นแล้ว ห้ามใช้รายงานเป็นผลประเมิน):", round(model.score(X, y), 4))

bundle = {"model": model, "features": FEATURES, "classes": CLASSES, "thresholds": THRESH}
with open("model.pkl", "wb") as f:
    pickle.dump(bundle, f)
print("บันทึก model.pkl แล้ว")
