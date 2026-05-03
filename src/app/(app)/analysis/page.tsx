"use client";

import { useState, useRef } from "react";

/* ── 타입 ─────────────────────────────────────────────────────────────── */
interface Place {
  id: string;
  name: string;
  category: string;
  distance: number;
  address: string;
}

interface AnalysisResult {
  address: string;
  radius: number;
  competitors: {
    total: number;
    gyms: number;
    ptCenters: number;
    pilates: number;
    yoga: number;
    crossfit: number;
    places: Place[];
  };
  competition: { score: number; label: string };
  insights: {
    ptMin: number; ptMax: number;
    gymMin: number; gymMax: number;
    marketing: string[];
    strategy: string[];
    target: string;
    bep: number;
  };
  analyzedAt: string;
}

/* ── 경쟁 강도 색상 ───────────────────────────────────────────────────── */
const INTENSITY_CLS: Record<string, { bg: string; text: string; bar: string }> = {
  낮음:      { bg: "bg-emerald-50",  text: "text-emerald-700", bar: "bg-emerald-400" },
  보통:      { bg: "bg-amber-50",    text: "text-amber-700",   bar: "bg-amber-400"   },
  높음:      { bg: "bg-orange-50",   text: "text-orange-700",  bar: "bg-orange-400"  },
  "매우 높음":{ bg: "bg-red-50",     text: "text-red-700",     bar: "bg-red-400"     },
};

