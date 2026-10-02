// โหลดเฉพาะเกณฑ์ (tree.json) ไม่ต้องโหลดตารางอาหารทั้งหมด หน้าแรกจึงเปิดเร็ว
export async function loadLimits() {
  const tree = await fetch("/data/tree.json").then((r) => r.json());
  return tree.thresholds_by_stage; // { "1": { potassium_mg: [เหลือง, แดง], ... }, ... }
}
