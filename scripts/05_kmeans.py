import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.decomposition import PCA

SEED = 42
NUT = ["protein_g", "energy_kcal", "carb_g", "fat_g", "fiber_g", "sugar_g",
       "water_g", "potassium_mg", "phosphorus_mg", "sodium_mg"]

df = pd.read_csv("data/foods_clean.csv")
# foods_clean.csv มีคอลัมน์ source (usda/thai) จาก 01b_merge_thai.py อยู่แล้ว ห้ามเขียนทับ
if "source" not in df.columns:
    df["source"] = "usda"

# 1) log1p ลดความเบ้ แล้ว scale
Xs = StandardScaler().fit_transform(np.log1p(df[NUT]))

# 2) ลอง k = 2..12 วัด inertia (Elbow) และ silhouette

ks = list(range(2, 13))
inertias, sils = [], []
for k in ks:
    km = KMeans(n_clusters=k, n_init=10, random_state=SEED).fit(Xs)
    inertias.append(km.inertia_)
    sils.append(silhouette_score(Xs, km.labels_, sample_size=3000, random_state=SEED))
    print(f"k={k:>2}  inertia={km.inertia_:,.0f}  silhouette={sils[-1]:.3f}")

fig, ax = plt.subplots(1, 2, figsize=(11, 4))
ax[0].plot(ks, inertias, "o-"); ax[0].set_title("Elbow (inertia)"); ax[0].set_xlabel("k")
ax[1].plot(ks, sils, "o-");     ax[1].set_title("Silhouette");     ax[1].set_xlabel("k")
plt.tight_layout(); plt.savefig("models/kmeans_selection.png", dpi=130)

# 3) เลือก k ที่ silhouette สูงสุดในช่วง 4..10 (แก้เองได้หลังดูกราฟ)
cand = [(s, k) for k, s in zip(ks, sils) if 4 <= k <= 10]
K = max(cand)[1]
print(f"\nเลือก k = {K}")

km = KMeans(n_clusters=K, n_init=10, random_state=SEED).fit(Xs)
df["cluster"] = km.labels_

# 4) ดูโปรไฟล์ของแต่ละกลุ่ม เพื่อตั้งชื่อกลุ่ม
prof = df.groupby("cluster")[NUT].median().round(1)
prof.insert(0, "n_foods", df.groupby("cluster").size())
print("\nโปรไฟล์กลุ่ม (ค่ามัธยฐานต่อ 100 g):\n", prof.to_string())
prof.to_csv("models/kmeans_profile.csv")

print("\nตัวอย่างอาหารในแต่ละกลุ่ม:")
for c in range(K):
    names = df[df.cluster == c]["name"].sample(5, random_state=SEED).tolist()
    print(f"  กลุ่ม {c}:", " | ".join(n[:35] for n in names))


# 5) กราฟกระจาย 2 มิติ (PCA) ไว้ใส่รายงาน
p = PCA(n_components=2, random_state=SEED).fit_transform(Xs)
plt.figure(figsize=(7, 6))
plt.scatter(p[:, 0], p[:, 1], c=df["cluster"], s=4, cmap="tab10")
plt.title(f"k-means (k={K}) บนแผน PCA"); plt.xlabel("PC1"); plt.ylabel("PC2")
plt.savefig("models/kmeans_pca.png", dpi=130, bbox_inches="tight")

df.to_csv("data/foods_clustered.csv", index=False)
joblib.dump(km, "models/kmeans.joblib")
print("\nบันทึก data/foods_clustered.csv และกราฟแล้ว")