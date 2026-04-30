"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useStaffTerm } from "../context/StaffTermContext";

type LinkItem  = { type: "link";  href: string; icon: string; label: string; items?: never };
type GroupItem = { type: "group"; icon: string; label: string; items: { href: string; label: string }[]; href?: never };
type MenuItem  = LinkItem | GroupItem;

/* ── 사이드바 메뉴 구조 ──────────────────────────────────────────── */
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
      { href: "/trainers",     label: "트레이너 관리"  },
      { href: "/sessions",     label: "수업 관리"      },
      { href: "/consultation", label: "🗣️ 상담 관리"   },
      { href: "/checkin",      label: "✅ 체크인 관리"  },
      { href: "/locker",       label: "🔒 락커 관리"   },
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

/* ── 모바일 하단 탭 ─────────────────────────────────────────────── */
const BOTTOM_TABS = [
  { href: "/dashboard", icon: "🏠", label: "홈"    },
  { href: "/members",   icon: "👤", label: "회원"  },
  { href: "/costs",     icon: "💸", label: "비용"  },
  { href: "/schedule",  icon: "📅", label: "스케줄" },
];

/* ── 아코디언 그룹 (사이드바 / 드로어 공통) ────────────────────── */
function AccordionGroup({
  icon, label, items, pathname, staffTerm, variant = "sidebar",
}: {
  icon: string;
  label: string;
  items: { href: string; label: string }[];
  pathname: string;
  staffTerm: string;
  variant?: "sidebar" | "drawer";
}) {
  const resolvedItems = items.map((item) =>
    item.href === "/trainers"
      ? { ...item, label: `${staffTerm} 관리` }
      : item.href === "/profit"
      ? { ...item, label: `📊 ${staffTerm} 기여도` }
      : item
  );

  const hasActive = resolvedItems.some((i) => i.href === pathname);
  const [open, setOpen] = useState(hasActive);

  /* 현재 경로가 하위 항목일 때 자동 펼침 */
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  if (variant === "sidebar") {
    return (
      <div>
        {/* 그룹 헤더 버튼 */}
        <button
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            hasActive
              ? "bg-blue-50 text-blue-600"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          }`}
        >
          <span className="text-base w-5 text-center">{icon}</span>
          <span className="flex-1 text-left">{label}</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 하위 항목 – 슬라이드 애니메이션 */}
        <div
          style={{
            maxHeight: open ? "400px" : "0px",
            transition: "max-height 0.25s ease",
            overflow: "hidden",
          }}
        >
          <div className="ml-5 mt-0.5 mb-0.5 space-y-0.5 border-l-2 border-zinc-100 pl-2">
            {resolvedItems.map(({ href, label: itemLabel }) => (
              <Link
                key={href}
                href={href}
                className={`block px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  pathname === href
                    ? "bg-blue-600 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                }`}
              >
                {itemLabel}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── 드로어 variant ─────────────────────────────────────────── */
  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-100">
      {/* 그룹 헤더 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold transition-colors ${
          hasActive
            ? "bg-blue-50 text-blue-600"
            : "bg-white text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        <span>{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 하위 항목 – 슬라이드 애니메이션 */}
      <div
        style={{
          maxHeight: open ? "400px" : "0px",
          transition: "max-height 0.25s ease",
          overflow: "hidden",
        }}
      >
        <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-1 bg-zinc-50/60">
          {resolvedItems.map(({ href, label: itemLabel }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-center py-3 px-2 rounded-2xl text-xs font-semibold text-center transition ${
                pathname === href
                  ? "bg-blue-600 text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {itemLabel}
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const allMenu    = isAdmin ? [...MENU, ADMIN_ITEM] : MENU;
  const inBottomTab = BOTTOM_TABS.some((t) => t.href === pathname);

  return (
    <>
      {/* ══ 데스크톱 왼쪽 사이드바 ════════════════════════════════ */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-52 bg-white border-r border-zinc-100 z-40">
        {/* 로고 */}
        <Link href="/dashboard" className="flex items-center gap-2 px-4 py-4 border-b border-zinc-100 shrink-0">
          <span className="text-xl">💪</span>
          <span className="font-black text-zinc-900 text-base tracking-tight">FitBoss</span>
        </Link>

        {/* 메뉴 */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {allMenu.map((item) => {
            if (item.type === "link") {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  }`}
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              );
            }
            return (
              <AccordionGroup
                key={item.label}
                icon={item.icon}
                label={item.label}
                items={item.items}
                pathname={pathname}
                staffTerm={staffTerm}
                variant="sidebar"
              />
            );
          })}
        </nav>
      </aside>

      {/* ══ 모바일 하단 탭바 ═══════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-zinc-100">
        <div className="grid grid-cols-5 h-16">
          {BOTTOM_TABS.map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
                pathname === href ? "text-blue-600" : "text-zinc-400"
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              {label}
            </Link>
          ))}

          {/* 더보기 */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
              !inBottomTab ? "text-blue-600" : "text-zinc-400"
            }`}
          >
            <span className="text-xl leading-none">☰</span>
            더보기
          </button>
        </div>
      </nav>

      {/* ══ 모바일 드로어 ════════════════════════════════════════════ */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-zinc-50 rounded-t-3xl shadow-2xl transition-transform duration-300 ${
          drawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "85vh" }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-300 rounded-full" />
        </div>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 bg-white rounded-t-3xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">💪</span>
            <p className="font-black text-zinc-900 text-base">FitBoss</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
          >✕</button>
        </div>

        {/* 목록 */}
        <div className="overflow-y-auto px-3 pb-10 pt-3 space-y-2" style={{ maxHeight: "calc(85vh - 90px)" }}>
          {allMenu.map((item) => {
            if (item.type === "link") {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition border ${
                    pathname === item.href
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-zinc-700 border-zinc-100 hover:bg-zinc-50"
                  }`}
                >
                  <span>{item.icon}</span>{item.label}
                </Link>
              );
            }
            return (
              <AccordionGroup
                key={item.label}
                icon={item.icon}
                label={item.label}
                items={item.items}
                pathname={pathname}
                staffTerm={staffTerm}
                variant="drawer"
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
