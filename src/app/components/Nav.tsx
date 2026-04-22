"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/members", label: "회원 관리" },
  { href: "/costs", label: "비용 관리" },
  { href: "/dashboard", label: "대시보드" },
  { href: "/salary", label: "급여 계산기" },
  { href: "/bep", label: "손익분기점" },
  { href: "/", label: "계산기" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="bg-white border-b border-zinc-100 sticky top-0 z-40">
      <div className="max-w-lg mx-auto px-4 flex items-center gap-1 h-12">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
