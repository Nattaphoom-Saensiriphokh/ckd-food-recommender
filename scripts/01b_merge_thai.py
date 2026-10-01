import re
import numpy as np
import pandas as pd

THAI_OFFSET = 9_000_000   # กัน fdc_id ชนกับ USDA (ใช้แบ่งกลุ่มตอน train/test)
CORE = ["potassium_mg", "phosphorus_mg", "sodium_mg", "protein_g"]
SECONDARY = ["energy_kcal", "carb_g", "fat_g", "fiber_g", "sugar_g", "water_g"]

clean = pd.read_csv("data/foods_clean.csv")
if "source" not in clean.columns:
    clean["source"] = "usda"
clean = clean[clean["source"] == "usda"].copy()   # รันซ้ำได้: ตัดแถวไทยเดิมทิ้งก่อน
print("USDA:", len(clean), "แถว")

thai = pd.read_csv("data/raw/thai_foods_raw.csv")
print("Thai:", len(thai), "แถว")

# --- 1) เติม K/P/Na ที่ขาดจากอาหาร USDA ที่ใกล้เคียง (ตาม regex ใน proxy_usda) ---
for idx, row in thai[thai["proxy_usda"].notna()].iterrows():
    pat = re.compile(row["proxy_usda"], re.IGNORECASE)
    m = clean[clean["name"].apply(lambda s: bool(pat.search(s)))]
    print(f"proxy '{row['name'][:30]}': พบ {len(m)} รายการใน USDA")
    if m.empty:
        print("   !! ไม่พบ proxy แถวนี้จะถูกตัดทิ้งถ้า K/P/Na ยังขาด")
        continue
    for c in ["potassium_mg", "phosphorus_mg", "sodium_mg"]:
        if pd.isna(thai.at[idx, c]):
            thai.at[idx, c] = m[c].median()      # ใช้ median ของรายการที่ตรงทั้งหมด

# --- 2) แถวที่ยังขาดสารอาหารหลักให้ทิ้ง (เดาไม่ได้) ---
before = len(thai)
thai = thai.dropna(subset=CORE)
print(f"ตัดแถวไทยที่ขาดสารอาหารหลัก: {before - len(thai)} แถว เหลือ {len(thai)}")

# --- 3) สารอาหารรองที่ขาด: เติม median ของ USDA (วิธีเดียวกับ 01_build_dataset.py) ---
for c in SECONDARY:
    thai[c] = thai[c].fillna(clean[c].median())

# --- 4) จัดรูปให้ตรงกับตาราง USDA แล้วรวม ---
thai["fdc_id"] = thai["food_id"] + THAI_OFFSET
thai["source"] = "thai"
cols = list(clean.columns)
thai = thai.reindex(columns=cols)
merged = pd.concat([clean, thai], ignore_index=True)

print("\nรวมแล้ว:", len(merged), "แถว")
print(merged["source"].value_counts())
merged.to_csv("data/foods_clean.csv", index=False)
print("บันทึก data/foods_clean.csv แล้ว")
