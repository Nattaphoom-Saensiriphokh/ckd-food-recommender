"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "หน้าแรก: ข้อจำกัดด้านโภชนาการ" },
  { href: "/search", label: "ค้นหาอาหาร" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {ITEMS.map((it) => {
        const active = path === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-full border px-4 py-1.5 ${
              active ? "bg-blue-600 text-white border-blue-600" : "border-neutral-400"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
