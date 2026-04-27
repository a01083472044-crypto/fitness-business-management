"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useStaffTerm } from "../context/StaffTermContext";

// ── 데스크톱: 항상 표시되는 핵심 링크 ────────────────────────────────────
const PINNED = [
  { href: "/dashboard", label: "🏠 대시보드" },
  { href: "/members",   label: "👤 회원관리" },
  { href: "/schedule",  label: "📅 스케줄"   },
  { href: "/costs",     label: "💸 비용"     },
];

// ── 데스크톱: 드롭다운 그룹 ─────────────────────────────────────────────
const DESKTOP_GROUPS = [
  {
    label: "운영",
    items: [
      { href: "/trainers",       label: "트레이너 관리"  },
      { href: "/sessions",       label: "수업 관리"     },
      { href: "/group-schedule", label: "👥 그룹 스케줄" },
    ],
  },
  {
    label: "재무",
    items: [
      { href: "/cashflow",    label: "📅 자금일보"    },
      { href: "/receivables", label: "💰 미수금 관리" },
      { href: "/payment",     label: "💳 결제 수단별" },
      { href: "/settlement",  label: "급여 정산"      },
    ],
  },
  {
    label: "급여·인사",
    items: [
      { href: "/salary",  label: "급여 책정"        },
      { href: "/profit",  label: "📊 트레이너 기여도" },
    ],
  },
  {
    label: "분석",
    items: [
      { href: "/bep",      label: "손익분기점"    },
      { href: "/forecast", label: "📈 매출 예측"  },
      { href: "/report",   label: "📋 경영 리포트" },
      { href: "/goal",     label: "🎯 목표 매출"  },
      { href: "/churn",    label: "⚠️ 이탈 감지"  },
    ],
  },
  {
    label: "세무·기타",
    items: [
      { href: "/tax",      label: "🧾 세무 도우미" },
      { href: "/",         label: "🧮 계산기"      },
      { href: "/sync",     label: "📱 동기화"      },
      { href: "/settings", label: "🏷️ 설정"        },
    ],
  },
];

// ── 모바일: 하단 탭 (4개 고정) ────────────────────────────────────────────
const BOTTOM_TABS = [
  { href: "/dashboard", icon: "🏠", label: "홈"    },
  { href: "/members",   icon: "👤", label: "회원"  },
  { href: "/schedule",  icon: "📅", label: "스케줄" },
  { href: "/costs",     icon: "💸", label: "비용"  },
];

// ── 모바일: 더보기 드로어 그룹 ───────────────────────────────────────────
const DRAWER_GROUPS = [
  {
    title: "📋 운영",
    items: [
      { href: "/trainers",       label: "트레이너 관리"  },
      { href: "/sessions",       label: "수업 관리"     },
      { href: "/group-schedule", label: "👥 그룹 스케줄" },
    ],
  },
  {
    title: "💰 재무",
    items: [
      { href: "/cashflow",    label: "📅 자금일보"    },
      { href: "/receivables", label: "💰 미수금 관리" },
      { href: "/payment",     label: "💳 결제 수단별" },
      { href: "/settlement",  label: "급여 정산"      },
    ],
  },
  {
    title: "🏋️ 급여·인사",
    items: [
      { href: "/salary", label: "급여 책정"        },
      { href: "/profit", label: "📊 트레이너 기여도" },
    ],
  },
  {
    title: "📈 분석",
    items: [
      { href: "/bep",      label: "손익분기점"    },
      { href: "/forecast", label: "📈 매출 예측"  },
      { href: "/report",   label: "📋 경영 리포트" },
      { href: "/goal",     label: "🎯 목표 매출"  },
      { href: "/churn",    label: "⚠️ 이탈 감지"  },
    ],
  },
  {
    title: "🧾 세무·기타",
    items: [
      { href: "/tax",      label: "🧾 세무 도우미" },
      { href: "/",         label: "🧮 계산기"      },
      { href: "/sync",     label: "📱 동기화"      },
      { href: "/settings", label: "🏷️ 설정"        },
    ],
  },
];

