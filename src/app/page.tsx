import Calculator from "./components/Calculator";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Hero */}
      <div className="bg-white border-b border-zinc-100">
        <div className="max-w-lg mx-auto px-6 py-12 text-center">
          <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-500 mb-4">
            피트니스 사업자 전용
          </span>
          <h1 className="text-3xl font-black text-zinc-900 leading-tight">
            당신의 실제 순이익,<br />
            <span className="text-blue-600">지금 바로 확인하세요</span>
          </h1>
          <p className="mt-4 text-zinc-500 text-sm leading-relaxed">
            많은 PT 센터 원장님들이 <strong className="text-zinc-700">총 결제금액</strong>을 수익으로 착각합니다.<br />
            실제 번 돈은 따로 있습니다.
          </p>
        </div>
      </div>

      {/* Calculator */}
      <div className="max-w-lg mx-auto px-6 py-10">
        <Calculator />
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-xs text-zinc-400">
        계산 결과는 참고용이며 정확한 세무는 전문가와 상담하세요
      </div>
    </div>
  );
}
