// web/lib/engine.js
// ตรรกะเดียวกับ scripts/06_export_json.py แต่รันในเบราว์เซอร์ (ไม่ต้องมี Python)

export const CLASSES = ["green", "yellow", "red"];

export const NUTRIENT_TH = {
  potassium_mg: "โพแทสเซียม",
  phosphorus_mg: "ฟอสฟอรัส",
  sodium_mg: "โซเดียม",
  protein_g: "โปรตีน",
};

export const STAGE_LABEL = {
  1: "CKD ระยะ 1-2",
  2: "CKD ระยะ 3-4",
  3: "CKD ระยะ 5",
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// โหลดข้อมูลจาก /public/data แล้วสร้าง engine
export async function loadEngine() {
  const [tree, data] = await Promise.all([
    fetch("/data/tree.json").then((r) => r.json()),
    fetch("/data/foods.json").then((r) => r.json()),
  ]);
  return buildEngine(tree, data);
}

export function buildEngine(tree, data) {
  const foods = data.foods;
  const nutIdx = {};
  data.nutrients.forEach((n, i) => (nutIdx[n] = i));

  // ตัวกรองของทดแทน: จับเฉพาะ "ต้นคำ" เหมือนฝั่ง Python (\b นำหน้า)
  const badRe = new RegExp(
    data.bad_words.map((w) => "\\b" + escapeRegExp(w)).join("|"),
    "i"
  );
  const maxDist = data.max_dist;

  // --- ทำนายสีด้วย Decision Tree ---
  function featureVector(food, stage) {
    return tree.features.map((f) =>
      f === "stage_group" ? stage : food.n[nutIdx[f]]
    );
  }

  function predict(food, stage) {
    const x = featureVector(food, stage);
    let n = 0;
    while (tree.left[n] !== -1) {
      const f = tree.feature[n];
      n = x[f] <= tree.threshold[n] ? tree.left[n] : tree.right[n];
    }
    return tree.value[n]; // 0=green 1=yellow 2=red
  }

  // cache ผลทำนายของทุกอาหารต่อระยะ (ใช้ตอนหาของทดแทน)
  const predCache = {};
  function predAll(stage) {
    if (!predCache[stage]) predCache[stage] = foods.map((f) => predict(f, stage));
    return predCache[stage];
  }

  // --- เหตุผล: สารอาหารไหนเกินเกณฑ์ ---
  function reasons(food, stage) {
    const th = tree.thresholds_by_stage[String(stage)];
    const out = [];
    for (const [nut, [yellow, red]] of Object.entries(th)) {
      const v = food.n[nutIdx[nut]];
      if (v >= red) out.push({ nutrient: nut, level: "red", value: v, limit: red });
      else if (v >= yellow) out.push({ nutrient: nut, level: "yellow", value: v, limit: yellow });
    }
    return out;
  }

  // --- kNN: เตรียมเวกเตอร์ความคล้าย (log1p แล้ว standardize) ---
  let Z = null;
  function simVectors() {
    if (!Z) {
      Z = foods.map((f) =>
        data.sim_features.map((c, k) =>
          (Math.log1p(f.n[nutIdx[c]]) - data.sim_mean[k]) / data.sim_std[k]
        )
      );
    }
    return Z;
  }

  function substitutes(i, stage, k = 5) {
    const vecs = simVectors();
    const preds = predAll(stage);
    const q = vecs[i];

    const dists = [];
    for (let j = 0; j < foods.length; j++) {
      if (j === i || preds[j] !== 0) continue; // เอาเฉพาะสีเขียว
      if (badRe.test(foods[j].name)) continue;
      let s = 0;
      for (let d = 0; d < q.length; d++) {
        const diff = vecs[j][d] - q[d];
        s += diff * diff;
      }
      const dist = Math.sqrt(s);
      if (dist <= maxDist) dists.push({ j, dist });
    }
    dists.sort((a, b) => a.dist - b.dist);

    const seen = new Set();
    const result = [];
    for (const { j, dist } of dists) {
      const key = foods[j].name.slice(0, 25).toLowerCase(); // กันชื่อซ้ำ
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ index: j, food: foods[j], dist });
      if (result.length === k) break;
    }
    return result; // ว่าง = ไม่มีของทดแทนที่คล้ายพอ
  }

  // --- ค้นหาอาหารตามชื่อ ---
  function search(query, limit = 20) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits = [];
    for (let i = 0; i < foods.length; i++) {
      const name = foods[i].name.toLowerCase();
      const pos = name.indexOf(q);
      if (pos !== -1) hits.push({ i, pos });
    }
    // ตรงต้นชื่อก่อน แล้วเรียงตามความยาวชื่อ (สั้น = ใกล้เคียงกว่า)
    hits.sort((a, b) => a.pos - b.pos || foods[a.i].name.length - foods[b.i].name.length);
    return hits.slice(0, limit).map((h) => h.i);
  }

  function nutrient(food, key) {
    return food.n[nutIdx[key]];
  }

  return { foods, predict, reasons, substitutes, search, nutrient };
}
