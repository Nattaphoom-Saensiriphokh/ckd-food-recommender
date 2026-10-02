"use client";
import "./theme.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "../lib/Header";
import Gauge, { Legend } from "../lib/Gauge";
import { useStage } from "../lib/useStage";
import { loadLimits } from "../lib/limits";
import { STAGE_LABEL, NUTRIENT_TH } from "../lib/engine";

const ORDER = ["potassium_mg", "phosphorus_mg", "sodium_mg", "protein_g"];
const UNIT = { potassium_mg: "mg", phosphorus_mg: "mg", sodium_mg: "mg", protein_g: "g" };
const NOTE = { 1: "จำกัดน้อยที่สุด", 2: "จำกัดปานกลาง", 3: "จำกัดเข้มงวดที่สุด" };

export default function Home() {
  const [stage, setStage] = useStage();
  const [limits, setLimits] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    loadLimits().then(setLimits).catch((e) => setErr(e.message));
  }, []);

  const cur = limits ? limits[String(stage)] : null;

  return (
    <main className="wrap">
      <Header />

      <section className="hero">
        <h1 className="h-title">ข้อจำกัดด้านโภชนาการ</h1>
        <p className="lead">
          เลือกระยะโรคของผู้ป่วย ระบบจะใช้เกณฑ์ของระยะนั้นตัดสินสีของอาหารที่คุณค้นหา
        </p>
      </section>

      <section>
        <h2 className="sec-title">ระยะโรค</h2>
        <div className="stage-grid" role="radiogroup" aria-label="ระยะโรค">
          {[1, 2, 3].map((s) => (
            <button key={s} role="radio" aria-checked={stage === s}
              className={`stage-btn ${stage === s ? "on" : ""}`} onClick={() => setStage(s)}>
              <span className="strict" aria-hidden="true">
                {[1, 2, 3].map((n) => <i key={n} className={n <= s ? "fill" : ""} />)}
              </span>
              <span className="stage-name">{STAGE_LABEL[s]}</span>
              <span className="stage-note">{NOTE[s]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section card">
        <div className="card-head">
          <h2 className="sec-title">เกณฑ์ของ {STAGE_LABEL[stage]}</h2>
          <p className="muted small">ปริมาณสารอาหารต่ออาหาร 100 g</p>
        </div>
        <Legend />
        {err && <p className="small">โหลดเกณฑ์ไม่สำเร็จ ลองรีเฟรชหน้านี้ ({err})</p>}
        {!err && !cur && <p className="muted small">กำลังโหลดเกณฑ์...</p>}
        {cur && ORDER.map((n) => (
          <Gauge key={n} label={NUTRIENT_TH[n]} unit={UNIT[n]} yellow={cur[n][0]} red={cur[n][1]} />
        ))}
        <p className="rule">
          ถ้าสารอาหารตัวใดตัวหนึ่งถึงเกณฑ์สีแดง อาหารนั้นจะเป็นสีแดงทั้งหมด
          ถ้าไม่มีตัวใดถึงสีแดงแต่มีตัวถึงสีเหลือง จะเป็นสีเหลือง
        </p>
      </section>

      {limits && (
        <details className="section card">
          <summary>เปรียบเทียบเกณฑ์สีแดงของทุกระยะ</summary>
          <div className="scroll-x">
            <table className="cmp">
              <thead>
                <tr>
                  <th>สารอาหาร</th>
                  {[1, 2, 3].map((s) => <th key={s}>{STAGE_LABEL[s]}</th>)}
                </tr>
              </thead>
              <tbody>
                {ORDER.map((n) => (
                  <tr key={n}>
                    <td>{NUTRIENT_TH[n]}</td>
                    {[1, 2, 3].map((s) => (
                      <td key={s}>ตั้งแต่ {limits[String(s)][n][1]} {UNIT[n]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="section">
        <Link href="/search" className="btn">ไปค้นหาอาหาร</Link>
      </div>

      <footer className="foot">
        ระบบนี้เป็นเครื่องมือเพื่อการศึกษา ไม่ใช่คำแนะนำทางการแพทย์ เกณฑ์สารอาหารเป็นค่าตัวอย่าง
        ควรปรึกษาแพทย์หรือนักกำหนดอาหารก่อนนำไปใช้จริง
      </footer>
    </main>
  );
}
