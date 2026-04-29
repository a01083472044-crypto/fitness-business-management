"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { StaffTermProvider } from "../context/StaffTermContext";
import Nav from "./Nav";
import KakaoAutoSender from "./KakaoAutoSender";
import SyncBadge from "./SyncBadge";

// 랜딩 페이지는 Auth 전체 우회 — AuthProvider 바깥에서 판단
function LandingBypass({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // "/" 는 AuthProvider/AppShell 없이 바로 렌더
  if (pathname === "/") return <>{children}</>;
  return (
    <AuthProvider>
      <StaffTermProvider>
        <AppShell>{children}</AppShell>
      </StaffTermProvider>
    </AuthProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const { profile, loading, isAdmin, activeBranch, signOut } = useAuth();
  const isPublicPage = pathname === "/login" || pathname === "/signup";

  // 로그인/회원가입 페이지는 Nav 없이
  if (isPublicPage) return <>{children}</>;

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-400">불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 미로그인 → AuthContext가 /login으로 리다이렉트 처리
  if (!profile) return null;

  // 승인 대기 계정
  if ((profile.role as string) === "pending") {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="text-xl font-black text-zinc-900">승인 대기 중</h2>
          <p className="text-sm text-zinc-500">관리자가 계정을 승인하면 사용할 수 있습니다.<br />관리자에게 문의해주세요.</p>
          <p className="text-xs text-zinc-400">{profile.email}</p>
          <button onClick={signOut}
            className="w-full rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-600 hover:bg-zinc-50 transition text-sm">
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <KakaoAutoSender />
      <Nav />
      {/* 지점 배너 */}
      <div className={`px-4 py-1.5 text-xs font-semibold flex items-center justify-between ${
        isAdmin ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
      }`}>
        <span>
          {isAdmin
            ? "🔑 관리자 (전체 지점 접근)"
            : `📍 ${activeBranch || "미지정 지점"} · ${profile.full_name || profile.email}`}
        </span>
        <div className="flex items-center gap-2">
          <SyncBadge />
          <button
            onClick={signOut}
            className="text-white/70 hover:text-white transition text-xs underline"
          >
            로그아웃
          </button>
        </div>
      </div>
      {/* 모바일 하단 탭바 높이만큼 패딩 (md 이상에서는 불필요) */}
      <div className="pb-16 md:pb-0">
        {children}
      </div>

      {/* 카카오톡 문의 플로팅 버튼 (아이콘 전용) */}
      <a
        href="http://pf.kakao.com/_WxbPCX"
        target="_blank"
        rel="noopener noreferrer"
        title="카카오톡 문의하기"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition hover:scale-110 active:scale-95"
        style={{ backgroundColor: "#FEE500" }}
      >
        <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
          <path d="M10 2C5.58 2 2 5.02 2 8.75c0 2.4 1.52 4.5 3.82 5.7-.15.55-.55 2-.63 2.3-.1.37.14.37.29.27.12-.08 1.9-1.28 2.67-1.8.6.08 1.22.13 1.85.13 4.42 0 8-3.02 8-6.75C18 5.02 14.42 2 10 2z" fill="#3A1D1D"/>
          <circle cx="7" cy="8.75" r="1" fill="#FEE500"/>
          <circle cx="10" cy="8.75" r="1" fill="#FEE500"/>
          <circle cx="13" cy="8.75" r="1" fill="#FEE500"/>
        </svg>
      </a>
    </>
  );
}

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return <LandingBypass>{children}</LandingBypass>;
}
