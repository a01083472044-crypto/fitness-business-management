"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { StaffTermProvider } from "../context/StaffTermContext";
import Nav from "./Nav";
import KakaoAutoSender from "./KakaoAutoSender";
import SyncBadge from "./SyncBadge";

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
      {children}
    </>
  );
}

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StaffTermProvider>
        <AppShell>{children}</AppShell>
      </StaffTermProvider>
    </AuthProvider>
  );
}
