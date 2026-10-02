"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "ข้อจำกัดโภชนาการ" },
  { href: "/search", label: "ค้นหาอาหาร" },
];

export default function Header() {
  const path = usePathname();
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="หน้าแรก">
        <span className="brand-mark" aria-hidden="true">
          <i style={{ background: "var(--green)" }} />
          <i style={{ background: "var(--amber)" }} />
          <i style={{ background: "var(--red)" }} />
        </span>
        <span className="brand-name">อาหารสำหรับผู้ป่วยโรคไต</span>
      </Link>
      <nav className="tabs" aria-label="เมนูหลัก">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className="tab"
            aria-current={path === it.href ? "page" : undefined}>
            {it.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
