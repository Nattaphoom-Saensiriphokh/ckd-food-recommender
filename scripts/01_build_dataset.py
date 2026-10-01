import pandas as pd
from pathlib import Path

RAW = Path("data/raw")

# รหัสสารอาหารของ USDA -> ชื่อคอลัมน์ที่เราใช้ (features)
NUTRIENTS = {
    1003: "protein_g",
    1008: "energy_kcal",
    1005: "carb_g",
    1004: "fat_g",
    1079: "fiber_g",
    2000: "sugar_g",
    1051: "water_g",
    1092: "potassium_mg",
    1091: "phosphorus_mg",
    1093: "sodium_mg",
}

food = pd.read_csv(RAW / "food.csv", usecols=["fdc_id", "description"])
fn = pd.read_csv(RAW / "food_nutrient.csv", usecols=["fdc_id", "nutrient_id", "amount"])

# 1) เก็บเฉพาะสารอาหารที่เราสนใจ
fn = fn[fn["nutrient_id"].isin(NUTRIENTS)]

# 2) pivot: long -> wide
wide = (
    fn.pivot_table(index="fdc_id", columns="nutrient_id", values="amount", aggfunc="mean")
    .rename(columns=NUTRIENTS)
    .reset_index()
)

df = food.merge(wide, on="fdc_id").rename(columns={"description": "name"})
print("จำนวนอาหารก่อนทำความสะอาด:", len(df))
print("\nMissing values ต่อคอลัมน์:\n", df.isna().sum())

# 3) Data cleaning
# - สารอาหารหลักที่ใช้ตัดสิน label (K, P, Na, protein) ถ้าขาดให้ทิ้ง เพราะเดาไม่ได้
core = ["potassium_mg", "phosphorus_mg", "sodium_mg", "protein_g"]
df = df.dropna(subset=core)

# - สารอาหารรอง ที่ขาดให้เติมด้วย median
for col in ["energy_kcal", "carb_g", "fat_g", "fiber_g", "sugar_g", "water_g"]:
    df[col] = df[col].fillna(df[col].median())

# - ตัดแถวที่ค่าติดลบ (ข้อมูลผิดพลาด)
num_cols = list(NUTRIENTS.values())
df = df[(df[num_cols] >= 0).all(axis=1)]

print("\nจำนวนอาหารหลังทำความสะอาด:", len(df))
df.to_csv("data/foods_clean.csv", index=False)
print("บันทึก data/foods_clean.csv แล้ว")