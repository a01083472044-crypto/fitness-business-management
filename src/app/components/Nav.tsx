"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useStaffTerm } from "../context/StaffTermContext";

const adminLinks = [
  { href: "/admin",    label: "⚙️ 계정관리" },
  { href: "/settings", label: "🏷️ 설정"    },
];

export default function Nav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const { staffTerm } = useStaffTerm();

  const baseLinks = [
    { href: "/members",    label: "회원 관리"              },
    { href: "/trainers",   label: `${staffTerm} 관리`      },
    { href: "/sessions",   label: "수업 관리"              },
    { href: "/schedule",   label: "수업 스케줄"            },
    { href: "/costs",      label: "비용 관리"              },
    { href: "/bep",        label: "손익분기점"             },
    { href: "/salary",     label: "급여 책정"              },
    { href: "/settlement", label: "급여 정산"              },
    { href: "/profit",     label: `📊 ${staffTerm} 기여도` },
    { href: "/forecast",   label: "📈 매출 예측"           },
    { href: "/report",     label: "📋 경영 리포트"         },
    { href: "/dashboard",  label: "대시보드"               },
    { href: "/",           label: "계산기"                 },
    { href: "/sync",       label: "📱 동기화"              },
    { href: "/settings",   label: "🏷️ 설정"               },
  ];

  const links = isAdmin ? [...baseLinks, ...adminLinks.slice(0, 1)] : baseLinks;

  return (
    <nav className="bg-white border-b border-zinc-100 sticky top-0 z-40">
      <div className="px-4 flex items-center gap-1 h-12 overflow-x-auto scrollbar-hide">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
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
