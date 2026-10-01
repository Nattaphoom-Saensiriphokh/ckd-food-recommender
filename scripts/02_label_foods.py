import pandas as pd

df = pd.read_csv("data/foods_clean.csv")

# เกณฑ์ (เหลือง, แดง) ต่อ 100 g แยกตามกลุ่มระยะโรค
# *** ตัวเลขเป็นค่าตัวอย่างสำหรับโปรเจกต์การศึกษา ต้องให้นักกำหนดอาหาร/แพทย์ยืนยันก่อนใช้จริง ***
THRESH = {
    1: {"potassium_mg": (350, 500), "phosphorus_mg": (200, 300), "sodium_mg": (400, 800), "protein_g": (20, 30)},
    2: {"potassium_mg": (250, 400), "phosphorus_mg": (150, 250), "sodium_mg": (300, 600), "protein_g": (15, 25)},
    3: {"potassium_mg": (200, 300), "phosphorus_mg": (120, 200), "sodium_mg": (200, 400), "protein_g": (12, 20)},
}

def label_row(row):
    level, reasons = 0, []
    for nut, (yellow, red) in THRESH[row["stage_group"]].items():
        if row[nut] >= red:
            level = 2
            reasons.append(f"{nut} สูงมาก")
        elif row[nut] >= yellow:
            level = max(level, 1)
            reasons.append(f"{nut} สูง")
    return pd.Series({"label": ["green", "yellow", "red"][level], "reason": "; ".join(reasons)})

# สร้างแถวของทุกอาหาร x ทุกกลุ่มระยะโรค (cross join)
groups = pd.DataFrame({"stage_group": [1, 2, 3]})
data = df.merge(groups, how="cross")
data = pd.concat([data, data.apply(label_row, axis=1)], axis=1)

print(data["label"].value_counts())
print(data.groupby("stage_group")["label"].value_counts(normalize=True).round(2))
data.to_csv("data/foods_labeled.csv", index=False)
print("บันทึก data/foods_labeled.csv แล้ว")