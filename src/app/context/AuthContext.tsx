"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { UserProfile, getSession, getUserProfile, signOut as authSignOut } from "../lib/auth";
import { BUSINESS_CONFIGS, BusinessType } from "../lib/store";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  activeBranch: string;
  isAdmin: boolean;          // 헬스장 관리자 (superadmin)
  isPlatformOwner: boolean;  // 핏보스 총관리자 (platform_admin)
  businessType: BusinessType;
  businessConfig: typeof BUSINESS_CONFIGS[BusinessType];
  signOut: () => void;
}

const DEFAULT_CONFIG = BUSINESS_CONFIGS["기타"];

const AuthContext = createContext<AuthContextType>({
  profile: null,
  loading: true,
  activeBranch: "전체",
  isAdmin: false,
  isPlatformOwner: false,
  businessType: "기타",
  businessConfig: DEFAULT_CONFIG,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const init = useCallback(async () => {
    const session = await getSession();
    if (!session) {
      if (pathname !== "/login" && pathname !== "/signup") router.replace("/login");
      setLoading(false);
      return;
    }
    const p = await getUserProfile();
    if (!p) {
      // 프로필 없으면 로그아웃
      await authSignOut();
      router.replace("/login");
      setLoading(false);
      return;
    }
    setProfile(p);
    setLoading(false);
  }, [pathname, router]);

  useEffect(() => {
    init();
  }, [init]);

  const handleSignOut = async () => {
    await authSignOut();
    setProfile(null);
    router.replace("/login");
  };

  const isPlatformOwner = profile?.role === "platform_admin";
  const isAdmin = profile?.role === "superadmin" || isPlatformOwner;
  const activeBranch = isAdmin ? "" : (profile?.branch ?? "");
  const businessType: BusinessType = (profile?.business_type as BusinessType) ?? "기타";
  const businessConfig = BUSINESS_CONFIGS[businessType] ?? BUSINESS_CONFIGS["기타"];

  return (
    <AuthContext.Provider value={{ profile, loading, activeBranch, isAdmin, isPlatformOwner, businessType, businessConfig, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
