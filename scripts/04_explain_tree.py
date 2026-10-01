import joblib
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import GroupShuffleSplit
from sklearn.tree import DecisionTreeClassifier, export_text, plot_tree
from sklearn.metrics import accuracy_score, recall_score, confusion_matrix

SEED = 42
FEATURES = ["potassium_mg", "phosphorus_mg", "sodium_mg", "protein_g", "energy_kcal",
            "carb_g", "fat_g", "fiber_g", "sugar_g", "water_g", "stage_group"]
CLASSES = ["green", "yellow", "red"]
label_map = {c: i for i, c in enumerate(CLASSES)}

data = pd.read_csv("data/foods_labeled.csv")
X = data[FEATURES]
y = data["label"].map(label_map)
groups = data["fdc_id"]

# ใช้การแบ่งแบบเดิม (seed เดิม) เพื่อเทียบกับโมเดลก่อนหน้าได้อย่างยุติธรรม
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
tr, te = next(gss.split(X, y, groups))
X_train, X_test, y_train, y_test = X.iloc[tr], X.iloc[te], y.iloc[tr], y.iloc[te]

# ลองหลายความลึก เพื่อดูว่าความอ่านง่ายแลกกับความแม่นยำเท่าไร
print("depth | accuracy | red_recall | แดง->เขียว")
for depth in [3, 4, 5, 6, 8]:
    dt = DecisionTreeClassifier(max_depth=depth, class_weight="balanced",
                                random_state=SEED).fit(X_train, y_train)
    pred = dt.predict(X_test)
    cm = confusion_matrix(y_test, pred)
    print(f"{depth:>5} | {accuracy_score(y_test, pred):.3f}    | "
          f"{recall_score(y_test, pred, labels=[2], average=None)[0]:.3f}      | {cm[2][0]}")


# เลือกความลึก 5 เป็นตัวอย่างสำหรับ Explainability (ปรับได้หลังดูตาราง)
DEPTH = 6
dt = DecisionTreeClassifier(max_depth=DEPTH, class_weight="balanced",
                            random_state=SEED).fit(X_train, y_train)
rules = export_text(dt, feature_names=FEATURES, max_depth=DEPTH)
open("models/dt_rules_readable.txt", "w", encoding="utf-8").write(rules)
joblib.dump(dt, "models/DecisionTree_readable.joblib")
print("\n", rules[:2500])

plt.figure(figsize=(26, 12))
plot_tree(dt, feature_names=FEATURES, class_names=CLASSES, filled=True,
          max_depth=3, fontsize=7)
plt.savefig("models/dt_tree.png", dpi=130, bbox_inches="tight")
print("บันทึก models/dt_rules_readable.txt และ models/dt_tree.png แล้ว")