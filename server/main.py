"""FastAPI สำหรับระบบแนะนำอาหารผู้ป่วยโรคไต (CKD)

รัน:   uvicorn server.main:app --reload
เอกสาร API อัตโนมัติ: http://127.0.0.1:8000/docs

ต้องมีไฟล์ก่อนรัน:
  model.pkl            (สร้างด้วย scripts/07_make_model_pkl.py)
  export/foods.json    (สร้างด้วย scripts/06_export_json.py)
  models/results.json  (สร้างด้วย scripts/03_train.py) - ใช้กับ /models
"""
import json
import pickle
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent

# ---------- โหลดโมเดลและข้อมูล ----------
with open(ROOT / "model.pkl", "rb") as f:
    BUNDLE = pickle.load(f)
MODEL = BUNDLE["model"]
FEATURES = BUNDLE["features"]
CLASSES = BUNDLE["classes"]
THRESH = BUNDLE["thresholds"]

with open(ROOT / "export" / "foods.json", encoding="utf-8") as f:
    DATA = json.load(f)
NUT = DATA["nutrients"]
NIDX = {n: i for i, n in enumerate(NUT)}
FOODS = DATA["foods"]
N = np.array([x["n"] for x in FOODS], dtype=float)          # ตารางสารอาหาร (อาหาร x สารอาหาร)
ID2IDX = {x["id"]: i for i, x in enumerate(FOODS)}

# พารามิเตอร์ kNN (ความคล้ายของอาหาร): log1p แล้ว standardize
SIM = DATA["sim_features"]
SIM_IDX = [NIDX[c] for c in SIM]
Z = (np.log1p(N[:, SIM_IDX]) - np.array(DATA["sim_mean"])) / np.array(DATA["sim_std"])
MAX_DIST = float(DATA.get("max_dist", float("inf")))
BAD_WORDS = DATA.get("bad_words", [])
BAD_RE = re.compile("|".join(r"\b" + re.escape(w) for w in BAD_WORDS), re.I) if BAD_WORDS else None

STAGE_TH = {1: "CKD ระยะ 1-2", 2: "CKD ระยะ 3-4", 3: "CKD ระยะ 5"}
COLOR_TH = {"green": "เหมาะสม", "yellow": "ควรจำกัดปริมาณ", "red": "ควรหลีกเลี่ยง"}
NUT_TH = {"potassium_mg": "โพแทสเซียม", "phosphorus_mg": "ฟอสฟอรัส",
          "sodium_mg": "โซเดียม", "protein_g": "โปรตีน"}

