"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Nav from "../lib/Nav";
import { useStage } from "../lib/useStage";
import { loadLimits } from "../lib/limits";
import { STAGE_LABEL, NUTRIENT_TH } from "../lib/engine";

const ORDER = ["potassium_mg", "phosphorus_mg", "sodium_mg", "protein_g"];
const UNIT = { potassium_mg: "mg", phosphorus_mg: "mg", sodium_mg: "mg", protein_g: "g" };

const Dot = ({ c }) => <span className={`inline-block h-3 w-3 rounded-full mr-2 ${c}`} />;

export default function Home() {
  const [stage, setStage] = useStage();
  const [limits, setLimits] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    loadLimits().then(setLimits).catch((e) => setErr(e.message));
  }, []);

  const cur = limits ? limits[String(stage)] : null;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">ระบบแนะนำอาหารสำหรับผู้ป่วยโรคไต</h1>
        <Nav />
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">ข้อจำกัดด้านโภชนาการ</h2>
        <p className="mb-3 text-sm opacity-70">
          เลือกระยะโรคของผู้ป่วย ระบบจะใช้เกณฑ์ของระยะนั้นตัดสินสีของอาหารในหน้าค้นหา
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`rounded-lg border-2 p-3 text-left ${
                stage === s ? "border-blue-600 bg-blue-600/10" : "border-neutral-400"
              }`}
            >
              <p className="font-medium">{STAGE_LABEL[s]}</p>
              <p className="text-xs opacity-70">
                {s === 1 ? "จำกัดน้อยที่สุด" : s === 2 ? "จำกัดปานกลาง" : "จำกัดเข้มงวดที่สุด"}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-medium">เกณฑ์ของ {STAGE_LABEL[stage]} (ต่อ 100 g ของอาหาร)</h3>
        {err && <p className="text-sm text-red-500">โหลดเกณฑ์ไม่สำเร็จ: {err}</p>}
        {!err && !cur && <p className="text-sm opacity-70">กำลังโหลดเกณฑ์...</p>}
        {cur && (
          <div className="overflow-x-auto rounded border border-neutral-300 dark:border-neutral-700">
            <table className="w-full text-sm">
              <thead className="bg-neutral-500/10 text-left">
                <tr>
                  <th className="p-2">สารอาหาร</th>
                  <th className="p-2"><Dot c="bg-green-500" />เหมาะสม</th>
                  <th className="p-2"><Dot c="bg-yellow-400" />ควรจำกัด</th>
                  <th className="p-2"><Dot c="bg-red-500" />ควรหลีกเลี่ยง</th>
                </tr>
              </thead>
              <tbody>
                {ORDER.map((n) => {
                  const [y, r] = cur[n];
                  const u = UNIT[n];
                  return (
                    <tr key={n} className="border-t border-neutral-300 dark:border-neutral-700">
                      <td className="p-2 font-medium">{NUTRIENT_TH[n]}</td>
                      <td className="p-2">น้อยกว่า {y} {u}</td>
                      <td className="p-2">{y} ถึงต่ำกว่า {r} {u}</td>
                      <td className="p-2">ตั้งแต่ {r} {u} ขึ้นไป</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs opacity-70">
          หลักการ: ถ้าสารอาหารตัวใดตัวหนึ่งถึงเกณฑ์สีแดง อาหารนั้นจะเป็นสีแดงทั้งหมด
          ถ้าไม่มีตัวใดถึงสีแดงแต่มีตัวถึงสีเหลือง จะเป็นสีเหลือง
        </p>
      </section>

      {limits && (
        <details className="rounded border border-neutral-300 dark:border-neutral-700 p-3 text-sm">
          <summary className="cursor-pointer font-medium">เปรียบเทียบเกณฑ์ทุกระยะ (เกณฑ์สีแดง)</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full">
              <thead className="text-left">
                <tr>
                  <th className="p-1">สารอาหาร</th>
                  {[1, 2, 3].map((s) => <th key={s} className="p-1">{STAGE_LABEL[s]}</th>)}
                </tr>
              </thead>
              <tbody>
                {ORDER.map((n) => (
                  <tr key={n} className="border-t border-neutral-300 dark:border-neutral-700">
                    <td className="p-1">{NUTRIENT_TH[n]}</td>
                    {[1, 2, 3].map((s) => (
                      <td key={s} className="p-1">≥ {limits[String(s)][n][1]} {UNIT[n]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <Link
        href="/search"
        className="inline-block rounded bg-blue-600 px-5 py-2 text-white"
      >
        ไปค้นหาอาหาร →
      </Link>

      <footer className="border-t border-neutral-300 dark:border-neutral-700 pt-4 text-xs opacity-70">
        ระบบนี้เป็นเครื่องมือเพื่อการศึกษา ไม่ใช่คำแนะนำทางการแพทย์ เกณฑ์สารอาหารเป็นค่าตัวอย่าง
        ควรปรึกษาแพทย์หรือนักกำหนดอาหารก่อนนำไปใช้จริง
      </footer>
    </main>
  );
}
