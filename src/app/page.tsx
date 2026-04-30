import Link from "next/link";
import FaqAccordion from "./components/FaqAccordion";
import StickyNav from "./components/StickyNav";

/* ── 기능 카드 데이터 ───────────────────────────────────── */
const FEATURES = [
  { icon: "👥", title: "회원 관리", desc: "등록·수정·검색·만료 알림까지. 한 화면에서 전체 회원을 파악하세요." },
  { icon: "📊", title: "매출·수익 분석", desc: "순이익이 얼마인지 즉시 확인. 항목별 비용까지 자동 집계됩니다." },
  { icon: "🏋️", title: "트레이너 관리", desc: "PT 배정·급여 정산·실적 분석을 지점별로 한눈에 관리하세요." },
  { icon: "🗣️", title: "상담 관리", desc: "유입 경로 분석부터 전환율까지. 영업 퍼널을 데이터로 관리합니다." },
  { icon: "✅", title: "체크인 관리", desc: "QR 스캔 또는 수동 체크인. 월별 출석률과 미출석 회원을 자동 감지합니다." },
  { icon: "🔒", title: "락커 관리", desc: "번호 배정·만료일·빈 락커 현황을 시각적 그리드로 한눈에 확인합니다." },
  { icon: "🧾", title: "세금계산서·정산", desc: "강사 정산서 자동 생성, 세금계산서 발행 내역을 깔끔하게 관리합니다." },
  { icon: "☁️", title: "클라우드 동기화", desc: "PC·태블릿·스마트폰 어디서든 실시간 동기화. 데이터 손실 걱정 없습니다." },
];

const PAINS = [
  { before: "📋 엑셀로 회원 관리", after: "앱 하나로 전체 현황 즉시 파악" },
  { before: "💬 카카오톡으로 일정 공유", after: "지점·트레이너별 자동 스케줄 관리" },
  { before: "✏️ 수기 장부로 수익 계산", after: "실시간 매출·순이익 자동 집계" },
  { before: "🔍 락커 현황 일일이 확인", after: "시각적 그리드로 빈 락커 즉시 파악" },
];

const REVIEWS = [
  { name: "김○○ 원장", loc: "강남 PT 센터", text: "회원 만료 알림이 자동으로 오니까 놓치는 게 없어요. 매달 말일 장부 정리가 10분으로 줄었습니다." },
  { name: "이○○ 대표", loc: "홍대 피트니스", text: "지점이 3개인데 한 화면에서 다 볼 수 있어서 진짜 편해요. QR 체크인은 직원들이 특히 좋아합니다." },
  { name: "박○○ 원장", loc: "수원 헬스클럽", text: "기존에 쓰던 관리 프로그램보다 훨씬 직관적이에요. 설치도 필요 없고 폰에서도 바로 확인됩니다." },
];

const PLANS = [
  {
    name: "스타터", price: "무료", period: "",
    border: "border-zinc-200", badge: null,
    features: ["회원 관리 (50명)", "매출 기본 집계", "체크인 관리", "클라우드 자동저장"],
    cta: "무료로 시작", ctaClass: "bg-zinc-900 text-white hover:bg-zinc-700",
  },
  {
    name: "프로", price: "₩29,000", period: "/월",
    border: "border-blue-500 shadow-xl shadow-blue-100", badge: "가장 인기",
    features: ["회원 무제한", "트레이너·급여 관리", "상담 퍼널 분석", "락커 관리", "세금계산서·정산", "멀티 지점 관리", "우선 고객지원"],
    cta: "14일 무료 체험", ctaClass: "bg-blue-600 text-white hover:bg-blue-500",
  },
  {
    name: "엔터프라이즈", price: "문의", period: "",
    border: "border-zinc-200", badge: null,
    features: ["프로 전체 포함", "전용 온보딩", "맞춤형 기능 개발", "전담 매니저"],
    cta: "상담 요청", ctaClass: "bg-zinc-900 text-white hover:bg-zinc-700",
  },
];