// ── 드롭다운 컴포넌트 ────────────────────────────────────────────────────
function Dropdown({
  label,
  items,
  hasActive,
}: {
  label: string;
  items: { href: string; label: string }[];
  hasActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
          hasActive
            ? "bg-blue-50 text-blue-600"
            : open
            ? "bg-zinc-100 text-zinc-800"
            : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
        }`}
      >
        {label}
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-zinc-100 rounded-xl shadow-lg z-50 py-1 min-w-[140px]">
          {items.map(({ href, label: itemLabel }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-zinc-600 hover:bg-blue-50 hover:text-blue-600 transition whitespace-nowrap"
            >
              {itemLabel}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 Nav ─────────────────────────────────────────────────────────────
export default function Nav() {
  const pathname      = usePathname();
  const { isAdmin }   = useAuth();
  const { staffTerm } = useStaffTerm();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 페이지 이동 시 드로어 자동 닫기
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // staffTerm 반영 — 데스크톱 드롭다운 그룹
  const desktopGroups = DESKTOP_GROUPS.map((g) => ({
    ...g,
    items: g.items.map((item) =>
      item.href === "/trainers"
        ? { ...item, label: `${staffTerm} 관리` }
        : item.href === "/profit"
        ? { ...item, label: `📊 ${staffTerm} 기여도` }
        : item
    ),
  }));
  const adminGroup = { label: "⚙️ 관리자", items: [{ href: "/admin", label: "계정관리" }] };
  const allDesktopGroups = isAdmin ? [...desktopGroups, adminGroup] : desktopGroups;

  // staffTerm 반영 — 모바일 드로어 그룹
  const drawerGroups = DRAWER_GROUPS.map((g) => ({
    ...g,
    items: g.items.map((item) =>
      item.href === "/trainers"
        ? { ...item, label: `${staffTerm} 관리` }
        : item.href === "/profit"
        ? { ...item, label: `📊 ${staffTerm} 기여도` }
        : item
    ),
  }));
  const allDrawerGroups = isAdmin
    ? [...drawerGroups, { title: "⚙️ 관리자", items: [{ href: "/admin", label: "계정관리" }] }]
    : drawerGroups;

  // 현재 경로가 하단 탭에 있는지
  const inBottomTab = BOTTOM_TABS.some((t) => t.href === pathname);

  return (
    <>
      {/* ══ 데스크톱 Nav ════════════════════════════════════════════════════ */}
      <nav className="hidden md:block bg-white border-b border-zinc-100 sticky top-0 z-40">
        <div className="px-4 flex items-center gap-1 h-12">

          {/* 핵심 4개 고정 링크 */}
          {PINNED.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                pathname === href
                  ? "bg-blue-50 text-blue-600"
                  : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              {label}
            </Link>
          ))}

          {/* 구분선 */}
          <div className="w-px h-5 bg-zinc-200 mx-1" />

          {/* 카테고리 드롭다운 */}
          {allDesktopGroups.map((group) => {
            const hasActive = group.items.some((item) => item.href === pathname);
            return (
              <Dropdown
                key={group.label}
                label={group.label}
                items={group.items}
                hasActive={hasActive}
              />
            );
          })}
        </div>
      </nav>

      {/* ══ 모바일 하단 탭바 ══════════════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-zinc-100 safe-area-pb">
        <div className="grid grid-cols-5 h-16">
          {BOTTOM_TABS.map(({ href, icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
                  active ? "text-blue-600" : "text-zinc-400"
                }`}
              >
                <span className="text-xl leading-none">{icon}</span>
                {label}
              </Link>
            );
          })}
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

      {/* ══ 모바일 드로어 오버레이 ══════════════════════════════════════════ */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ══ 모바일 드로어 패널 ═══════════════════════════════════════════════ */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "82vh" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <p className="font-black text-zinc-800 text-base">전체 메뉴</p>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-8 pt-3 space-y-4" style={{ maxHeight: "calc(82vh - 80px)" }}>
          {allDrawerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-2 px-1">
                {group.title}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map(({ href, label }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl text-xs font-semibold text-center transition ${
                        active
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
