"use client";
import "../theme.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../../lib/Header";
import Gauge, { Legend } from "../../lib/Gauge";
import { useStage } from "../../lib/useStage";
import { loadLimits } from "../../lib/limits";
import { loadEngine, STAGE_LABEL, NUTRIENT_TH } from "../../lib/engine";
import { TAGS, TAG_TH, tagsOf } from "../../lib/tags";

const ORDER = ["potassium_mg", "phosphorus_mg", "sodium_mg", "protein_g"];
const UNIT = { potassium_mg: "mg", phosphorus_mg: "mg", sodium_mg: "mg", protein_g: "g" };
const VERDICT = [
  { k: "g", label: "เหมาะสม" },
  { k: "y", label: "ควรจำกัดปริมาณ" },
  { k: "r", label: "ควรหลีกเลี่ยง" },
];
const PAGE = 12;

// กติกาจัดอันดับ "อาหารแนะนำ" (แก้ได้): อาหารไทยขึ้นก่อน แล้วเรียงตามสารอาหารที่ใกล้เกณฑ์เหลืองน้อยที่สุด
// ตัดอาหารที่พลังงานน้อยหรือมากเกินไป (เช่น น้ำเปล่า น้ำมัน) และจำกัดอาหารกลุ่มเดียวกันไม่เกิน 2 รายการ
const KCAL_MIN = 40, KCAL_MAX = 400, PER_GROUP = 2;

