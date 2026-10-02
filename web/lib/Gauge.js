"use client";

// แถบมาตรวัด: เขียว -> เหลือง -> แดง ตามเกณฑ์ของสารอาหาร
// ถ้าส่ง value มาด้วย จะแสดงตำแหน่งของอาหารบนแถบ
export function Legend() {
  return (
    <div className="legend">
      <span><i className="dot g" />เหมาะสม</span>
      <span><i className="dot y" />ควรจำกัดปริมาณ</span>
      <span><i className="dot r" />ควรหลีกเลี่ยง</span>
    </div>
  );
}

export function levelOf(value, yellow, red) {
  if (value >= red) return "r";
  if (value >= yellow) return "y";
  return "g";
}
const LEVEL_TEXT = { g: "ปกติ", y: "สูง", r: "สูงมาก" };

export default function Gauge({ label, unit, yellow, red, value }) {
  const max = red * 1.6;
  const pct = (x) => Math.min(Math.max((x / max) * 100, 0), 100);
  const hasValue = typeof value === "number";
  const lvl = hasValue ? levelOf(value, yellow, red) : null;
  const pos = hasValue ? Math.min(Math.max(pct(value), 4), 96) : 0;

  return (
    <div className="gauge-row">
      <div className="gauge-top">
        <span className="gauge-label">{label}</span>
        {hasValue && <span className={`badge ${lvl}`}>{LEVEL_TEXT[lvl]}</span>}
      </div>
      <div className="gauge-wrap">
        {hasValue && (
          <div className="marker" style={{ left: `${pos}%` }}>
            <span className="tag">{value} {unit}</span>
            <span className="tick" />
          </div>
        )}
        <div className="gauge" role="img"
          aria-label={`${label}: เหลืองตั้งแต่ ${yellow} ${unit} แดงตั้งแต่ ${red} ${unit}`}>
          <i className="g" style={{ width: `${pct(yellow)}%` }} />
          <i className="y" style={{ width: `${pct(red) - pct(yellow)}%` }} />
          <i className="r" style={{ width: `${100 - pct(red)}%` }} />
        </div>
        <div className="gauge-scale">
          <span style={{ left: `${pct(yellow)}%` }}>{yellow}</span>
          <span style={{ left: `${pct(red)}%` }}>{red} {unit}</span>
        </div>
      </div>
    </div>
  );
}
