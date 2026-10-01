import json
import joblib
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GroupShuffleSplit, GroupKFold, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import classification_report, confusion_matrix, f1_score, accuracy_score

SEED = 42
FEATURES = ["potassium_mg", "phosphorus_mg", "sodium_mg", "protein_g", "energy_kcal",
            "carb_g", "fat_g", "fiber_g", "sugar_g", "water_g", "stage_group"]
CLASSES = ["green", "yellow", "red"]          # 0, 1, 2
label_map = {c: i for i, c in enumerate(CLASSES)}

data = pd.read_csv("data/foods_labeled.csv")
X = data[FEATURES]
y = data["label"].map(label_map)
groups = data["fdc_id"]

# 1) แบ่ง train / test ตามอาหาร (80/20) ไม่ให้อาหารเดียวกันอยู่ทั้งสองฝั่ง
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
tr, te = next(gss.split(X, y, groups))
X_train, X_test, y_train, y_test = X.iloc[tr], X.iloc[te], y.iloc[tr], y.iloc[te]
g_train = groups.iloc[tr]
print(f"train={len(X_train)} test={len(X_test)}")

# 2) นิยามโมเดล + พารามิเตอร์ที่จะลอง
def pipe(clf):

    return Pipeline([("scaler", StandardScaler()), ("clf", clf)])

models = {
    "DecisionTree": (
        pipe(DecisionTreeClassifier(class_weight="balanced", random_state=SEED)),
        {"clf__max_depth": [3, 5, 8, None], "clf__min_samples_leaf": [1, 5, 20]},
    ),
    "kNN": (
        pipe(KNeighborsClassifier()),
        {"clf__n_neighbors": [3, 5, 11, 21], "clf__weights": ["uniform", "distance"]},
    ),
    "ANN": (
        pipe(MLPClassifier(max_iter=800, random_state=SEED)),
        {"clf__hidden_layer_sizes": [(16,), (32, 16)], "clf__alpha": [1e-4, 1e-2]},
    ),
}

results = {}

# 3) Baseline: ทายคลาสที่พบบ่อยสุดเสมอ
base = DummyClassifier(strategy="most_frequent").fit(X_train, y_train)
bp = base.predict(X_test)
results["Baseline"] = {"accuracy": accuracy_score(y_test, bp),
                       "f1_macro": f1_score(y_test, bp, average="macro")}

# 4) เทรน + ปรับพารามิเตอร์ + ประเมินบน test
for name, (model, grid) in models.items():
    gs = GridSearchCV(model, grid, cv=GroupKFold(n_splits=5), scoring="f1_macro", n_jobs=-1)
    gs.fit(X_train, y_train, groups=g_train)
    best = gs.best_estimator_
    pred = best.predict(X_test)


    print(f"\n===== {name} =====")
    print("best params:", gs.best_params_)
    print("CV f1_macro:", round(gs.best_score_, 4))
    print(classification_report(y_test, pred, target_names=CLASSES, digits=3))
    cm = confusion_matrix(y_test, pred)
    print("confusion matrix (แถว=จริง, คอลัมน์=ทำนาย):\n", cm)

    rep = classification_report(y_test, pred, target_names=CLASSES, output_dict=True)
    results[name] = {
        "best_params": {k: str(v) for k, v in gs.best_params_.items()},
        "cv_f1_macro": gs.best_score_,
        "accuracy": accuracy_score(y_test, pred),
        "f1_macro": f1_score(y_test, pred, average="macro"),
        "red_recall": rep["red"]["recall"],
        "confusion_matrix": cm.tolist(),
    }
    joblib.dump(best, f"models/{name}.joblib")

    if name == "DecisionTree":
        rules = export_text(best.named_steps["clf"], feature_names=FEATURES)
        open("models/dt_rules.txt", "w", encoding="utf-8").write(rules)

json.dump(results, open("models/results.json", "w"), indent=2)
print("\nบันทึกโมเดลและ results.json แล้ว")