"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useStaffTerm } from "../context/StaffTermContext";

type LinkItem  = { type: "link";  href: string; icon: string; label: string; items?: never };
type GroupItem = { type: "group"; icon: string; label: string; items: { href: string; label: string }[]; href?: never };
type MenuItem  = LinkItem | GroupItem;

/* ── 메뉴 구조 ───────────────────────────────────────────────────── */
const MENU: MenuItem[] = [
  { type: "link",  href: "/dashboard", icon: "🏠", label: "대시보드" },
  { type: "link",  href: "/members",   icon: "👤", label: "회원관리" },
  {
    type: "group", icon: "📅", label: "스케줄",
    items: [
      { href: "/schedule",       label: "👤 1:1 스케줄"  },
      { href: "/group-schedule", label: "👥 그룹 스케줄" },
    ],
  },
  {
    type: "group", icon: "📋", label: "운영",
    items: [
      { href: "/trainers",     label: "트레이너 관리" },
      { href: "/sessions",     label: "수업 관리"     },
      { href: "/consultation", label: "🗣️ 상담 관리"  },
      { href: "/checkin",      label: "✅ 체크인 관리" },
      { href: "/locker",       label: "🔒 락커 관리"  },
    ],
  },
  {
    type: "group", icon: "👔", label: "급여·인사",
    items: [
      { href: "/salary", label: "급여 책정"        },
      { href: "/profit", label: "📊 트레이너 기여도" },
    ],
  },
  { type: "link", href: "/costs", icon: "💸", label: "비용" },
  {
    type: "group", icon: "💰", label: "재무",
    items: [
      { href: "/cashflow",    label: "📅 자금일보"    },
      { href: "/receivables", label: "💰 미수금 관리" },
      { href: "/payment",     label: "💳 결제 수단별" },
      { href: "/settlement",  label: "급여 정산"      },
    ],
  },
  {
    type: "group", icon: "🧾", label: "세무",
    items: [
      { href: "/tax", label: "🧾 세무 도우미" },
    ],
  },
  {
    type: "group", icon: "📈", label: "분석",
    items: [
      { href: "/bep",      label: "손익분기점"    },
      { href: "/forecast", label: "📈 매출 예측"  },
      { href: "/report",   label: "📋 경영 리포트" },
      { href: "/goal",     label: "🎯 목표 매출"  },
      { href: "/churn",    label: "⚠️ 이탈 감지"  },
    ],
  },
  {
    type: "group", icon: "📦", label: "기타",
    items: [
      { href: "/",          label: "🧮 계산기"      },
      { href: "/documents", label: "📂 문서 자료실" },
      { href: "/sync",      label: "📱 동기화"      },
      { href: "/settings",  label: "🏷️ 설정"        },
    ],
  },
];

const ADMIN_ITEM: MenuItem = {
  type: "group", icon: "⚙️", label: "관리자",
  items: [{ href: "/admin", label: "계정관리" }],
};

