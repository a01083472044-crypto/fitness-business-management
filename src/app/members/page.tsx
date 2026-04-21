"use client";

import { useState, useEffect } from "react";
import { getMembers, saveMembers, Member, formatManwon } from "../lib/store";

function parseKorean(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[원,\s]/g, "").trim();
  if (!cleaned) return 0;
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  let total = 0;
  let remaining = cleaned;
  const match = (pattern: RegExp, unit: number) => {
    const m = remaining.match(pattern);
    if (m) { total += parseFloat(m[1]) * unit; remaining = remaining.slice(m[0].length); }
  };
  match(/^(\d+(?:\.\d+)?)억/, 100000000);
  match(/^(\d+(?:\.\d+)?)천만/, 10000000);
  match(/^(\d+(?:\.\d+)?)만/, 10000);
  match(/^(\d+(?:\.\d+)?)천/, 1000);
  if (/^\d+$/.test(remaining)) total += Number(remaining);
  return total || 0;
}

const empty = (): Member => ({
  id: crypto.randomUUID(),
  name: "",
  trainer: "",
  totalPayment: 0,
  totalSessions: 0,
  conductedSessions: 0,
});

function formatKRW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState<Member>(empty());
  const [paymentInput, setPaymentInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setMembers(getMembers());
  }, []);

  const persist = (updated: Member[]) => {
    setMembers(updated);
    saveMembers(updated);
  };

  const openAdd = () => {
    setForm(empty());
    setPaymentInput("");
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (m: Member) => {
    setForm({ ...m });
    setPaymentInput(String(m.totalPayment || ""));
    setEditingId(m.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("삭제하시겠습니까?")) {
      persist(members.filter((m) => m.id !== id));
    }
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      persist(members.map((m) => (m.id === editingId ? form : m)));
    } else {
      persist([...members, { ...form, id: crypto.randomUUID() }]);
    }
    setShowForm(false);
  };

  const totalPayment = members.reduce((s, m) => s + m.totalPayment, 0);
  const totalSessions = members.reduce((s, m) => s + m.totalSessions, 0);
  const conductedSessions = members.reduce((s, m) => s + m.conductedSessions, 0);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">회원 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">회원별 결제 및 수업 현황</p>
          </div>
          <button
            onClick={openAdd}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            + 회원 추가
          </button>
        </div>

        {/* 요약 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "총 결제금액", value: formatKRW(totalPayment) },
            { label: "총 판매 회차", value: `${totalSessions}회` },
            { label: "소진 회차", value: `${conductedSessions}회` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-zinc-100 p-3 text-center">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className="font-bold text-zinc-900 text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* 회원 목록 */}
        {members.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center text-zinc-400 text-sm">
            등록된 회원이 없습니다.<br />회원을 추가해주세요.
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl border border-zinc-100 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-zinc-900">{m.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{m.trainer || "트레이너 미지정"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(m)}
                      className="text-xs text-zinc-400 hover:text-blue-500 transition"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-xs text-zinc-400 hover:text-red-500 transition"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-50 rounded-lg p-2">
                    <p className="text-xs text-zinc-400">결제금액</p>
                    <p className="text-sm font-semibold text-zinc-800">{formatKRW(m.totalPayment)}</p>
                  </div>
                  <div className="bg-zinc-50 rounded-lg p-2">
                    <p className="text-xs text-zinc-400">총/소진</p>
                    <p className="text-sm font-semibold text-zinc-800">{m.totalSessions}/{m.conductedSessions}회</p>
                  </div>
                  <div className="bg-zinc-50 rounded-lg p-2">
                    <p className="text-xs text-zinc-400">잔여</p>
                    <p className="text-sm font-semibold text-zinc-800">{m.totalSessions - m.conductedSessions}회</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl p-6 w-full max-w-lg mx-0 sm:mx-4 space-y-4">
            <p className="font-bold text-zinc-900 text-lg">
              {editingId ? "회원 수정" : "회원 추가"}
            </p>

            <Field label="이름" required>
              <input
                type="text"
                placeholder="홍길동"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="담당 트레이너">
              <input
                type="text"
                placeholder="트레이너 이름"
                value={form.trainer}
                onChange={(e) => setForm({ ...form, trainer: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="총 결제금액">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
                <input
                  type="text"
                  inputMode="text"
                  placeholder="0 또는 만원"
                  value={paymentInput}
                  onChange={(e) => {
                    setPaymentInput(e.target.value);
                    setForm({ ...form, totalPayment: parseKorean(e.target.value) });
                  }}
                  className={inputCls + " pl-8"}
                />
              </div>
              {formatManwon(form.totalPayment) && (
                <p className="mt-1 text-xs font-medium text-blue-500">→ {formatManwon(form.totalPayment)}</p>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="총 판매 회차">
                <input
                  type="number"
                  placeholder="0"
                  value={form.totalSessions || ""}
                  onChange={(e) => setForm({ ...form, totalSessions: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label="소진 회차">
                <input
                  type="number"
                  placeholder="0"
                  value={form.conductedSessions || ""}
                  onChange={(e) => setForm({ ...form, conductedSessions: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
            </div>

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