const FAQS = [
  { q: "설치가 필요한가요?", a: "아닙니다. 웹 브라우저에서 바로 사용할 수 있습니다. PC·스마트폰·태블릿 모두 지원합니다." },
  { q: "기존 데이터를 옮길 수 있나요?", a: "네, 엑셀 데이터를 손쉽게 가져올 수 있도록 지원합니다. 온보딩 담당자가 도와드립니다." },
  { q: "인터넷이 없으면 어떻게 되나요?", a: "기기에 데이터가 로컬 저장되어 오프라인에서도 조회·입력이 가능합니다. 연결 복구 시 자동 동기화됩니다." },
  { q: "지점이 여러 개인데 관리가 되나요?", a: "지점 등록 후 회원·트레이너·매출을 지점별로 분리 관리할 수 있습니다." },
  { q: "무료 플랜에서 유료 전환 시 데이터가 유지되나요?", a: "100% 유지됩니다. 플랜 변경과 동시에 모든 기능이 즉시 활성화됩니다." },
];

const STATS = [
  { value: "2시간", label: "하루 절감 업무시간" },
  { value: "98%", label: "데이터 보존율" },
  { value: "500+", label: "사용 중인 헬스장" },
  { value: "14일", label: "무료 체험 기간" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">

      {/* ── STICKY NAV (client component) ─────────── */}
      <StickyNav />

      {/* ── HERO ─────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-zinc-950 via-blue-950 to-zinc-900 pt-32 pb-24 px-6 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300 mb-6">
            🚀 헬스장 전용 올인원 경영 플랫폼
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight">
            헬스장 운영의<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">모든 것,</span><br />
            핏보스 하나로
          </h1>
          <p className="mt-6 text-lg text-zinc-300 leading-relaxed max-w-xl mx-auto">
            회원 관리·매출 분석·트레이너 정산·락커·체크인까지<br />
            <strong className="text-white">원장님의 시간을 하루 2시간 돌려드립니다.</strong>
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/members" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/50">
              무료로 시작하기 → 지금 바로
            </Link>
            <a href="#features" className="border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all">
              기능 둘러보기
            </a>
          </div>
          <p className="mt-5 text-xs text-zinc-500">신용카드 불필요 · 설치 없음 · 즉시 시작</p>
        </div>

        {/* 대시보드 목업 */}
        <div className="relative max-w-4xl mx-auto mt-16 rounded-2xl overflow-hidden border border-zinc-700/50 shadow-2xl shadow-black/50">
          <div className="bg-zinc-800/80 px-4 py-3 flex items-center gap-2 border-b border-zinc-700">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-3 text-xs text-zinc-400 font-mono">fitboss.vercel.app/members</span>
          </div>
          <div className="bg-zinc-900 p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "이번 달 수익", value: "₩3,840,000", sub: "+12%" },
              { label: "전체 회원", value: "124명", sub: "+8명" },
              { label: "이번 달 신규", value: "18명", sub: "+3명" },
              { label: "체크인 (오늘)", value: "34회", sub: "" },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className="text-xl font-black text-white mt-1">{s.value}</p>
                {s.sub && <p className="text-xs text-emerald-400 mt-1">{s.sub}</p>}
              </div>
            ))}
          </div>
          <div className="bg-zinc-900 px-6 pb-6 grid grid-cols-3 gap-3">
            {["김민준 회원 만료 D-3 ⚠️", "홍길동 PT 10회 남음", "락커 #23 만료 D-1 ⚠️"].map((n) => (
              <div key={n} className="bg-zinc-800/60 rounded-lg px-3 py-2 text-xs text-zinc-400">{n}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 숫자 통계 ────────────────────────────── */}
      <section className="bg-blue-600 py-14 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-black text-white">{s.value}</p>
              <p className="text-blue-100 text-sm mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PAIN → GAIN ──────────────────────────── */}
      <section className="py-20 px-6 bg-zinc-50">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-black text-zinc-900">아직도 이렇게 운영하고 계신가요?</h2>
          <p className="mt-3 text-zinc-500">헬스장 원장님들이 가장 많이 겪는 비효율, 핏보스가 해결합니다.</p>
        </div>
        <div className="max-w-2xl mx-auto space-y-4">
          {PAINS.map((p) => (
            <div key={p.before} className="flex items-center gap-4 bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
              <div className="flex-1">
                <p className="text-sm text-zinc-400 line-through">{p.before}</p>
                <p className="text-base font-bold text-zinc-900 mt-1">✅ {p.after}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-zinc-900">헬스장 운영에 필요한 모든 기능</h2>
            <p className="mt-3 text-zinc-500">따로따로 쓰던 앱들을 핏보스 하나로 통합하세요.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-zinc-50 hover:bg-blue-50 border border-zinc-100 hover:border-blue-200 rounded-2xl p-6 transition-all hover:shadow-md">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-3 font-bold text-zinc-900">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────── */}
      <section className="py-20 px-6 bg-zinc-50">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-black text-zinc-900">딱 3단계면 됩니다</h2>
          <p className="mt-3 text-zinc-500">복잡한 설치나 교육 없이, 오늘 바로 시작할 수 있습니다.</p>
        </div>
        <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { step: "01", icon: "🖥️", title: "접속하기", desc: "브라우저에서 fitboss 주소를 열면 끝. 회원가입도 선택사항입니다." },
            { step: "02", icon: "⚙️", title: "세팅하기", desc: "지점 등록 → 트레이너 등록 → 회원 추가. 5분이면 충분합니다." },
            { step: "03", icon: "📈", title: "운영하기", desc: "매출·회원·체크인 데이터가 실시간으로 쌓이고 분석됩니다." },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white text-2xl mb-4 shadow-lg shadow-blue-200">{s.icon}</div>
              <p className="text-xs font-bold text-blue-500 mb-1">STEP {s.step}</p>
              <h3 className="text-lg font-black text-zinc-900">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── REVIEWS ──────────────────────────────── */}
      <section className="py-20 px-6 bg-zinc-950">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-black text-white">원장님들의 실제 후기</h2>
          <p className="mt-3 text-zinc-400">핏보스를 먼저 사용한 헬스장의 이야기입니다.</p>
        </div>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {REVIEWS.map((r) => (
            <div key={r.name} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex gap-1 mb-4">
                {[1,2,3,4,5].map((i) => <span key={i} className="text-yellow-400 text-sm">★</span>)}
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed">&ldquo;{r.text}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">{r.name[0]}</div>
                <div>
                  <p className="text-white font-bold text-sm">{r.name}</p>
                  <p className="text-zinc-500 text-xs">{r.loc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────── */}
      <section id="pricing" className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-black text-zinc-900">합리적인 요금제</h2>
          <p className="mt-3 text-zinc-500">규모에 맞는 플랜을 선택하세요.</p>
        </div>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`relative rounded-2xl border-2 p-7 ${plan.border}`}>
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-blue-500 text-white">{plan.badge}</span>
              )}
              <p className="font-black text-lg text-zinc-900">{plan.name}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-black text-zinc-900">{plan.price}</span>
                <span className="text-zinc-400 text-sm">{plan.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-600">
                    <span className="text-blue-500 mt-0.5 shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/members" className={`mt-7 block text-center font-bold py-3 rounded-xl transition-all ${plan.ctaClass}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────── */}
      <section id="faq" className="py-20 px-6 bg-zinc-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-black text-zinc-900 text-center mb-10">자주 묻는 질문</h2>
          <FaqAccordion faqs={FAQS} />
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────── */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-600 to-blue-800 text-center">
        <h2 className="text-4xl font-black text-white leading-tight">
          오늘부터 더 똑똑하게<br />헬스장을 운영하세요
        </h2>
        <p className="mt-4 text-blue-100 text-lg">설치 없이, 지금 바로 시작할 수 있습니다.</p>
        <Link href="/members" className="inline-block mt-8 bg-white text-blue-700 font-black text-xl px-10 py-4 rounded-2xl hover:scale-105 transition-transform shadow-xl shadow-blue-900/30">
          무료로 시작하기 → 지금 바로
        </Link>
        <p className="mt-4 text-blue-200 text-sm">신용카드 불필요 · 언제든 취소 가능</p>
      </section>

      {/* ── FOOTER ───────────────────────────────── */}
      <footer className="bg-zinc-950 py-12 px-6 text-center">
        <p className="text-2xl font-black text-white mb-2">💪 FitBoss</p>
        <p className="text-zinc-500 text-sm">헬스장 전용 올인원 경영 관리 플랫폼</p>
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-zinc-600">
          <Link href="/members" className="hover:text-zinc-300 transition-colors">회원 관리</Link>
          <Link href="/trainers" className="hover:text-zinc-300 transition-colors">트레이너</Link>
          <Link href="/checkin" className="hover:text-zinc-300 transition-colors">체크인</Link>
          <Link href="/locker" className="hover:text-zinc-300 transition-colors">락커</Link>
          <Link href="/settings" className="hover:text-zinc-300 transition-colors">설정</Link>
        </div>
        <p className="mt-8 text-xs text-zinc-700">© 2025 FitBoss. All rights reserved.</p>
      </footer>

    </div>
  );
}