/* ── 메인 ─────────────────────────────────────────────────────────────── */
export default function AnalysisPage() {
  const [address, setAddress] = useState("");
  const [radius,  setRadius]  = useState(500);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<AnalysisResult | null>(null);
  const [error,   setError]   = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  /* ── 분석 실행 ── */
  const handleAnalyze = async () => {
    if (!address.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), radius }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석 실패");
      setResult(data);
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /* ── 리포트 인쇄 ── */
  const handlePrint = () => window.print();

  const ic = result ? (INTENSITY_CLS[result.competition.label] ?? INTENSITY_CLS["보통"]) : null;

  return (
    <>
      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-area { display: block !important; }
          .no-print { display: none !important; }
        }
        @media screen { #print-area { display: block; } }
      `}</style>

      <div className="min-h-screen bg-zinc-50" id="print-area">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

          {/* 헤더 */}
          <div className="no-print">
            <h1 className="text-2xl font-black text-zinc-900">📍 상권 분석</h1>
            <p className="text-sm text-zinc-500 mt-0.5">주소 하나로 반경 내 경쟁·인구·가격 전략 자동 분석</p>
          </div>

          {/* 입력 카드 */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4 no-print shadow-sm">

            {/* 주소 */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                헬스장 주소 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 서울 마포구 홍대입구역 2번 출구"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>

            {/* 반경 */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">분석 반경</label>
              <div className="flex gap-2">
                {([300, 500, 1000] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
                      radius === r
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-zinc-500 border-zinc-200 hover:border-blue-300"
                    }`}
                  >
                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">
                🔹 도심: 300~500m · 외곽: 500m~1km 권장
              </p>
            </div>

            {/* 버튼 */}
            <button
              onClick={handleAnalyze}
              disabled={!address.trim() || loading}
              className="w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  데이터 수집 중... (카카오 실시간 조회)
                </>
              ) : (
                "🔍 상권 분석 시작"
              )}
            </button>
          </div>

          {/* 에러 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 flex gap-2 no-print">
              <span>⚠️</span>
              <div>
                <p className="font-semibold">{error}</p>
                {error.includes("KAKAO_REST_API_KEY") && (
                  <p className="mt-1 text-xs">
                    👉 <a href="https://developers.kakao.com" target="_blank" rel="noopener noreferrer" className="underline">
                      developers.kakao.com
                    </a>에서 앱 생성 후 REST API 키를 .env.local에 추가하세요.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 로딩 스켈레톤 */}
          {loading && (
            <div className="space-y-3 no-print">
              {["카카오 지도 API 주소 변환 중...", "반경 내 헬스장 검색 중...", "PT센터 · 필라테스 · 요가 검색 중...", "경영 인사이트 계산 중..."].map((msg, i) => (
                <div key={i} className="bg-white rounded-xl border border-zinc-100 p-3 flex items-center gap-3 animate-pulse">
                  <div className="w-4 h-4 rounded-full bg-blue-200 shrink-0" />
                  <p className="text-sm text-zinc-400">{msg}</p>
                </div>
              ))}
            </div>
          )}

          {/* ══ 리포트 ══════════════════════════════════════════════════ */}
          {result && (
            <div ref={reportRef} className="space-y-4">

              {/* 리포트 헤더 */}
              <div className="bg-zinc-900 text-white rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">📊 상권분석 리포트</p>
                    <p className="font-bold text-lg leading-snug">📍 {result.address}</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      반경 {result.radius >= 1000 ? `${result.radius / 1000}km` : `${result.radius}m`} ·{" "}
                      {new Date(result.analyzedAt).toLocaleDateString("ko-KR", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={handlePrint}
                    className="no-print flex-shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition"
                  >
                    🖨️ 인쇄
                  </button>
                </div>
              </div>

              {/* ── 1. 경쟁 현황 ── */}
              <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
                <h2 className="font-bold text-zinc-900 text-base">🏋️ 경쟁 현황</h2>

                <div className="flex items-center gap-4">
                  <div className="text-5xl font-black text-zinc-900">{result.competitors.total}</div>
                  <div className="flex-1">
                    <p className="text-sm text-zinc-500 mb-1">반경 내 피트니스 업체 수</p>
                    <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${ic?.bg} ${ic?.text}`}>
                      경쟁 강도: {result.competition.label}
                    </span>
                  </div>
                </div>

                {/* 강도 바 */}
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${ic?.bar}`}
                    style={{ width: `${Math.min(100, (result.competitors.total / 15) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-400">0개(독점) ← &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; → 15개 이상(포화)</p>

                {/* 업종별 카운트 */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "헬스장",   value: result.competitors.gyms,      icon: "🏋️" },
                    { label: "PT센터",   value: result.competitors.ptCenters,  icon: "💪" },
                    { label: "필라테스", value: result.competitors.pilates,    icon: "🧘" },
                    { label: "요가",     value: result.competitors.yoga,       icon: "🙏" },
                    { label: "크로스핏", value: result.competitors.crossfit,   icon: "🔥" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="bg-zinc-50 rounded-xl p-2 text-center">
                      <p className="text-xl mb-0.5">{icon}</p>
                      <p className="text-xl font-black text-zinc-900">{value}</p>
                      <p className="text-[10px] text-zinc-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 2. 주변 업체 목록 ── */}
              {result.competitors.places.length > 0 && (
                <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
                  <h2 className="font-bold text-zinc-900 text-base">
                    📋 주변 업체 목록 ({result.competitors.places.length}개)
                  </h2>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {result.competitors.places.map((place, i) => (
                      <div
                        key={place.id}
                        className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0"
                      >
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{place.name}</p>
                          <p className="text-xs text-zinc-400 truncate">
                            {place.category.split(" > ").slice(-1)[0]}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${
                          place.distance <= 200 ? "bg-red-50 text-red-600"
                          : place.distance <= 500 ? "bg-orange-50 text-orange-600"
                          : "bg-zinc-100 text-zinc-500"
                        }`}>
                          {place.distance}m
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-300">🔴 200m 이내 직접 경쟁 · 🟠 500m 이내 근접 경쟁</p>
                </div>
              )}

              {/* ── 3. 가격 전략 ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-600 text-white rounded-2xl p-4 space-y-1">
                  <p className="text-xs text-blue-200">💪 추천 PT 가격</p>
                  <p className="text-3xl font-black">
                    {result.insights.ptMin}~{result.insights.ptMax}
                    <span className="text-lg font-semibold ml-1">만원</span>
                  </p>
                  <p className="text-xs text-blue-200">1회 기준</p>
                </div>
                <div className="bg-emerald-600 text-white rounded-2xl p-4 space-y-1">
                  <p className="text-xs text-emerald-200">🏋️ 추천 헬스 월회원</p>
                  <p className="text-3xl font-black">
                    {result.insights.gymMin}~{result.insights.gymMax}
                    <span className="text-lg font-semibold ml-1">만원</span>
                  </p>
                  <p className="text-xs text-emerald-200">월 기준</p>
                </div>
              </div>

              {/* ── 4. 경영 인사이트 ── */}
              <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-5">
                <h2 className="font-bold text-zinc-900 text-base">🎯 경영 인사이트</h2>

                {/* 타겟 고객 */}
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-1.5">주요 타겟 고객</p>
                  <div className="bg-blue-50 rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-800">
                    👥 {result.insights.target}
                  </div>
                </div>

                {/* 피크타임 */}
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-1.5">피크 시간대</p>
                  <div className="bg-zinc-50 rounded-xl px-3 py-2.5 text-sm text-zinc-700">
                    ⏰ 평일 18:00~21:00 (직장인) · 오전 09:00~11:00 (주부·시니어)
                  </div>
                </div>

                {/* 마케팅 채널 */}
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-2">추천 마케팅 채널</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.insights.marketing.map((ch) => (
                      <span
                        key={ch}
                        className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 차별화 전략 */}
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-2">차별화 전략</p>
                  <ul className="space-y-2">
                    {result.insights.strategy.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-zinc-700">
                        <span className="text-blue-500 shrink-0 font-bold">{i + 1}.</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 예상 BEP */}
                <div className={`rounded-xl p-4 ${ic?.bg} border border-zinc-200`}>
                  <p className={`text-xs font-semibold mb-1 ${ic?.text}`}>📊 예상 손익분기점 (BEP)</p>
                  <div className="flex items-end gap-2">
                    <p className={`text-4xl font-black ${ic?.text}`}>{result.insights.bep}</p>
                    <p className={`text-base font-semibold mb-1 ${ic?.text}`}>명</p>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    이 상권에서 월 PT 회원 {result.insights.bep}명 확보 시 손익분기 도달 추정
                  </p>
                </div>
              </div>

              {/* ── 5. 종합 평가 ── */}
              <div className="bg-zinc-900 text-white rounded-2xl p-5 space-y-3">
                <h2 className="font-bold text-base">📝 종합 평가</h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    {
                      label: "입지 매력도",
                      value: result.competition.score <= 2 ? "★★★★★" : result.competition.score === 3 ? "★★★★☆" : "★★★☆☆",
                      sub: result.competition.score <= 2 ? "우수" : result.competition.score === 3 ? "양호" : "보통",
                    },
                    {
                      label: "가격 책정권",
                      value: result.competition.score <= 2 ? "★★★★★" : result.competition.score === 3 ? "★★★☆☆" : "★★☆☆☆",
                      sub: result.competition.score <= 2 ? "프리미엄 가능" : result.competition.score === 3 ? "시장가" : "경쟁가",
                    },
                    {
                      label: "신규 창업",
                      value: result.competition.score <= 2 ? "강력 추천" : result.competition.score === 3 ? "검토 필요" : "재검토 권고",
                      sub: result.competition.score <= 2 ? "✅" : result.competition.score === 3 ? "⚠️" : "❌",
                    },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="bg-white/10 rounded-xl p-3">
                      <p className="text-[10px] text-zinc-400 mb-1">{label}</p>
                      <p className="text-xs font-bold text-yellow-300">{value}</p>
                      <p className="text-xs text-zinc-300 mt-1">{sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 재분석 + 인쇄 */}
              <div className="flex gap-3 no-print">
                <button
                  onClick={() => { setResult(null); setAddress(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="flex-1 rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-600 hover:bg-zinc-50 transition"
                >
                  🔄 새 주소 분석
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-[2] rounded-xl bg-zinc-900 py-3 font-bold text-white hover:bg-zinc-700 transition"
                >
                  🖨️ 리포트 인쇄 / PDF 저장
                </button>
              </div>

              {/* 데이터 출처 */}
              <p className="text-xs text-zinc-300 text-center no-print pb-4">
                📡 데이터 출처: 카카오맵 실시간 업체 DB · 분석 기준일 {new Date(result.analyzedAt).toLocaleDateString("ko-KR")}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
