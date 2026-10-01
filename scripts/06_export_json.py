import json
import os
import re
import shutil
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier

os.makedirs("export", exist_ok=True)

SEED = 42
FEATURES = ["potassium_mg", "phosphorus_mg", "sodium_mg", "protein_g", "energy_kcal",
            "carb_g", "fat_g", "fiber_g", "sugar_g", "water_g", "stage_group"]
NUT = ["protein_g", "energy_kcal", "carb_g", "fat_g", "fiber_g", "sugar_g",
       "water_g", "potassium_mg", "phosphorus_mg", "sodium_mg"]
CLASSES = ["green", "yellow", "red"]
SIM = ["energy_kcal", "carb_g", "fat_g", "fiber_g", "water_g", "protein_g"]

# ตัวกรองของทดแทน (ใช้ตัวเดียวกันทั้ง Python และ JS)
# จับเฉพาะ "ต้นคำ" (\b นำหน้า) เพื่อไม่ให้ "oil" ไปตรงกับ "boiled"
BAD = ["canned", "syrup", "frozen", "babyfood", "sweetened", "fat,", "skin",
       "bacon", "lard", "variety meats", "by-products", "belly", "agutuk",
       "oil", "butter", "cream,", "alaska native", "alaska native", "dehydrated", "jellies"]
BAD_RE = re.compile("|".join(r"\b" + re.escape(w) for w in BAD), re.IGNORECASE)
MAX_DIST = 1.0   # ไกลกว่านี้ถือว่าไม่คล้ายพอ

# เกณฑ์เดียวกับ 02_label_foods.py (ถ้าแก้ที่นั่น ต้องแก้ที่นี่ด้วย)
THRESH = {
    "1": {"potassium_mg": [350, 500], "phosphorus_mg": [200, 300], "sodium_mg": [400, 800], "protein_g": [20, 30]},
    "2": {"potassium_mg": [250, 400], "phosphorus_mg": [150, 250], "sodium_mg": [300, 600], "protein_g": [15, 25]},
    "3": {"potassium_mg": [200, 300], "phosphorus_mg": [120, 200], "sodium_mg": [200, 400], "protein_g": [12, 20]},
}

# ---------- 1) Decision Tree (ไม่ใช้ scaler) -> JSON ----------
data = pd.read_csv("data/foods_labeled.csv")
X = data[FEATURES]
y = data["label"].map({c: i for i, c in enumerate(CLASSES)})

# พารามิเตอร์ตรงกับที่ GridSearchCV เลือกใน 03_train.py (max_depth=None, min_samples_leaf=1)
dt = DecisionTreeClassifier(class_weight="balanced", random_state=SEED).fit(X, y)
t = dt.tree_
tree = {
    "features": FEATURES,
    "classes": CLASSES,
    "left": t.children_left.tolist(),
    "right": t.children_right.tolist(),
    "feature": t.feature.tolist(),
    "threshold": [float(v) for v in t.threshold],
    "value": [int(np.argmax(v)) for v in t.value[:, 0, :]],
    "thresholds_by_stage": THRESH,
}
print("จำนวน node ของ tree:", len(tree["left"]))


# ตรวจว่าตรรกะที่จะใช้ใน JS ให้ผลตรงกับ sklearn
def predict_row(r):
    n = 0
    while tree["left"][n] != -1:
        f = tree["feature"][n]
        n = tree["left"][n] if r[f] <= tree["threshold"][n] else tree["right"][n]
    return tree["value"][n]


mine = np.array([predict_row(r) for r in X.values])
agree = (mine == dt.predict(X)).mean()
print(f"ผลตรงกับ sklearn: {agree*100:.2f}%")

with open("export/tree.json", "w", encoding="utf-8") as f:
    json.dump(tree, f)

# ---------- 2) ตารางอาหารสำหรับเว็บ + พารามิเตอร์ kNN ----------
foods = pd.read_csv("data/foods_clustered.csv")
logsim = np.log1p(foods[SIM])
mean, std = logsim.mean(), logsim.std(ddof=0)

out = {
    "nutrients": NUT,
    "sim_features": SIM,
    "sim_mean": [float(mean[c]) for c in SIM],
    "sim_std": [float(std[c]) for c in SIM],
    "bad_words": BAD,
    "max_dist": MAX_DIST,
    "foods": [
        {"id": int(r.fdc_id), "name": r.name, "cluster": int(r.cluster),
         "src": r.source, "n": [round(float(getattr(r, c)), 2) for c in NUT]}
        for r in foods.itertuples()
    ],
}
with open("export/foods.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)

shutil.copy("models/results.json", "export/results.json")
shutil.copy("models/dt_rules_readable.txt", "export/dt_rules_readable.txt")
pd.read_csv("models/kmeans_profile.csv").to_json("export/cluster_profile.json", orient="records")
print("บันทึกไฟล์ใน export/ แล้ว")

# ---------- 3) ทดสอบ kNN แนะนำอาหารทดแทน (ตรรกะเดียวกับที่จะใช้บนเว็บ) ----------
Z = ((logsim - mean) / std).values


def ok(name):
    return not BAD_RE.search(name)


def substitutes(query, stage, k=5):
    hit = foods[foods["name"].str.contains(query, case=False, regex=False)]
    if hit.empty:
        print(f"ไม่พบ '{query}'")
        return
    i = hit.index[0]
    Fx = foods[FEATURES[:-1]].copy()
    Fx["stage_group"] = stage
    pred = dt.predict(Fx)
    dist = np.linalg.norm(Z - Z[i], axis=1)

    seen, order = set(), []
    for j in np.argsort(dist):
        if dist[j] > MAX_DIST:
            break
        if j == i or pred[j] != 0 or not ok(foods.loc[j, "name"]):
            continue
        key = foods.loc[j, "name"][:25].lower()   # กันชื่อซ้ำ
        if key in seen:
            continue
        seen.add(key)
        order.append(j)
        if len(order) == k:
            break

    if not order:
        print(f"\n[{foods.loc[i,'name']}] สี={CLASSES[pred[i]]} (ระยะกลุ่ม {stage}) -> ไม่มีของทดแทนที่คล้ายพอ")
        return

    print(f"\n[{foods.loc[i,'name']}] สี={CLASSES[pred[i]]} (ระยะกลุ่ม {stage})  -> ทดแทนด้วย:")
    for j in order:
        r = foods.loc[j]
        print(f"   {r['name'][:45]:<45} K={r.potassium_mg:.0f} P={r.phosphorus_mg:.0f} Na={r.sodium_mg:.0f}  d={dist[j]:.2f}")


for q in ["Cheese, cheddar", "Bananas, raw", "Potatoes, baked"]:
    substitutes(q, stage=3)