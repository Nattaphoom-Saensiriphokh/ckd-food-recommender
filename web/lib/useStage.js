"use client";
import { useEffect, useState } from "react";

// เก็บระยะโรคที่เลือกไว้ในเบราว์เซอร์ เพื่อให้ทุกหน้าใช้ค่าเดียวกัน
const KEY = "ckd_stage";

export function useStage() {
  const [stage, setStageState] = useState(3);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      if ([1, 2, 3].includes(v)) setStageState(v);
    } catch {}
  }, []);

  const setStage = (s) => {
    setStageState(s);
    try { localStorage.setItem(KEY, String(s)); } catch {}
  };

  return [stage, setStage];
}
