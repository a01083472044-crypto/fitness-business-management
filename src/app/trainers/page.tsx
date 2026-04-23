"use client";

import { useState, useEffect } from "react";
import { getTrainers, saveTrainers, Trainer, SalaryType } from "../lib/store";

const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function emptyTrainer(): Trainer {
  return {
    id: crypto.randomUUID(),
    name: "",
    phone: "",
    branch: "",
    status: "재직",
    empType: "정규직",
    joinDate: new Date().toISOString().slice(0, 10),
    memo: "",
    salaryType: "base+rate" as SalaryType,
    baseSalary: 0,
    commRate: 50,
    sessionFee: 0,
  };
}

type FilterType = "전체" | "재직" | "퇴사";

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [filter, setFilter] = useState<FilterType>("재직");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Trainer>(emptyTrainer());

  useEffect(() => {
    setTrainers(getTrainers());
  }, []);

  const persist = (updated: Trainer[]) => {
    setTrainers(updated);
    saveTrainers(updated);
  };

  const openAdd = () => {
    setForm(emptyTrainer());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (t: Trainer) => {
    setForm({ ...t });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      persist(trainers.map((t) => (t.id === editingId ? form : t)));
    } else {
      persist([...trainers, { ...form, id: crypto.randomUUID() }]);
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("트레이너를 삭제하시겠습니까?")) {
      persist(trainers.filter((t) => t.id !== id));
    }
  };

  const toggleStatus = (t: Trainer) => {
    persist(trainers.map((tr) =>
      tr.id === t.id ? { ...tr, status: tr.status === "재직" ? "퇴사" : "재직" } : tr
    ));
  };

  const active    = trainers.filter((t) => t.status === "재직");
  const inactive  = trainers.filter((t) => t.status === "퇴사");
  const fullTime  = active.filter((t) => t.empType === "정규직");
  const freelance = active.filter((t) => t.empType === "프리랜서");

  const filtered =
    filter === "재직"  ? active   :
    filter === "퇴사"  ? inactive : trainers;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">트레이너 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">재직 트레이너 현황 및 고용 형태 관리</p>
          </div>
          <button
            onClick={openAdd}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            + 등록
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "재직",    value: active.length,    color: "text-zinc-900" },
            { label: "퇴사",    value: inactive.length,  color: "text-zinc-400" },
            { label: "정규직",  value: fullTime.length,  color: "text-blue-600" },
            { label: "프리랜서",value: freelance.length, color: "text-emerald-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-zinc-100 p-3 text-center">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{value}<span className="text-xs font-normal ml-0.5">명</span></p>
            </div>
          ))}
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
          {(["재직", "퇴사", "전체"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                filter === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {f}
              <span className="ml-1 text-xs font-normal">
                ({f === "재직" ? active.length : f === "퇴사" ? inactive.length : trainers.length})
              </span>
            </button>
          ))}
        </div>

        {/* 트레이너 목록 */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center text-zinc-400 text-sm">
            {filter === "재직" ? "재직 중인 트레이너가 없습니다." : "해당 트레이너가 없습니다."}<br />
            <button onClick={openAdd} className="mt-3 text-blue-500 font-semibold">+ 트레이너 등록하기</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <div
                key={t.id}
                className={`bg-white rounded-2xl border p-4 transition ${
                  t.status === "퇴사" ? "border-zinc-100 opacity-60" : "border-zinc-100"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* 아바타 이니셜 */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 ${
                      t.empType === "정규직" ? "bg-blue-500" : "bg-emerald-500"
                    }`}>
                      {t.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-zinc-900">{t.name}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          t.empType === "정규직"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}>{t.empType}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          t.status === "재직"
                            ? "bg-zinc-100 text-zinc-600"
                            : "bg-red-50 text-red-400"
                        }`}>{t.status}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.branch && <p className="text-xs text-zinc-400">📍 {t.branch}</p>}
                        {t.phone && <p className="text-xs text-zinc-400">📞 {t.phone}</p>}
                      </div>
                      {t.joinDate && (
                        <p className="text-xs text-zinc-300 mt-0.5">입사일 {t.joinDate}</p>
                      )}
                      {(t.baseSalary > 0 || t.commRate > 0) && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          💰 {t.salaryType === "base+rate"
                            ? `기본 ${(t.baseSalary/10000).toFixed(0)}만 + ${t.commRate}% 배분`
                            : t.salaryType === "rate"
                            ? `${t.commRate}% 배분`
                            : `기본 ${(t.baseSalary/10000).toFixed(0)}만 + 회당 ${(t.sessionFee/10000).toFixed(1)}만`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex flex-col gap-1 items-end">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-xs text-zinc-400 hover:text-blue-500 transition"
                      >수정</button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-xs text-zinc-400 hover:text-red-500 transition"
                      >삭제</button>
                    </div>
                    <button
                      onClick={() => toggleStatus(t)}
                      className={`text-xs px-2 py-1 rounded-lg border transition ${
                        t.status === "재직"
                          ? "border-red-200 text-red-400 hover:bg-red-50"
                          : "border-emerald-200 text-emerald-500 hover:bg-emerald-50"
                      }`}
                    >
                      {t.status === "재직" ? "퇴사 처리" : "재직 복귀"}
                    </button>
                  </div>
                </div>

                {t.memo && (
                  <p className="mt-3 text-xs text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2">
                    💬 {t.memo}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl p-6 w-full max-w-lg mx-0 sm:mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <p className="font-bold text-zinc-900 text-lg">
              {editingId ? "트레이너 수정" : "트레이너 등록"}
            </p>

            {/* 고용 형태 */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 mb-2">고용 형태</p>
              <div className="flex gap-2">
                {(["정규직", "프리랜서"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setForm({ ...form, empType: type })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
                      form.empType === type
                        ? type === "정규직"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-zinc-500 border-zinc-200"
                    }`}
                  >
                    {type}
                    <span className="ml-1 text-xs font-normal opacity-70">
                      {type === "정규직" ? "(4대보험)" : "(3.3%)"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 급여 구조 */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-500">급여 구조</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "base+rate",  label: "기본급\n+배분율"    },
                  { key: "rate",       label: "배분율\n만"          },
                  { key: "base+fixed", label: "기본급\n+고정수업료" },
                ] as { key: SalaryType; label: string }[]).map(({ key, label }) => (
                  <button key={key} type="button"
                    onClick={() => setForm({ ...form, salaryType: key })}
                    className={`py-2 rounded-xl border text-xs font-semibold whitespace-pre-line transition ${
                      form.salaryType === key
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-zinc-500 border-zinc-200"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* 기본급 — base+rate, base+fixed */}
              {(form.salaryType === "base+rate" || form.salaryType === "base+fixed") && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                    {form.salaryType === "base+rate" ? "기본급/기본지원금 (월)" : "기본급 (월)"}
                  </label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="1" placeholder="0"
                      value={form.baseSalary ? form.baseSalary / 10000 : ""}
                      onChange={(e) => setForm({ ...form, baseSalary: Math.round(Number(e.target.value) * 10000) })}
                      className={inputCls + " pr-14"}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400 pointer-events-none">만원</span>
                  </div>
                  {form.baseSalary > 0 && (
                    <p className="mt-1.5 text-xs text-blue-600 font-semibold">
                      = {form.baseSalary.toLocaleString()}원
                    </p>
                  )}
                </div>
              )}

              {/* 배분율 — base+rate, rate */}
              {(form.salaryType === "base+rate" || form.salaryType === "rate") && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                    매출 배분율: <span className="text-blue-600 font-bold">{form.commRate}%</span>
                  </label>
                  <input type="range" min="10" max="80" value={form.commRate}
                    onChange={(e) => setForm({ ...form, commRate: Number(e.target.value) })}
                    className="w-full accent-blue-600" />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>10%</span><span className="text-blue-600">40~60% 권장</span><span>80%</span>
                  </div>
                </div>
              )}

              {/* 고정 수업료 — base+fixed */}
              {form.salaryType === "base+fixed" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">고정 수업료 (회당)</label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.1" placeholder="0"
                      value={form.sessionFee ? form.sessionFee / 10000 : ""}
                      onChange={(e) => setForm({ ...form, sessionFee: Math.round(Number(e.target.value) * 10000) })}
                      className={inputCls + " pr-14"}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400 pointer-events-none">만원</span>
                  </div>
                  {form.sessionFee > 0 && (
                    <p className="mt-1.5 text-xs text-blue-600 font-semibold">
                      = {form.sessionFee.toLocaleString()}원 / 회
                    </p>
                  )}
                </div>
              )}
            </div>

            <Field label="이름" required>
              <input
                type="text"
                placeholder="트레이너 이름"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="연락처">
              <input
                type="tel"
                placeholder="010-0000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="근무 지점">
              <input
                type="text"
                placeholder="예: 홍대점, 합정점"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="입사일">
              <input
                type="date"
                value={form.joinDate}
                onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                className={inputCls}
              />
            </Field>

            {/* 재직 상태 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-500">재직 상태</p>
              </div>
              <div className="flex gap-2">
                {(["재직", "퇴사"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, status: s })}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                      form.status === s
                        ? s === "재직"
                          ? "bg-zinc-800 text-white border-zinc-800"
                          : "bg-red-500 text-white border-red-500"
                        : "bg-white text-zinc-400 border-zinc-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Field label="메모 (선택)">
              <textarea
                placeholder="특기사항, 담당 프로그램 등"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                rows={2}
                className={inputCls + " resize-none"}
              />
            </Field>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-600 hover:bg-zinc-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.name.trim()}
                className="flex-[2] rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
