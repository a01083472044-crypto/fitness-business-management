"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useStaffTerm } from "../context/StaffTermContext";

// ── 데스크톱 전체 링크 ────────────────────────────────────────────────────
const adminLinks = [
  { href: "/admin", label: "⚙️ 계정관리" },
];

// ── 모바일 하단 탭 (5개 고정) ─────────────────────────────────────────────
const BOTTOM_TABS = [
  { href: "/dashboard", icon: "🏠", label: "홈"    },
  { href: "/members",   icon: "👤", label: "회원"  },
  { href: "/schedule",  icon: "📅", label: "스케줄" },
  { href: "/costs",     icon: "💸", label: "비용"  },
  // 5번째: 더보기 버튼 (href 없음 → 드로어 트리거)
];

// ── 더보기 드로어 그룹 ────────────────────────────────────────────────────
const DRAWER_GROUPS = [
  {
    title: "📋 운영",
    items: [
      { href: "/trainers",       label: "트레이너 관리" },
      { href: "/sessions",       label: "수업 관리"    },
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
      { href: "/salary", label: "급여 책정"       },
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

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
export default function Nav() {
  const pathname        = usePathname();
  const { isAdmin }     = useAuth();
  const { staffTerm }   = useStaffTerm();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 페이지 이동 시 드로어 자동 닫기
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // staffTerm 반영 — 데스크톱 전체 링크
  const baseLinks = [
    { href: "/members",       label: "회원 관리"              },
    { href: "/trainers",      label: `${staffTerm} 관리`      },
    { href: "/sessions",      label: "수업 관리"              },
    { href: "/schedule",      label: "👤 1:1 스케줄"          },
    { href: "/group-schedule",label: "👥 그룹 스케줄"         },
    { href: "/costs",         label: "비용 관리"              },
    { href: "/bep",           label: "손익분기점"             },
    { href: "/salary",        label: "급여 책정"              },
    { href: "/settlement",    label: "급여 정산"              },
    { href: "/profit",        label: `📊 ${staffTerm} 기여도` },
    { href: "/forecast",      label: "📈 매출 예측"           },
    { href: "/report",        label: "📋 경영 리포트"         },
    { href: "/goal",          label: "🎯 목표 매출"           },
    { href: "/churn",         label: "⚠️ 이탈 감지"           },
    { href: "/cashflow",      label: "📅 자금일보"            },
    { href: "/receivables",   label: "💰 미수금 관리"         },
    { href: "/payment",       label: "💳 결제 수단별"         },
    { href: "/tax",           label: "🧾 세무 도우미"         },
    { href: "/dashboard",     label: "대시보드"               },
    { href: "/",              label: "계산기"                 },
    { href: "/sync",          label: "📱 동기화"              },
    { href: "/settings",      label: "🏷️ 설정"               },
  ];
  const desktopLinks = isAdmin ? [...baseLinks, ...adminLinks] : baseLinks;

  // 드로어에 staffTerm 적용
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
  // 관리자 전용 그룹 추가
  const allDrawerGroups = isAdmin
    ? [...drawerGroups, { title: "⚙️ 관리자", items: [{ href: "/admin", label: "계정관리" }] }]
    : drawerGroups;

  // 현재 페이지가 하단 탭에 없는지 확인 (더보기 활성화 여부)
  const inBottomTab = BOTTOM_TABS.some((t) => t.href === pathname);

  return (
    <>
      {/* ══ 데스크톱 Nav (md 이상) ══════════════════════════════════════════ */}
      <nav className="hidden md:block bg-white border-b border-zinc-100 sticky top-0 z-40">
        <div className="px-4 flex items-center gap-1 h-12 overflow-x-auto scrollbar-hide">
          {desktopLinks.map(({ href, label }) => {
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

      {/* ══ 모바일 하단 탭바 (md 미만) ══════════════════════════════════════ */}
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
          {/* 더보기 버튼 */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
              !inBottomTab && pathname !== "/" ? "text-blue-600" : "text-zinc-400"
            }`}
          >
            <span className="text-xl leading-none">☰</span>
            더보기
          </button>
        </div>
      </nav>

      {/* ══ 더보기 드로어 ════════════════════════════════════════════════════ */}
      {/* 오버레이 */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      {/* 드로어 패널 */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "82vh" }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-200 rounded-full" />
        </div>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <p className="font-black text-zinc-800 text-base">전체 메뉴</p>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition"
          >
            ✕
          </button>
        </div>
        {/* 메뉴 목록 */}
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
