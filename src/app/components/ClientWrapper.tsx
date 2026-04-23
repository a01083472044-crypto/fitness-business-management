"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "../context/AuthContext";
import Nav from "./Nav";

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const { profile, loading, isAdmin, activeBranch, signOut } = useAuth();
  const isLogin   = pathname === "/login";

  // 로그인 페이지는 Nav 없이
  if (isLogin) return <>{children}</>;

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

  return (
    <>
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
        <button
          onClick={signOut}
          className="text-white/70 hover:text-white transition text-xs underline"
        >
          로그아웃
        </button>
      </div>
      {children}
    </>
  );
}

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