/* ── 드롭다운 아코디언 그룹 ─────────────────────────────────────── */
function DropGroup({
  icon, label, items, pathname, staffTerm, onClose,
}: {
  icon: string; label: string;
  items: { href: string; label: string }[];
  pathname: string; staffTerm: string;
  onClose: () => void;
}) {
  const resolvedItems = items.map((item) =>
    item.href === "/trainers" ? { ...item, label: `${staffTerm} 관리` }
    : item.href === "/profit" ? { ...item, label: `📊 ${staffTerm} 기여도` }
    : item
  );

  const hasActive = resolvedItems.some((i) => i.href === pathname);
  const [open, setOpen] = useState(hasActive);

  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);

  return (
    <div>
      {/* 그룹 헤더 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors ${
          hasActive ? "text-blue-600 bg-blue-50" : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        <span className="w-5 text-center">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 shrink-0 text-zinc-400 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 하위 항목 */}
      <div style={{ maxHeight: open ? "400px" : "0px", transition: "max-height 0.25s ease", overflow: "hidden" }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 px-4 pb-3 pt-1 bg-zinc-50">
          {resolvedItems.map(({ href, label: lbl }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                pathname === href
                  ? "bg-blue-600 text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-100"
              }`}
            >
              {lbl}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 메인 Nav ───────────────────────────────────────────────────── */
export default function Nav() {
  const pathname      = usePathname();
  const { isAdmin }   = useAuth();
  const { staffTerm } = useStaffTerm();
  const [menuOpen, setMenuOpen] = useState(false);

  /* 페이지 이동 시 메뉴 닫기 */
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const allMenu = isAdmin ? [...MENU, ADMIN_ITEM] : MENU;

  /* 현재 페이지 이름 표시용 */
  const currentLabel = (() => {
    for (const item of allMenu) {
      if (item.type === "link" && item.href === pathname) return item.label;
      if (item.type === "group") {
        const found = item.items.find((i) => i.href === pathname);
        if (found) return found.label;
      }
    }
    return "";
  })();

  return (
    <>
      {/* ══ 상단 헤더 바 ════════════════════════════════════════════ */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 bg-white border-b border-zinc-100 flex items-center gap-3 px-4 shadow-sm">
        {/* 햄버거 버튼 */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`flex flex-col justify-center items-center w-9 h-9 rounded-lg gap-[5px] transition-colors ${
            menuOpen ? "bg-blue-50 text-blue-600" : "hover:bg-zinc-100 text-zinc-600"
          }`}
          aria-label="메뉴 열기"
        >
          <span
            className={`block h-[2px] w-5 rounded-full bg-current transition-all duration-200 origin-center ${
              menuOpen ? "rotate-45 translate-y-[7px]" : ""
            }`}
          />
          <span
            className={`block h-[2px] w-5 rounded-full bg-current transition-all duration-200 ${
              menuOpen ? "opacity-0 scale-x-0" : ""
            }`}
          />
          <span
            className={`block h-[2px] w-5 rounded-full bg-current transition-all duration-200 origin-center ${
              menuOpen ? "-rotate-45 -translate-y-[7px]" : ""
            }`}
          />
        </button>

        {/* 로고 */}
        <Link href="/dashboard" className="flex items-center gap-1.5">
          <span className="text-xl">💪</span>
          <span className="font-black text-zinc-900 text-base tracking-tight">FitBoss</span>
        </Link>

        {/* 현재 페이지 이름 */}
        {currentLabel && (
          <span className="text-xs font-semibold text-zinc-400 border-l border-zinc-200 pl-3 ml-1 hidden sm:block">
            {currentLabel}
          </span>
        )}
      </header>

      {/* ══ 드롭다운 메뉴 패널 ══════════════════════════════════════ */}
      {/* 배경 오버레이 */}
      {menuOpen && (
        <div
          className="fixed inset-0 top-14 z-40 bg-black/20"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* 메뉴 패널 */}
      <div
        className="fixed inset-x-0 top-14 z-50 bg-white shadow-xl border-b border-zinc-100 overflow-y-auto"
        style={{
          maxHeight: menuOpen ? "calc(100vh - 56px)" : "0px",
          transition: "max-height 0.3s ease",
          overflow: menuOpen ? "auto" : "hidden",
        }}
      >
        <div className="max-w-3xl mx-auto divide-y divide-zinc-100">
          {allMenu.map((item) => {
            if (item.type === "link") {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-bold transition-colors ${
                    active
                      ? "text-blue-600 bg-blue-50"
                      : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <span className="w-5 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              );
            }
            return (
              <DropGroup
                key={item.label}
                icon={item.icon}
                label={item.label}
                items={item.items}
                pathname={pathname}
                staffTerm={staffTerm}
                onClose={() => setMenuOpen(false)}
              />
            );
          })}
          {/* 하단 여백 */}
          <div className="h-4" />
        </div>
      </div>
    </>
  );
}
