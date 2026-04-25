"use client";

import { useState } from "react";
import { useStaffTerm, STAFF_PRESETS } from "../context/StaffTermContext";

export default function SettingsPage() {
  const { staffTerm, setStaffTerm } = useStaffTerm();
  const [customInput, setCustomInput] = useState("");
  const [saved, setSaved] = useState(false);

  const isCustom = !STAFF_PRESETS.slice(0, -1).some((p) => p.term === staffTerm);
  const activeCustom = isCustom ? staffTerm : "";

  const handlePreset = (term: string) => {
    if (term === "") return; // 직접 입력은 별도 처리
    setStaffTerm(term);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCustomSave = () => {
    const val = customInput.trim();
    if (!val) return;
    setStaffTerm(val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-black text-zinc-900">앱 설정</h1>
          <p className="text-sm text-zinc-500 mt-0.5">사업 유형에 맞게 직원 호칭을 설정하세요</p>
        </div>

        {/* 현재 적용 호칭 */}
        <div className="bg-blue-600 rounded-2xl p-5 text-white">
          <p className="text-xs text-blue-200 mb-1">현재 적용된 호칭</p>
          <p className="text-3xl font-black">{staffTerm}</p>
          <p className="text-xs text-blue-200 mt-1">
            네비게이션 · 모든 페이지에 반영됩니다
          </p>
        </div>

        {/* 사업 유형 선택 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <p className="font-bold text-zinc-900">사업 유형 선택</p>
          <p className="text-xs text-zinc-400">유형을 선택하면 호칭이 자동으로 변경됩니다</p>

          <div className="grid grid-cols-2 gap-3">
            {STAFF_PRESETS.slice(0, -1).map(({ type, term, icon }) => {
              const isActive = staffTerm === term && !isCustom;
              return (
                <button
                  key={type}
                  onClick={() => handlePreset(term)}
                  className={`rounded-xl border p-4 text-left transition ${
                    isActive
                      ? "bg-blue-50 border-blue-500"
                      : "bg-white border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <p className="text-2xl mb-1">{icon}</p>
                  <p className={`text-xs font-semibold ${isActive ? "text-blue-700" : "text-zinc-500"}`}>
                    {type}
                  </p>
                  <p className={`text-base font-black mt-0.5 ${isActive ? "text-blue-700" : "text-zinc-800"}`}>
                    {term}
                  </p>
                  {isActive && (
                    <p className="text-xs text-blue-500 mt-1 font-semibold">✓ 적용 중</p>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 직접 입력 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <p className="font-bold text-zinc-900">✏️ 직접 입력</p>
          <p className="text-xs text-zinc-400">위 목록에 없는 호칭을 직접 입력하세요</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={activeCustom || "예: 선생님, 인스트럭터..."}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomSave()}
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
            <button
              onClick={handleCustomSave}
              className="px-5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 transition"
            >
              적용
            </button>
          </div>
          {isCustom && (
            <p className="text-xs text-blue-600 font-semibold">✓ 현재 직접 입력 호칭 적용 중: {staffTerm}</p>
          )}
        </section>

        {/* 적용 범위 안내 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-2">
          <p className="font-bold text-zinc-900">📋 호칭이 적용되는 곳</p>
          <ul className="space-y-1.5 text-sm text-zinc-500">
            {[
              "네비게이션 메뉴 (트레이너 관리 → 강사 관리 등)",
              "트레이너 / 강사 관리 페이지",
              "회원 등록 담당 강사 선택",
              "수업 관리 · 수업 스케줄",
              "급여 정산 페이지",
              "수익 기여도 분석",
              "경영 리포트",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 저장 완료 토스트 */}
        {saved && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-sm font-semibold px-6 py-3 rounded-full shadow-lg">
            ✓ &quot;{staffTerm}&quot; 호칭이 적용되었습니다
          </div>
        )}
      </div>
    </div>
  );
}