app = FastAPI(title="CKD Food Recommender API",
              description="ประเมินความเหมาะสมของอาหารสำหรับผู้ป่วยโรคไตเรื้อรัง (เพื่อการศึกษา ไม่ใช่คำแนะนำทางการแพทย์)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------- ฟังก์ชันช่วย ----------
def frame(rows: np.ndarray, stage: int) -> pd.DataFrame:
    cols = {f: (np.full(len(rows), stage) if f == "stage_group" else rows[:, NIDX[f]]) for f in FEATURES}
    return pd.DataFrame(cols)[FEATURES]


@lru_cache(maxsize=3)
def preds_for_stage(stage: int) -> np.ndarray:
    """ทำนายสีของอาหารทุกชนิดในระยะโรคนั้น (เก็บแคช)"""
    return MODEL.predict(frame(N, stage))


def reasons_for(nutrients: dict, stage: int):
    out = []
    for nut, (yellow, red) in THRESH[str(stage)].items():
        v = nutrients[nut]
        if v >= red:
            out.append({"nutrient": nut, "name_th": NUT_TH[nut], "level": "red", "value": v, "limit": red})
        elif v >= yellow:
            out.append({"nutrient": nut, "name_th": NUT_TH[nut], "level": "yellow", "value": v, "limit": yellow})
    return out


def check_stage(stage: int):
    if stage not in (1, 2, 3):
        raise HTTPException(422, "stage ต้องเป็น 1 (ระยะ 1-2), 2 (ระยะ 3-4) หรือ 3 (ระยะ 5)")


# ---------- schema ----------
class PredictIn(BaseModel):
    stage: int = Field(..., description="1=CKD ระยะ 1-2, 2=ระยะ 3-4, 3=ระยะ 5")
    food_id: Optional[int] = Field(None, description="รหัสอาหารในระบบ (ใช้อย่างใดอย่างหนึ่งกับ nutrients)")
    nutrients: Optional[dict[str, float]] = Field(
        None, description="สารอาหารต่ออาหาร 100 g: " + ", ".join(NUT))


# ---------- endpoints ----------
@app.get("/health")
def health():
    return {"status": "ok", "foods": len(FOODS), "model": type(MODEL).__name__}


@app.get("/foods/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=100)):
    ql = q.strip().lower()
    hits = [(x["name"].lower().find(ql), len(x["name"]), i) for i, x in enumerate(FOODS) if ql in x["name"].lower()]
    hits.sort()
    return [{"food_id": FOODS[i]["id"], "name": FOODS[i]["name"]} for _, _, i in hits[:limit]]


@app.post("/predict")
def predict(body: PredictIn):
    check_stage(body.stage)
    if (body.food_id is None) == (body.nutrients is None):
        raise HTTPException(422, "ระบุ food_id หรือ nutrients อย่างใดอย่างหนึ่งเท่านั้น")
    if body.food_id is not None:
        if body.food_id not in ID2IDX:
            raise HTTPException(404, "ไม่พบ food_id นี้")
        i = ID2IDX[body.food_id]
        name, row = FOODS[i]["name"], N[i]
    else:
        missing = [n for n in NUT if n not in body.nutrients]
        if missing:
            raise HTTPException(422, f"ขาดสารอาหาร: {', '.join(missing)}")
        name, row = None, np.array([body.nutrients[n] for n in NUT], dtype=float)
    nutrients = {n: float(row[NIDX[n]]) for n in NUT}
    color = CLASSES[int(MODEL.predict(frame(row.reshape(1, -1), body.stage))[0])]
    return {"name": name, "stage": body.stage, "stage_th": STAGE_TH[body.stage],
            "color": color, "color_th": COLOR_TH[color],
            "reasons": reasons_for(nutrients, body.stage), "nutrients": nutrients}


@app.get("/substitutes")
def substitutes(food_id: int, stage: int, k: int = Query(5, ge=1, le=20)):
    """อาหารทดแทน: kNN บนสัดส่วนพลังงาน/คาร์บ/ไขมัน/ใยอาหาร/น้ำ/โปรตีน แล้วกรองเฉพาะที่ Decision Tree ทำนายว่า 'เขียว'"""
    check_stage(stage)
    if food_id not in ID2IDX:
        raise HTTPException(404, "ไม่พบ food_id นี้")
    i = ID2IDX[food_id]
    preds = preds_for_stage(stage)
    dist = np.linalg.norm(Z - Z[i], axis=1)
    out, seen = [], set()
    for j in np.argsort(dist):
        if dist[j] > MAX_DIST:
            break
        if j == i or preds[j] != 0:
            continue
        name = FOODS[j]["name"]
        if BAD_RE and BAD_RE.search(name):
            continue
        key = name[:25].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"food_id": FOODS[j]["id"], "name": name, "distance": round(float(dist[j]), 3),
                    "potassium_mg": float(N[j, NIDX["potassium_mg"]]),
                    "phosphorus_mg": float(N[j, NIDX["phosphorus_mg"]]),
                    "sodium_mg": float(N[j, NIDX["sodium_mg"]])})
        if len(out) == k:
            break
    return {"query": FOODS[i]["name"], "stage": stage, "substitutes": out}


@app.get("/models")
def models():
    """ผลเปรียบเทียบโมเดล (Baseline, Decision Tree, kNN, ANN) จาก models/results.json"""
    p = ROOT / "models" / "results.json"
    if not p.exists():
        raise HTTPException(404, "ยังไม่มี models/results.json (รัน scripts/03_train.py ก่อน)")
    return json.loads(p.read_text(encoding="utf-8"))
