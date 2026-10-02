"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "../../lib/Nav";
import { useStage } from "../../lib/useStage";
import { loadEngine, STAGE_LABEL, NUTRIENT_TH } from "../../lib/engine";

const COLOR = [
  { dot: "bg-green-500", box: "border-green-500", label: "เหมาะสม" },
  { dot: "bg-yellow-400", box: "border-yellow-400", label: "ควรจำกัดปริมาณ" },
  { dot: "bg-red-500", box: "border-red-500", label: "ควรหลีกเลี่ยง" },
];
const UNIT = { potassium_mg: "mg", phosphorus_mg: "mg", sodium_mg: "mg", protein_g: "g" };

// ตัดข้อความยาวๆ ที่ไม่จำเป็นออกจากชื่อ USDA
const clean = (s) => s.replace(/\s*\(Includes foods for USDA's[^)]*\)/i, "");

export default function SearchPage() {
  const [eng, setEng] = useState(null);
  const [err, setErr] = useState(null);
  const [stage] = useStage();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadEngine().then(setEng).catch((e) => setErr(e.message));
  }, []);

  const results = useMemo(() => (eng ? eng.search(query) : []), [eng, query]);
  const food = eng && selected !== null ? eng.foods[selected] : null;
  const color = food ? eng.predict(food, stage) : null;
  const reasons = food ? eng.reasons(food, stage) : [];
  const subs = useMemo(
    () => (food && color !== 0 ? eng.substitutes(selected, stage) : []),
    [eng, food, color, selected, stage]
  );

  if (err) return <main className="p-8">เกิดข้อผิดพลาด: {err}</main>;
  if (!eng) return <main className="p-8">กำลังโหลดข้อมูลอาหาร...</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">ค้นหาอาหาร</h1>
        <Nav />
        <p className="text-sm opacity-70">
          ประเมินความเหมาะสมของอาหารด้วย Decision Tree และแนะนำอาหารทดแทนด้วย kNN
        </p>
        <p className="text-sm">
          ใช้เกณฑ์: <span className="font-medium">{STAGE_LABEL[stage]}</span>{" "}
          <Link href="/" className="text-blue-600 underline">เปลี่ยนระยะโรค</Link>
        </p>
      </header>

      <section>
        <p className="mb-2 font-medium">พิมพ์ชื่ออาหาร</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="เช่น banana, potato, ข้าว, ส้มตำ"
          className="w-full rounded border border-neutral-400 bg-transparent px-3 py-2"
        />
        {query && (
          <ul className="mt-2 max-h-56 overflow-auto rounded border border-neutral-300 dark:border-neutral-700">
            {results.length === 0 && <li className="p-2 text-sm opacity-70">ไม่พบอาหาร</li>}
            {results.map((i) => (
              <li key={i}>
                <button
                  onClick={() => { setSelected(i); setQuery(""); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-500/10"
                >
                  {clean(eng.foods[i].name)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {food && (
        <section className={`rounded-lg border-2 p-4 space-y-4 ${COLOR[color].box}`}>
          <div className="flex items-center gap-3">
            <span className={`h-8 w-8 shrink-0 rounded-full ${COLOR[color].dot}`} />
            <div>
              <p className="font-semibold">{clean(food.name)}</p>
              <p className="text-sm">
                {COLOR[color].label} <span className="opacity-60">({STAGE_LABEL[stage]})</span>
              </p>
            </div>
          </div>

          {reasons.length > 0 ? (
            <ul className="list-disc pl-5 text-sm space-y-1">
              {reasons.map((r) => (
                <li key={r.nutrient}>
                  {NUTRIENT_TH[r.nutrient]}
                  {r.level === "red" ? "สูงมาก" : "สูง"}: {r.value} {UNIT[r.nutrient]} ต่อ 100 g
                  (เกณฑ์ {r.limit} {UNIT[r.nutrient]})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">โพแทสเซียม ฟอสฟอรัส โซเดียม และโปรตีน อยู่ในเกณฑ์สำหรับระยะนี้</p>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {[
              ["โพแทสเซียม", "potassium_mg", "mg"],
              ["ฟอสฟอรัส", "phosphorus_mg", "mg"],
              ["โซเดียม", "sodium_mg", "mg"],
              ["โปรตีน", "protein_g", "g"],
              ["พลังงาน", "energy_kcal", "kcal"],
              ["น้ำ", "water_g", "g"],
            ].map(([th, key, u]) => (
              <div key={key} className="rounded bg-neutral-500/10 p-2">
                <p className="text-xs opacity-70">{th}</p>
                <p className="font-medium">{eng.nutrient(food, key)} {u}</p>
              </div>
            ))}
          </div>
          <p className="text-xs opacity-60">ค่าทั้งหมดต่อ 100 g</p>

          {color !== 0 && (
            <div>
              <p className="mb-2 font-medium">อาหารทดแทนที่คล้ายกัน (สีเขียวในระยะนี้)</p>
              {subs.length === 0 ? (
                <p className="text-sm opacity-70">ไม่มีของทดแทนที่คล้ายพอ</p>
              ) : (
                <ul className="space-y-1">
                  {subs.map((s) => (
                    <li key={s.index}>
                      <button
                        onClick={() => setSelected(s.index)}
                        className="w-full rounded border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-left text-sm hover:bg-neutral-500/10"
                      >
                        <span>{clean(s.food.name)}</span>
                        <span className="block text-xs opacity-70">
                          K {eng.nutrient(s.food, "potassium_mg")} · P {eng.nutrient(s.food, "phosphorus_mg")} ·
                          Na {eng.nutrient(s.food, "sodium_mg")} mg · ความต่าง {s.dist.toFixed(2)}
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

      <footer className="border-t border-neutral-300 dark:border-neutral-700 pt-4 text-xs opacity-70">
        ระบบนี้เป็นเครื่องมือเพื่อการศึกษา ไม่ใช่คำแนะนำทางการแพทย์ เกณฑ์สารอาหารเป็นค่าตัวอย่าง
        ควรปรึกษาแพทย์หรือนักกำหนดอาหารก่อนนำไปใช้จริง
      </footer>
    </main>
  );
}
