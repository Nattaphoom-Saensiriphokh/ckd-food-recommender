// แท็กรสชาติและวิธีปรุง ใช้กรองรายการอาหารในหน้าค้นหา
// แก้คำหรือเกณฑ์ตรงนี้ได้เลย ไม่กระทบโมเดล

export const TAGS = [
  { key: "spicy", th: "เผ็ด" },
  { key: "sweet", th: "หวาน" },
  { key: "fatty", th: "มัน" },
  { key: "salty", th: "เค็ม" },
  { key: "boil", th: "ต้ม" },
  { key: "stirfry", th: "ผัด" },
  { key: "curry", th: "แกง" },
  { key: "steam", th: "นึ่ง" },
];
export const TAG_TH = Object.fromEntries(TAGS.map((t) => [t.key, t.th]));

// คีย์เวิร์ดจากชื่ออาหาร (ไทย + อังกฤษ)
const NAME_RULES = {
  spicy: /chili|chile|jalape|spicy|hot sauce|curry|พริก|เผ็ด|ต้มยำ|น้ำพริก|ลาบ|ส้มตำ|ตำ(?!ลึง)|ยำ|กะเพรา|พะแนง/i,
  sweet: /sweetened|syrup|dessert|cake|candy|cookie|honey|\bjam\b|pudding|ice cream|(?<!เขียว)หวาน|ขนม(?!จีน)|น้ำตาล/i,
  fatty: /กะทิ|coconut milk|cream|butter|fried|ทอด|bacon|หมูสามชั้น/i,
  salty: /fish sauce|soy sauce|salted|pickled|น้ำปลา|ซีอิ๊ว|ปลาร้า|กะปิ|เค็ม/i,
  boil: /boiled|stewed|simmered|soup|broth|poached|ต้ม|แกงจืด/i,
  stirfry: /stir[- ]?fr|saut|ผัด/i,
  curry: /curry|แกง|kaeng|gaeng|kang-/i,
  steam: /steam|นึ่ง/i,
};

// เกณฑ์จากค่าสารอาหารต่อ 100 g
const FAT_G = 10;     // มัน
const SUGAR_G = 10;   // หวาน (หมายเหตุ: ค่าน้ำตาลที่ขาดถูกเติมด้วยค่ามัธยฐาน จึงไม่ถูกนับเป็นหวาน)
const SODIUM_MG = 300; // เค็ม

export function tagsOf({ name, fat = 0, sugar = 0, sodium = 0 }) {
  const out = [];
  for (const { key } of TAGS) {
    let hit = NAME_RULES[key].test(name);
    if (key === "fatty" && fat >= FAT_G) hit = true;
    if (key === "sweet" && sugar >= SUGAR_G) hit = true;
    if (key === "salty" && sodium >= SODIUM_MG) hit = true;
    if (hit) out.push(key);
  }
  return out;
}
