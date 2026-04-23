"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getBranches } from "../lib/store";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  branch: string;
  role: string;
  gym_code: string;
  created_at: string;
}

const inputCls = "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm";

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers]         = useState<UserProfile[]>([]);
  const [branches, setBranches]   = useState<string[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState("");

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [branch, setBranch]     = useState("");
  const [role, setRole]         = useState<"superadmin" | "branch">("branch");
  const [gymCode, setGymCode]   = useState("");
  const [customBranch, setCustomBranch] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/");
  }, [loading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      setBranches(getBranches());
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("user_profiles").select("*").order("created_at");
    setUsers(data ?? []);
  };

  const handleCreate = async () => {
    if (!supabase) return;
    if (!email || !password || !fullName) {
      setMsg("이메일, 비밀번호, 이름은 필수입니다.");
      return;
    }
    const finalBranch = branch === "__custom__" ? customBranch : branch;
    setSaving(true);
    setMsg("");

    // Supabase Auth 계정 생성 (서비스 롤 키 필요 → 여기서는 직접 DB insert)
    // 실제로는 Supabase Dashboard에서 계정 생성 후 프로필만 입력
    const { data: { user }, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signUpError || !user) {
      setMsg("계정 생성 실패: " + (signUpError?.message ?? "알 수 없는 오류"));
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase.from("user_profiles").insert({
      id: user.id,
      email,
      full_name: fullName,
      branch: finalBranch,
      role,
      gym_code: gymCode,
    });

    if (profileError) {
      setMsg("프로필 저장 실패: " + profileError.message);
    } else {
      setMsg("✅ 계정이 생성됐습니다.");
      setShowForm(false);
      setEmail(""); setPassword(""); setFullName(""); setBranch(""); setRole("branch"); setGymCode("");
      loadUsers();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, userEmail: string) => {
    if (!supabase) return;
    if (!confirm(`"${userEmail}" 계정을 삭제하시겠습니까?`)) return;
    await supabase.from("user_profiles").delete().eq("id", id);
    loadUsers();
  };

  const handleApprove = async (u: UserProfile) => {
    if (!supabase) return;
    const approvedBranch = prompt(`"${u.full_name || u.email}" 계정에 배정할 지점명을 입력하세요:\n(관리자로 승인하려면 ADMIN 입력)`, "");
    if (approvedBranch === null) return;
    const isApproveAdmin = approvedBranch.trim().toUpperCase() === "ADMIN";
    await supabase.from("user_profiles").update({
      branch: isApproveAdmin ? "" : approvedBranch.trim(),
      role:   isApproveAdmin ? "superadmin" : "branch",
    }).eq("id", u.id);
    setMsg(`✅ "${u.full_name || u.email}" 계정이 승인됐습니다.`);
    loadUsers();
  };

  if (loading) return null;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">계정 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">지점별 로그인 계정 관리</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setMsg(""); }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            + 계정 추가
          </button>
        </div>

        {msg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            msg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}>{msg}</div>
        )}

        {/* 안내 배너 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
          <p className="font-bold">📌 계정 생성 안내</p>
          <p>• <strong>관리자(superadmin)</strong>: 전체 지점 데이터 접근 가능</p>
          <p>• <strong>지점(branch)</strong>: 지정된 지점 데이터만 접근 가능</p>
          <p>• 헬스장 코드는 동기화 탭의 코드와 동일하게 입력하세요</p>
        </div>

        {/* 계정 목록 */}
        <div className="space-y-3">
          {users.length === 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center text-zinc-400 text-sm">
              등록된 계정이 없습니다.
            </div>
          )}
          {users.map((u) => (
            <div key={u.id} className={`bg-white rounded-2xl border p-4 ${
              u.role === "pending" ? "border-amber-200 bg-amber-50" : "border-zinc-100"
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-zinc-900">{u.full_name || u.email}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      u.role === "superadmin" ? "bg-blue-50 text-blue-600"
                      : u.role === "pending"  ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {u.role === "superadmin" ? "관리자" : u.role === "pending" ? "⏳ 승인대기" : "지점"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{u.email}</p>
                  {u.branch && <p className="text-xs text-zinc-500 mt-0.5">📍 {u.branch}</p>}
                  {u.gym_code && <p className="text-xs text-zinc-400 mt-0.5">🔑 {u.gym_code}</p>}
                </div>
                <div className="flex gap-2 items-center">
                  {u.role === "pending" && (
                    <button
                      onClick={() => handleApprove(u)}
                      className="text-xs text-emerald-600 font-semibold hover:text-emerald-800 transition bg-emerald-50 px-2 py-1 rounded-lg"
                    >
                      승인
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(u.id, u.email)}
                    className="text-xs text-zinc-400 hover:text-red-500 transition"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 계정 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl p-6 w-full max-w-lg mx-0 sm:mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <p className="font-bold text-zinc-900 text-lg">새 계정 추가</p>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">이름 *</label>
              <input type="text" placeholder="홍길동" value={fullName}
                onChange={(e) => setFullName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">이메일 *</label>
              <input type="email" placeholder="branch@gym.com" value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">비밀번호 *</label>
              <input type="password" placeholder="8자 이상" value={password}
                onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </div>

            {/* 역할 */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-2">역할</label>
              <div className="flex gap-2">
                {(["branch", "superadmin"] as const).map((r) => (
                  <button key={r} onClick={() => setRole(r)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
                      role === r
                        ? r === "superadmin"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-zinc-500 border-zinc-200"
                    }`}>
                    {r === "superadmin" ? "관리자 (전체)" : "지점 담당"}
                  </button>
                ))}
              </div>
            </div>

            {/* 지점 */}
            {role === "branch" && (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">담당 지점</label>
                <select value={branch} onChange={(e) => setBranch(e.target.value)} className={inputCls}>
                  <option value="">지점 선택</option>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                  <option value="__custom__">직접 입력</option>
                </select>
                {branch === "__custom__" && (
                  <input type="text" placeholder="지점명 입력 (예: 강남점)" value={customBranch}
                    onChange={(e) => setCustomBranch(e.target.value)}
                    className={inputCls + " mt-2"} />
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">헬스장 코드 (동기화용)</label>
              <input type="text" placeholder="sync 탭의 헬스장 코드" value={gymCode}
                onChange={(e) => setGymCode(e.target.value)} className={inputCls} />
            </div>

            {msg && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                msg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              }`}>{msg}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowForm(false); setMsg(""); }}
                className="flex-1 rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-600 hover:bg-zinc-50 transition">
                취소
              </button>
              <button onClick={handleCreate} disabled={saving || !email || !password || !fullName}
                className="flex-[2] rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition">
                {saving ? "생성 중..." : "계정 생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
