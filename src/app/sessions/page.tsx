"use client";

import { useState, useEffect, useMemo } from "react";
import { getMembers, saveMembers, getTrainers, getBranches, syncMemberTotals, Member, SessionPackage, Trainer, ClassType } from "../lib/store";
import { useStaffTerm } from "../context/StaffTermContext";

function formatKRW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function parseKorean(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[원,\s]/g, "").trim();
  if (!cleaned) return 0;
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  let total = 0; let remaining = cleaned;
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

const inputCls = "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm";

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

// 잔여 회차에 따른 배지 색상
function RemainBadge({ remain }: { remain: number }) {
  if (remain === 0) return (
    <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
      🔴 잔여 0회
    </span>
  );
  if (remain <= 3) return (
    <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
      ⚠️ 잔여 {remain}회
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 text-xs font-semibold px-2 py-0.5 rounded-full">
      잔여 {remain}회
    </span>
  );
}

type FilterType = "진행중" | "완료" | "전체";

// 패키지 + 소속 회원 정보를 합친 뷰 타입
interface PackageView {
  pkg: SessionPackage;
  member: Member;
}

// 새 패키지 기본값
function emptyPkg(member?: Member, trainers?: Trainer[]): Partial<SessionPackage> & { memberId?: string; paymentInput?: string } {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: crypto.randomUUID(),
    name: member ? `${member.name} 수업` : "",
    trainerName: member?.trainer || (trainers?.[0]?.name ?? ""),
    trainerType: (member?.trainerType as "정규직" | "프리랜서" | "") || "",
    totalSessions: 0,
    conductedSessions: 0,
    paymentAmount: 0,
    registeredAt: today,
    memberId: member?.id,
    paymentInput: "",
  };
}