const clean = (s) => s.replace(/\s*\(Includes foods for USDA's[^)]*\)/i, "");
const isThai = (f) => !!f.src && f.src !== "usda";
const groupKey = (name) => name.split(",")[0].trim().toLowerCase();

function Lamp({ k }) {
  return (
    <div className="lamp" aria-hidden="true">
      {["r", "y", "g"].map((c) => <i key={c} className={`${c} ${c === k ? "on" : ""}`} />)}
    </div>
  );
}

export default function SearchPage() {
  const [eng, setEng] = useState(null);
  const [limits, setLimits] = useState(null);
  const [err, setErr] = useState(null);
  const [stage] = useStage();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [greenOnly, setGreenOnly] = useState(true);
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState(null);
  const detailRef = useRef(null);

  useEffect(() => {
    Promise.all([loadEngine(), loadLimits()])
      .then(([e, l]) => { setEng(e); setLimits(l); })
      .catch((e) => setErr(e.message));
  }, []);

  const cur = limits ? limits[String(stage)] : null;

  // แท็กของทุกอาหาร (ไม่ขึ้นกับระยะโรค)
  const tagged = useMemo(() => {
    if (!eng) return [];
    return eng.foods.map((f) => tagsOf({
      name: f.name,
      fat: eng.nutrient(f, "fat_g"),
      sugar: eng.nutrient(f, "sugar_g"),
      sodium: eng.nutrient(f, "sodium_mg"),
    }));
  }, [eng]);

  // สีของทุกอาหารตามระยะที่เลือก
  const preds = useMemo(() => (eng ? eng.foods.map((f) => eng.predict(f, stage)) : []), [eng, stage]);

  // ลำดับอาหารแนะนำ
  const ranked = useMemo(() => {
    if (!eng || !cur) return [];
    const yel = ORDER.map((n) => cur[n][0]);
    const pool = [];
    eng.foods.forEach((f, i) => {
      if (eng.isExcluded && eng.isExcluded(f.name)) return;
      const kcal = eng.nutrient(f, "energy_kcal");
      if (kcal < KCAL_MIN || kcal > KCAL_MAX) return;
      const m = ORDER.reduce((s, n, k) => s + eng.nutrient(f, n) / yel[k], 0) / ORDER.length;
      pool.push({ i, m, thai: isThai(f) });
    });
    pool.sort((a, b) => (b.thai - a.thai) || (a.m - b.m));
    return pool.map((p) => p.i);
  }, [eng, cur]);

  const q = query.trim();
  const list = useMemo(() => {
    if (!eng) return [];
    const base = q ? eng.search(q, 120) : ranked;
    const out = [];
    const seen = {};
    for (const i of base) {
      if (!q && greenOnly && preds[i] !== 0) continue;
      if (tag !== "all" && !tagged[i].includes(tag)) continue;
      if (!q && !isThai(eng.foods[i])) {
        const g = groupKey(eng.foods[i].name);
        seen[g] = (seen[g] || 0) + 1;
        if (seen[g] > PER_GROUP) continue;
      }
      out.push(i);
    }
    return out;
  }, [eng, q, ranked, preds, tagged, tag, greenOnly]);

  useEffect(() => { setShown(PAGE); }, [q, tag, greenOnly, stage]);

  const food = eng && selected !== null ? eng.foods[selected] : null;
  const color = food ? preds[selected] : null;
  const reasons = food ? eng.reasons(food, stage) : [];
  const subs = useMemo(
    () => (food && color !== 0 ? eng.substitutes(selected, stage) : []),
    [eng, food, color, selected, stage]
  );
  const v = color !== null ? VERDICT[color] : null;

  const pick = (i) => setSelected(i);
  useEffect(() => {
    if (selected === null || !detailRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detailRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [selected]);

  return (
    <main className="wrap">
      <Header />

      <section className="hero">
        <h1 className="h-title">ค้นหาอาหาร</h1>
        <p className="lead">
          ประเมินความเหมาะสมของอาหารด้วย Decision Tree และแนะนำอาหารทดแทนด้วย kNN
        </p>
        <p className="stage-line">
          <span className="muted">ใช้เกณฑ์ของ</span>
          <span className="stage-pill">{STAGE_LABEL[stage]}</span>
          <Link href="/" className="link">เปลี่ยนระยะโรค</Link>
        </p>
      </section>

      {err && <div className="card state">โหลดข้อมูลอาหารไม่สำเร็จ ลองรีเฟรชหน้านี้ ({err})</div>}
      {!err && !eng && <div className="card state">กำลังโหลดข้อมูลอาหาร...</div>}

      {eng && (
        <>
          <div className="search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาอาหาร เช่น banana, potato, ส้มตำ" aria-label="ค้นหาอาหาร" />
          </div>

          <div className="filters" role="group" aria-label="กรองตามรสชาติและวิธีปรุง">
            <button className="pill" aria-pressed={tag === "all"} onClick={() => setTag("all")}>ทั้งหมด</button>
            {TAGS.map((t) => (
              <button key={t.key} className="pill" aria-pressed={tag === t.key}
                onClick={() => setTag(tag === t.key ? "all" : t.key)}>{t.th}</button>
            ))}
          </div>

          <div className="opts">
            <label className="switch" style={q ? { opacity: 0.5 } : undefined}>
              <input type="checkbox" checked={greenOnly} disabled={!!q}
                onChange={(e) => setGreenOnly(e.target.checked)} />
              เฉพาะอาหารที่เหมาะกับระยะนี้
            </label>
            {q && <span className="muted small">ผลการค้นหาแสดงทุกสี</span>}
          </div>
        </>
      )}

      {food && v && (
        <section className="section card" ref={detailRef} style={{ scrollMarginTop: "1rem" }}>
          <div className="detail-head">
            <div className="verdict">
              <Lamp k={v.k} />
              <div>
                <p className="food-name">{clean(food.name)}</p>
                <div className="verdict-line">
                  <span className={`badge ${v.k}`}>{v.label}</span>
                  <span className="muted small">สำหรับ {STAGE_LABEL[stage]}</span>
                  {isThai(food) && <span className="badge src">อาหารไทย</span>}
                </div>
              </div>
            </div>
            <button className="close" onClick={() => setSelected(null)}>ปิด</button>
          </div>

          <p className={`summary ${v.k}`}>
            {reasons.length > 0
              ? "เกินเกณฑ์: " + reasons.map((r) =>
                  `${NUTRIENT_TH[r.nutrient]}${r.level === "red" ? "สูงมาก" : "สูง"}`).join(", ")
              : "โพแทสเซียม ฟอสฟอรัส โซเดียม และโปรตีน อยู่ในเกณฑ์สำหรับระยะนี้"}
          </p>

          {cur && (
            <div className="gauges">
              <Legend />
              {ORDER.map((n) => (
                <Gauge key={n} label={NUTRIENT_TH[n]} unit={UNIT[n]}
                  yellow={cur[n][0]} red={cur[n][1]} value={eng.nutrient(food, n)} />
              ))}
            </div>
          )}

          <div className="tiles">
            <div className="tile"><p>พลังงาน</p><p>{eng.nutrient(food, "energy_kcal")} kcal</p></div>
            <div className="tile"><p>น้ำ</p><p>{eng.nutrient(food, "water_g")} g</p></div>
          </div>
          <p className="muted small" style={{ marginTop: ".6rem" }}>ค่าทั้งหมดต่ออาหาร 100 g</p>

          {color !== 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h2 className="sec-title">อาหารทดแทนที่คล้ายกัน</h2>
              <p className="muted small">เป็นสีเขียวในระยะนี้ และมีสัดส่วนพลังงาน คาร์บ ไขมัน ใยอาหารใกล้เคียง</p>
              {subs.length === 0 ? (
                <p className="muted small" style={{ marginTop: ".6rem" }}>ไม่มีอาหารทดแทนที่คล้ายพอ</p>
              ) : (
                <ul className="sub-list">
                  {subs.map((s) => (
                    <li key={s.index}>
                      <button className="sub" onClick={() => setSelected(s.index)}>
                        <span className="sub-name"><i className="dot g" />{clean(s.food.name)}</span>
                        <span className="sub-vals">
                          <span>K {eng.nutrient(s.food, "potassium_mg")} mg</span>
                          <span>P {eng.nutrient(s.food, "phosphorus_mg")} mg</span>
                          <span>Na {eng.nutrient(s.food, "sodium_mg")} mg</span>
                          <span>ความต่าง {s.dist.toFixed(2)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {eng && (
        <section className="list-head" aria-live="polite">
          <div className="card-head">
            <h2 className="sec-title">
              {q ? `ผลการค้นหา "${q}"` : `อาหารแนะนำสำหรับ ${STAGE_LABEL[stage]}`}
              {tag !== "all" && ` · แท็ก${TAG_TH[tag]}`}
            </h2>
            <p className="muted small">{list.length} รายการ</p>
          </div>
          {!q && (
            <p className="muted small">
              เรียงจากอาหารที่มีโพแทสเซียม ฟอสฟอรัส โซเดียม และโปรตีนต่ำกว่าเกณฑ์มากที่สุดก่อน
            </p>
          )}

          {list.length === 0 ? (
            <div className="empty">
              {q ? (
                <p>ไม่พบอาหารชื่อนี้{tag !== "all" ? `ในแท็ก${TAG_TH[tag]}` : ""} ลองพิมพ์คำที่สั้นลงหรือชื่อภาษาอังกฤษ</p>
              ) : greenOnly ? (
                <>
                  <p>
                    ยังไม่มีอาหารที่เหมาะกับ {STAGE_LABEL[stage]}
                    {tag !== "all" ? `ในแท็ก${TAG_TH[tag]}` : ""}
                  </p>
                  <button className="btn-sm" onClick={() => setGreenOnly(false)}>แสดงทุกสี</button>
                </>
              ) : (
                <p>ยังไม่มีอาหารแท็ก{TAG_TH[tag]}ในข้อมูล</p>
              )}
            </div>
          ) : (
            <ul className="food-grid">
              {list.slice(0, shown).map((i) => {
                const f = eng.foods[i];
                const vv = VERDICT[preds[i]];
                return (
                  <li key={i}>
                    <article className={`fcard ${vv.k}`}>
                      <div className="fcard-body">
                        <div className="fcard-top">
                          <span className={`badge ${vv.k}`}>{vv.label}</span>
                          {isThai(f) && <span className="badge src">อาหารไทย</span>}
                        </div>
                        {tagged[i].length > 0 && (
                          <div className="tagrow">
                            {tagged[i].slice(0, 3).map((t) => <span key={t} className="tagchip">{TAG_TH[t]}</span>)}
                          </div>
                        )}
                        <p className="fcard-name" title={clean(f.name)}>{clean(f.name)}</p>
                        <div className="fcard-foot">
                          <div className="mini">
                            <span>K {eng.nutrient(f, "potassium_mg")}</span>
                            <span>P {eng.nutrient(f, "phosphorus_mg")}</span>
                            <span>Na {eng.nutrient(f, "sodium_mg")}</span>
                          </div>
                          <button className="btn-sm" onClick={() => pick(i)}>ดูรายละเอียด</button>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          {list.length > shown && (
            <div className="more">
              <button className="pill" onClick={() => setShown(shown + PAGE)}>
                ดูเพิ่ม ({list.length - shown} รายการ)
              </button>
            </div>
          )}
        </section>
      )}

      <footer className="foot">
        ระบบนี้เป็นเครื่องมือเพื่อการศึกษา ไม่ใช่คำแนะนำทางการแพทย์ เกณฑ์สารอาหารเป็นค่าตัวอย่าง
        ควรปรึกษาแพทย์หรือนักกำหนดอาหารก่อนนำไปใช้จริง
      </footer>
    </main>
  );
}