export default function SessionsPage() {
  const { staffTerm } = useStaffTerm();
  const [members, setMembers]       = useState<Member[]>([]);
  const [trainers, setTrainers]     = useState<Trainer[]>([]);
  const [savedBranches, setSavedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("전체");
  const [filter, setFilter]         = useState<FilterType>("진행중");
  const [trainerFilter, setTrainerFilter] = useState<string>("전체");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<{ memberId: string; pkgId: string } | null>(null);

  // 폼 상태
  const [selMemberId, setSelMemberId] = useState<string>("");
  const [pkgName,  setPkgName]   = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [trainerType, setTrainerType] = useState<"정규직" | "프리랜서" | "">("");
  const [totalSessions, setTotalSessions] = useState("");
  const [conductedSessions, setConductedSessions] = useState("");
  const [paymentInput, setPaymentInput] = useState("");
  const [registeredAt, setRegisteredAt] = useState(new Date().toISOString().slice(0, 10));
  const [classType, setClassType] = useState<ClassType>("1:1");
  const [groupSize, setGroupSize] = useState<number>(2);
  const [groupDirect, setGroupDirect] = useState(false);
  const [groupSizeText, setGroupSizeText] = useState("");

  useEffect(() => {
    setMembers(getMembers());
    setTrainers(getTrainers().filter((t) => t.status === "재직"));
    setSavedBranches(getBranches());
  }, []);

  // 트레이너명 → 지점 매핑
  const trainerBranchMap = useMemo(() =>
    Object.fromEntries(trainers.map((t) => [t.name, t.branch || ""])),
    [trainers]
  );

  // 지점 목록 (저장된 지점 + 트레이너 지점 합산)
  const branches = useMemo(() => {
    const fromTrainers = trainers.map((t) => t.branch).filter(Boolean);
    const merged = Array.from(new Set([...savedBranches, ...fromTrainers]));
    return ["전체", ...merged];
  }, [trainers, savedBranches]);

  // 모든 패키지를 뷰로 펼치기
  const allPackages: PackageView[] = useMemo(() =>
    members.flatMap((m) =>
      (m.packages ?? []).map((pkg) => ({ pkg, member: m }))
    ), [members]);

  // 지점 필터 적용된 패키지
  const branchPackages = useMemo(() =>
    selectedBranch === "전체"
      ? allPackages
      : allPackages.filter((v) => trainerBranchMap[v.pkg.trainerName] === selectedBranch),
    [allPackages, selectedBranch, trainerBranchMap]
  );

  // 담당 트레이너 목록 (지점 필터 후 추출)
  const trainerNames = useMemo(() => {
    const names = [...new Set(branchPackages.map((v) => v.pkg.trainerName).filter(Boolean))];
    return names;
  }, [branchPackages]);

  // 필터 적용
  const filtered = useMemo(() => {
    let list = branchPackages;
    if (filter === "진행중") list = list.filter((v) => v.pkg.totalSessions - v.pkg.conductedSessions > 0);
    if (filter === "완료")   list = list.filter((v) => v.pkg.totalSessions - v.pkg.conductedSessions === 0);
    if (trainerFilter !== "전체") list = list.filter((v) => v.pkg.trainerName === trainerFilter);
    // 잔여 적은 것부터 정렬
    return [...list].sort((a, b) => {
      const ra = a.pkg.totalSessions - a.pkg.conductedSessions;
      const rb = b.pkg.totalSessions - b.pkg.conductedSessions;
      return ra - rb;
    });
  }, [branchPackages, filter, trainerFilter]);

  // 통계 (지점 필터 기준)
  const active   = branchPackages.filter((v) => v.pkg.totalSessions - v.pkg.conductedSessions > 0).length;
  const done     = branchPackages.filter((v) => v.pkg.totalSessions - v.pkg.conductedSessions === 0).length;
  const urgent   = branchPackages.filter((v) => {
    const r = v.pkg.totalSessions - v.pkg.conductedSessions;
    return r === 0;
  }).length;
  const lowAlert = branchPackages.filter((v) => {
    const r = v.pkg.totalSessions - v.pkg.conductedSessions;
    return r > 0 && r <= 3;
  }).length;

  // ── 패키지 저장 공통 함수 ─────────────────────────────────────────────────
  const persistMembers = (updated: Member[]) => {
    setMembers(updated);
    saveMembers(updated);
  };

  // 수업 진행 +1
  const handleProgress = (memberId: string, pkgId: string) => {
    const updated = members.map((m) => {
      if (m.id !== memberId) return m;
      const pkgs = (m.packages ?? []).map((p) =>
        p.id === pkgId && p.conductedSessions < p.totalSessions
          ? { ...p, conductedSessions: p.conductedSessions + 1 }
          : p
      );
      return syncMemberTotals({ ...m, packages: pkgs });
    });
    persistMembers(updated);
  };

  // 폼 열기 (신규)
  const openAdd = () => {
    setEditing(null);
    setSelMemberId(members[0]?.id ?? "");
    const m = members[0];
    setPkgName(m ? `${m.name} 수업` : "");
    setTrainerName(m?.trainer ?? (trainers[0]?.name ?? ""));
    setTrainerType((m?.trainerType as "정규직" | "프리랜서" | "") ?? "");
    setTotalSessions("");
    setConductedSessions("");
    setPaymentInput("");
    setRegisteredAt(new Date().toISOString().slice(0, 10));
    setClassType("1:1");
    setGroupSize(2);
    setGroupDirect(false);
    setGroupSizeText("");
    setShowForm(true);
  };

  // 폼 열기 (수정)
  const openEdit = (v: PackageView) => {
    setEditing({ memberId: v.member.id, pkgId: v.pkg.id });
    setSelMemberId(v.member.id);
    setPkgName(v.pkg.name);
    setTrainerName(v.pkg.trainerName);
    setTrainerType(v.pkg.trainerType);
    setTotalSessions(String(v.pkg.totalSessions));
    setConductedSessions(String(v.pkg.conductedSessions));
    setPaymentInput(String(v.pkg.paymentAmount || ""));
    setRegisteredAt(v.pkg.registeredAt);
    const gs = v.pkg.groupSize ?? 2;
    setClassType(v.pkg.classType ?? "1:1");
    setGroupSize(gs);
    const presetSizes = [2, 3, 4, 5, 6, 7, 8];
    setGroupDirect(!presetSizes.includes(gs));
    setGroupSizeText(!presetSizes.includes(gs) ? String(gs) : "");
    setShowForm(true);
  };

  // 회원 선택 시 자동 채우기
  const handleMemberSelect = (memberId: string) => {
    setSelMemberId(memberId);
    const m = members.find((mb) => mb.id === memberId);
    if (!m) return;
    if (!editing) {
      setPkgName(`${m.name} 수업`);
      setTrainerName(m.trainer || (trainers[0]?.name ?? ""));
      setTrainerType((m.trainerType as "정규직" | "프리랜서" | "") || "");
    }
  };

  // 트레이너 선택 시 자동 채우기
  const handleTrainerSelect = (name: string) => {
    setTrainerName(name);
    const t = trainers.find((tr) => tr.name === name);
    if (t) setTrainerType(t.empType);
  };

  // 저장
  const handleSubmit = () => {
    if (!selMemberId || !pkgName.trim()) return;
    const paymentAmount = parseKorean(paymentInput);
    // editing 시 기존 패키지의 결제 수단/수수료 정보 보존
    const existingPkg = editing
      ? members.find((m) => m.id === selMemberId)?.packages?.find((p) => p.id === editing.pkgId)
      : undefined;
    const pkg: SessionPackage = {
      id: editing?.pkgId ?? crypto.randomUUID(),
      name: pkgName.trim(),
      trainerName,
      trainerType,
      classType,
      groupSize: classType === "1:1" ? 1 : groupSize,
      totalSessions: Number(totalSessions) || 0,
      conductedSessions: Number(conductedSessions) || 0,
      paymentAmount,
      paymentMethod: existingPkg?.paymentMethod ?? "",
      paymentFee: existingPkg?.paymentFee ?? 0,
      netAmount: paymentAmount - (existingPkg?.paymentFee ?? 0),
      registeredAt,
    };
    const updated = members.map((m) => {
      if (m.id !== selMemberId) return m;
      const existingPkgs = m.packages ?? [];
      const newPkgs = editing
        ? existingPkgs.map((p) => p.id === editing.pkgId ? pkg : p)
        : [...existingPkgs, pkg];
      return syncMemberTotals({ ...m, packages: newPkgs });
    });
    persistMembers(updated);
    setShowForm(false);
  };

  // 삭제
  const handleDelete = (memberId: string, pkgId: string) => {
    if (!confirm("패키지를 삭제하시겠습니까?")) return;
    const updated = members.map((m) => {
      if (m.id !== memberId) return m;
      const newPkgs = (m.packages ?? []).filter((p) => p.id !== pkgId);
      return syncMemberTotals({ ...m, packages: newPkgs });
    });
    persistMembers(updated);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">수업 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">회원별 PT 패키지 현황 및 회차 관리</p>
          </div>
          <button onClick={openAdd}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
            + 패키지 등록
          </button>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "진행중",   value: active,   color: "text-blue-600"    },
            { label: "완료",     value: done,     color: "text-zinc-400"    },
            { label: "🔴 잔여0", value: urgent,   color: "text-red-600"     },
            { label: "⚠️ 잔여≤3", value: lowAlert, color: "text-orange-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-zinc-100 p-3 text-center">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{value}<span className="text-xs font-normal ml-0.5">건</span></p>
            </div>
          ))}
        </div>

        {/* 지점 탭 */}
        {branches.length > 1 && (
          <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl overflow-x-auto scrollbar-hide">
            {branches.map((branch) => {
              const count = branch === "전체"
                ? allPackages.length
                : allPackages.filter((v) => trainerBranchMap[v.pkg.trainerName] === branch).length;
              return (
                <button key={branch}
                  onClick={() => { setSelectedBranch(branch); setTrainerFilter("전체"); }}
                  className={`flex-shrink-0 flex-1 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                    selectedBranch === branch
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-600"
                  }`}>
                  {branch}
                  <span className="ml-1 text-xs font-normal opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 상태 필터 */}
        <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
          {(["진행중", "완료", "전체"] as FilterType[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                filter === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              }`}>
              {f}
              <span className="ml-1 text-xs font-normal">
                ({f === "진행중" ? active : f === "완료" ? done : allPackages.length})
              </span>
            </button>
          ))}
        </div>

        {/* 트레이너 필터 */}
        {trainerNames.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {["전체", ...trainerNames].map((name) => (
              <button key={name} onClick={() => setTrainerFilter(name)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  trainerFilter === name
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-500 border-zinc-200"
                }`}>
                {name}
              </button>
            ))}
          </div>
        )}

        {/* 패키지 목록 */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center text-zinc-400 text-sm">
            {allPackages.length === 0
              ? <>등록된 패키지가 없습니다.<br /><button onClick={openAdd} className="mt-2 text-blue-500 font-semibold">+ 패키지 등록하기</button></>
              : branchPackages.length === 0
              ? <><strong>{selectedBranch}</strong>에 등록된 패키지가 없습니다.</>
              : "해당 조건의 패키지가 없습니다."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(({ pkg, member }) => {
              const remain = pkg.totalSessions - pkg.conductedSessions;
              const progress = pkg.totalSessions > 0 ? (pkg.conductedSessions / pkg.totalSessions) * 100 : 0;
              const isDone = remain === 0;
              return (
                <div key={pkg.id}
                  className={`bg-white rounded-2xl border p-4 space-y-3 ${
                    isDone ? "border-zinc-100 opacity-70" : remain <= 3 ? "border-orange-200" : "border-zinc-100"
                  }`}>
                  {/* 상단: 수업명 + 회원명 */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-zinc-900">{pkg.name}</p>
                        <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                          👤 {member.name}
                        </span>
                        {pkg.classType === "그룹" && (
                          <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                            👥 그룹 {pkg.groupSize}:1
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {pkg.trainerName && (
                          <p className="text-xs text-zinc-400">🏋️ {pkg.trainerName}</p>
                        )}
                        {pkg.trainerType && (
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                            pkg.trainerType === "정규직"
                              ? "bg-blue-50 text-blue-500"
                              : "bg-emerald-50 text-emerald-500"
                          }`}>{pkg.trainerType}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => openEdit({ pkg, member })}
                        className="text-xs text-zinc-400 hover:text-blue-500 transition">수정</button>
                      <button onClick={() => handleDelete(member.id, pkg.id)}
                        className="text-xs text-zinc-400 hover:text-red-500 transition">삭제</button>
                    </div>
                  </div>

                  {/* 진행 바 */}
                  <div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>진행 {pkg.conductedSessions} / {pkg.totalSessions}회</span>
                      <RemainBadge remain={remain} />
                    </div>
                    <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isDone ? "bg-zinc-400" : remain <= 3 ? "bg-orange-400" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* 하단: 결제금액 + 등록일 + 버튼 */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-400 space-y-0.5">
                      {pkg.paymentAmount > 0 && <p>결제 {formatKRW(pkg.paymentAmount)}</p>}
                      <p>등록일 {pkg.registeredAt}</p>
                    </div>
                    <button
                      onClick={() => handleProgress(member.id, pkg.id)}
                      disabled={isDone}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                        isDone
                          ? "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}>
                      {isDone ? "완료됨" : "수업 진행 +1"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl p-6 w-full max-w-lg mx-0 sm:mx-4 space-y-4 max-h-[92vh] overflow-y-auto">
            <p className="font-bold text-zinc-900 text-lg">
              {editing ? "패키지 수정" : "패키지 등록"}
            </p>

            {/* 회원 선택 */}
            <Field label="회원" required>
              <select value={selMemberId} onChange={(e) => handleMemberSelect(e.target.value)} className={inputCls}>
                <option value="">회원 선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.phone ? ` (${m.phone})` : ""}</option>
                ))}
              </select>
              {members.length === 0 && (
                <p className="mt-1 text-xs text-zinc-400">💡 회원 관리에서 먼저 회원을 등록하세요</p>
              )}
            </Field>

            {/* 수업명 */}
            <Field label="수업명" required>
              <input type="text" placeholder="예: 홍성은 수업" value={pkgName}
                onChange={(e) => setPkgName(e.target.value)} className={inputCls} />
            </Field>

            {/* 담당 트레이너 */}
            <Field label={`담당 ${staffTerm}`}>
              {trainers.length > 0 ? (
                <select value={trainerName} onChange={(e) => handleTrainerSelect(e.target.value)} className={inputCls}>
                  <option value="">{staffTerm} 선택</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.name}>{t.name} ({t.empType})</option>
                  ))}
                </select>
              ) : (
                <input type="text" placeholder={`${staffTerm} 이름`} value={trainerName}
                  onChange={(e) => setTrainerName(e.target.value)} className={inputCls} />
              )}
              <div className="flex gap-2 mt-2">
                {(["정규직", "프리랜서"] as const).map((type) => (
                  <button key={type} type="button"
                    onClick={() => setTrainerType(trainerType === type ? "" : type)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                      trainerType === type
                        ? type === "정규직"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-zinc-500 border-zinc-200"
                    }`}>{type}</button>
                ))}
              </div>
            </Field>

            {/* 회차 */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="결제 회차" required>
                <input type="number" min="0" placeholder="0" value={totalSessions}
                  onChange={(e) => setTotalSessions(e.target.value)} className={inputCls} />
              </Field>
              <Field label="진행 회차">
                <input type="number" min="0" placeholder="0" value={conductedSessions}
                  onChange={(e) => setConductedSessions(e.target.value)} className={inputCls} />
              </Field>
            </div>

            {/* 결제 금액 */}
            <Field label="결제 금액">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
                <input type="text" inputMode="text" placeholder="0 또는 만원" value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)} className={inputCls + " pl-8"} />
              </div>
              {parseKorean(paymentInput) > 0 && (
                <p className="mt-1 text-xs font-medium text-blue-500">
                  → {parseKorean(paymentInput).toLocaleString("ko-KR")}원
                </p>
              )}
            </Field>

            {/* 수업 유형 */}
            <Field label="수업 유형">
              <div className="flex gap-2">
                {(["1:1", "그룹"] as ClassType[]).map((type) => (
                  <button key={type} type="button"
                    onClick={() => setClassType(type)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
                      classType === type
                        ? type === "1:1"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                    }`}>
                    {type === "1:1" ? "👤 1:1" : "👥 그룹"}
                  </button>
                ))}
              </div>
              {classType === "그룹" && (
                <div className="mt-2 bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-purple-700">그룹 인원 수</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <button key={n} type="button"
                        onClick={() => { setGroupSize(n); setGroupDirect(false); setGroupSizeText(""); }}
                        className={`w-10 h-10 rounded-xl text-sm font-bold border transition ${
                          !groupDirect && groupSize === n
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-purple-700 border-purple-200 hover:border-purple-400"
                        }`}>
                        {n}
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => { setGroupDirect(true); setGroupSizeText(groupDirect ? groupSizeText : ""); }}
                      className={`px-3 h-10 rounded-xl text-sm font-bold border transition ${
                        groupDirect
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-purple-700 border-purple-200 hover:border-purple-400"
                      }`}>
                      직접입력
                    </button>
                  </div>
                  {groupDirect && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={2}
                        max={100}
                        placeholder="인원 수 입력"
                        value={groupSizeText}
                        onChange={(e) => {
                          setGroupSizeText(e.target.value);
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 2) setGroupSize(v);
                        }}
                        className="w-28 rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-purple-500 text-center font-bold"
                        autoFocus
                      />
                      <span className="text-sm text-purple-700 font-semibold">명</span>
                    </div>
                  )}
                  <p className="text-xs text-purple-600">현재: {groupSize}명 동시 수업 (각자 개별 결제)</p>
                </div>
              )}
            </Field>

            {/* 등록일 */}
            <Field label="등록일">
              <input type="date" value={registeredAt}
                onChange={(e) => setRegisteredAt(e.target.value)} className={inputCls} />
            </Field>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-600 hover:bg-zinc-50 transition">
                취소
              </button>
              <button onClick={handleSubmit} disabled={!selMemberId || !pkgName.trim()}
                className="flex-[2] rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
