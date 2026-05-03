import { NextRequest, NextResponse } from "next/server";

const KAKAO_KEY      = process.env.KAKAO_REST_API_KEY      ?? "";
const SOHO_KEY       = process.env.SOHO_SERVICE_KEY        ?? "";
const SGIS_CON_KEY   = process.env.SGIS_CONSUMER_KEY       ?? "";
const SGIS_CON_SEC   = process.env.SGIS_CONSUMER_SECRET    ?? "";
const NAVER_ID       = process.env.NAVER_CLIENT_ID         ?? "";
const NAVER_SECRET   = process.env.NAVER_CLIENT_SECRET     ?? "";

/* ── 타입 ─────────────────────────────────────────────────────────────── */
interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  distance: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
}

interface KakaoAddressDoc {
  x: string;
  y: string;
  address_name: string;
}

/* ── 카카오 헬퍼 ──────────────────────────────────────────────────────── */
async function kakaoFetch(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Kakao API error ${res.status}`);
  return res.json();
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const data = await kakaoFetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`
  );
  const doc: KakaoAddressDoc = data.documents?.[0];
  if (!doc) return null;
  return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
}

async function searchNear(
  lat: number,
  lng: number,
  radius: number,
  query: string
): Promise<KakaoPlace[]> {
  try {
    const data = await kakaoFetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json` +
        `?query=${encodeURIComponent(query)}&y=${lat}&x=${lng}&radius=${radius}&size=15&sort=distance`
    );
    return data.documents ?? [];
  } catch {
    return [];
  }
}

/* ── 소상공인 상권정보 API ────────────────────────────────────────────── */
async function fetchSohoTradeArea(lat: number, lng: number, radius: number) {
  if (!SOHO_KEY) return null;
  try {
    const base = "https://apis.data.go.kr/B553077/api/open/sdmap";
    const commonParams = `serviceKey=${encodeURIComponent(SOHO_KEY)}&pageNo=1&numOfRows=5&key=WGS84GEO&radius=${radius}&cx=${lng}&cy=${lat}&_type=json`;

    // 먼저 상권코드 조회
    const trdarRes = await fetch(`${base}/trdarQberry?${commonParams}`);
    if (!trdarRes.ok) return null;
    const trdarData = await trdarRes.json();
    const trdarItems = trdarData?.body?.items?.item;
    if (!trdarItems || (Array.isArray(trdarItems) && trdarItems.length === 0)) return null;
    const firstItem = Array.isArray(trdarItems) ? trdarItems[0] : trdarItems;
    const trdarNo = firstItem?.trdarNo ?? firstItem?.TRDAR_NO;
    if (!trdarNo) return null;

    // 유동/직장/상주인구 병렬 조회
    const trdarParams = `serviceKey=${encodeURIComponent(SOHO_KEY)}&pageNo=1&numOfRows=1&key=WGS84GEO&trdarNo=${trdarNo}&_type=json`;
    const [flpopRes, wrcpRes, adpopRes] = await Promise.allSettled([
      fetch(`${base}/trdarFlpopQry?${trdarParams}`).then((r) => r.json()),
      fetch(`${base}/trdarWrcpQry?${trdarParams}`).then((r) => r.json()),
      fetch(`${base}/trdarAdpopQry?${trdarParams}`).then((r) => r.json()),
    ]);

    const flpop = flpopRes.status === "fulfilled" ? flpopRes.value?.body?.items?.item : null;
    const wrcp  = wrcpRes.status  === "fulfilled" ? wrcpRes.value?.body?.items?.item  : null;
    const adpop = adpopRes.status === "fulfilled" ? adpopRes.value?.body?.items?.item : null;

    const flpopItem = Array.isArray(flpop) ? flpop[0] : flpop;
    const wrcpItem  = Array.isArray(wrcp)  ? wrcp[0]  : wrcp;
    const adpopItem = Array.isArray(adpop) ? adpop[0] : adpop;

    return {
      floating: flpopItem
        ? {
            daily:       Number(flpopItem.totFlpopCo ?? flpopItem.TOT_FLPOP_CO ?? 0),
            peakHour:    String(flpopItem.tmzonFlpopCo ?? "18~21시"),
            weekdayPeak: "평일 저녁",
          }
        : null,
      worker: wrcpItem
        ? { total: Number(wrcpItem.totWrppCo ?? wrcpItem.TOT_WRPP_CO ?? 0) }
        : null,
      resident: adpopItem
        ? {
            total:  Number(adpopItem.totAdpopCo  ?? adpopItem.TOT_ADPOP_CO  ?? 0),
            age20s: Number(adpopItem.agrde20AdpopCo ?? adpopItem.AGRDE_20_ADPOP_CO ?? 0),
            age30s: Number(adpopItem.agrde30AdpopCo ?? adpopItem.AGRDE_30_ADPOP_CO ?? 0),
            age40s: Number(adpopItem.agrde40AdpopCo ?? adpopItem.AGRDE_40_ADPOP_CO ?? 0),
          }
        : null,
      source: "소상공인상권정보" as const,
    };
  } catch {
    return null;
  }
}

/* ── SGIS 인구 통계 ───────────────────────────────────────────────────── */
async function fetchSgisPopulation(lat: number, lng: number) {
  if (!SGIS_CON_KEY || !SGIS_CON_SEC) return null;
  try {
    // 1. 액세스 토큰 발급
    const authRes = await fetch(
      `https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json?consumer_key=${encodeURIComponent(SGIS_CON_KEY)}&consumer_secret=${encodeURIComponent(SGIS_CON_SEC)}`
    );
    if (!authRes.ok) return null;
    const authData = await authRes.json();
    const accessToken = authData?.result?.accessToken ?? authData?.accessToken;
    if (!accessToken) return null;

    // 2. 좌표 → 행정동코드
    const addrRes = await fetch(
      `https://sgisapi.kostat.go.kr/OpenAPI3/boundary/trandrt.json?accessToken=${accessToken}&x_coor=${lng}&y_coor=${lat}&addr_type=2`
    );
    if (!addrRes.ok) return null;
    const addrData = await addrRes.json();
    const admCd = addrData?.result?.[0]?.cd ?? addrData?.result?.[0]?.adm_cd;
    if (!admCd) return null;

    // 3. 인구 통계
    const popRes = await fetch(
      `https://sgisapi.kostat.go.kr/OpenAPI3/stat/popltn.json?accessToken=${accessToken}&year=2022&adm_cd=${admCd}&adm_cd2=00&answer=1`
    );
    if (!popRes.ok) return null;
    const popData = await popRes.json();
    const popItems: Array<{ age: string; count: number }> = [];
    const result = popData?.result;
    if (Array.isArray(result)) {
      let total = 0;
      result.forEach((item: Record<string, unknown>) => {
        const age   = String(item.agender ?? item.age ?? "");
        const count = Number(item.popltn_cnt ?? item.count ?? 0);
        total += count;
        if (age) popItems.push({ age, count });
      });
      return { total, ageGroups: popItems.slice(0, 10) };
    }
    return null;
  } catch {
    return null;
  }
}

/* ── 네이버 데이터랩 검색 트렌드 ─────────────────────────────────────── */
async function fetchNaverTrend() {
  if (!NAVER_ID || !NAVER_SECRET) return null;
  try {
    const now       = new Date();
    const endDate   = now.toISOString().slice(0, 10);
    const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);

    const keywords = [
      { name: "헬스장",   keywords: ["헬스장", "헬스클럽"] },
      { name: "PT",       keywords: ["PT", "퍼스널트레이닝"] },
      { name: "필라테스", keywords: ["필라테스"] },
      { name: "요가",     keywords: ["요가"] },
      { name: "크로스핏", keywords: ["크로스핏"] },
    ];

    const body = {
      startDate,
      endDate,
      timeUnit: "month",
      keywordGroups: keywords.map((k) => ({
        groupName: k.name,
        keywords:  k.keywords,
      })),
    };

    const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method:  "POST",
      headers: {
        "Content-Type":            "application/json",
        "X-Naver-Client-Id":       NAVER_ID,
        "X-Naver-Client-Secret":   NAVER_SECRET,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.results) return null;

    const results: { name: string; data: { period: string; ratio: number }[] }[] =
      data.results.map((r: { title: string; data: { period: string; ratio: number }[] }) => ({
        name: r.title,
        data: r.data.map((d: { period: string; ratio: number }) => ({
          period: d.period,
          ratio:  d.ratio,
        })),
      }));

    // 가장 최근 달의 최고 키워드
    const lastPeriodRatios = results.map((r) => ({
      name:  r.name,
      ratio: r.data[r.data.length - 1]?.ratio ?? 0,
    }));
    const dominant = lastPeriodRatios.sort((a, b) => b.ratio - a.ratio)[0]?.name ?? "헬스장";

    // 전체 평균이 가장 높은 월
    const allPeriods = results[0]?.data.map((d) => d.period) ?? [];
    const peakMonth  = allPeriods.reduce(
      (peak, period) => {
        const avg =
          results.reduce((s, r) => {
            const d = r.data.find((x) => x.period === period);
            return s + (d?.ratio ?? 0);
          }, 0) / results.length;
        return avg > peak.avg ? { period, avg } : peak;
      },
      { period: "", avg: -1 }
    ).period;

    return { keywords: results, peakMonth, dominantKeyword: dominant };
  } catch {
    return null;
  }
}

/* ── 정적 시장 데이터 (한국스포츠정책과학원 2023) ────────────────────── */
const MARKET_DATA = {
  avgMonthlyRevenue:        { min: 2500, max: 8000 },
  avgPtPrice:               { min: 15,   max: 25   },
  exerciseParticipationRate: 65.7,
  survivalRate3Year:         52,
  avgMonthlySpend:           12.4,
  source:                   "한국스포츠정책과학원 2023" as const,
};

/* ── 경쟁 강도 ─────────────────────────────────────────────────────────── */
function intensityLabel(n: number) {
  if (n <= 2) return "낮음";
  if (n <= 5) return "보통";
  if (n <= 9) return "높음";
  return "매우 높음";
}

function computeInsights(score: number) {
  const ptMin  = score <= 2 ? 8  : score === 3 ? 6 : 5;
  const ptMax  = score <= 2 ? 12 : score === 3 ? 9 : 7;
  const gymMin = score <= 2 ? 10 : score === 3 ? 8 : 6;
  const gymMax = score <= 2 ? 15 : score === 3 ? 12 : 9;

  const marketing =
    score <= 2
      ? ["당근마켓 지역 광고", "네이버 플레이스 최적화", "현수막/전단지"]
      : score === 3
      ? ["인스타그램 릴스", "네이버 플레이스", "카카오 채널", "직장인 커뮤니티"]
      : ["인스타그램/유튜브 쇼츠", "다이어트 챌린지 이벤트", "회원 추천 인센티브 프로그램", "기업 단체 계약"];

  const strategy =
    score <= 2
      ? ["독점 상권으로 가격 프리미엄 가능", "지역 밀착 커뮤니티 형성", "브랜딩보다 입지 마케팅 집중"]
      : score === 3
      ? ["특화 프로그램으로 차별화 (새벽/야간반)", "소그룹 PT로 단가 유지", "온라인 후기 관리 집중"]
      : ["초전문화 필수 (다이어트·재활·산전후 등)", "가격 경쟁 금지 — 품질/경험으로 승부", "회원 리텐션(재등록률)이 생존 핵심"];

  const target =
    score <= 2
      ? "지역 거주민 전체 (30~50대 주부·시니어 포함)"
      : score === 3
      ? "20~40대 직장인·대학생"
      : "건강 관심도 높은 20~35대 MZ세대";

  const bep = score <= 2 ? 35 : score === 3 ? 48 : 60;

  return { ptMin, ptMax, gymMin, gymMax, marketing, strategy, target, bep };
}

/* ── 메인 핸들러 ──────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    if (!KAKAO_KEY) {
      return NextResponse.json(
        { error: "KAKAO_REST_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요." },
        { status: 500 }
      );
    }

    let body: { address?: string; radius?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const { address, radius = 500 } = body;
    if (!address?.trim()) {
      return NextResponse.json({ error: "주소를 입력해주세요." }, { status: 400 });
    }

    /* 1. 좌표 변환 */
    let coords: { lat: number; lng: number } | null = null;
    try {
      coords = await geocode(address);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: `카카오 API 오류: ${msg}. REST API 키를 확인해주세요.` },
        { status: 502 }
      );
    }
    if (!coords) {
      return NextResponse.json({ error: "주소를 찾을 수 없습니다. 더 자세히 입력해주세요." }, { status: 400 });
    }

    /* 2. 모든 데이터 병렬 수집 */
    const queries = ["헬스장", "PT센터", "필라테스", "요가", "크로스핏", "스포츠센터", "체육관"];
    const [kakaoResults, sohoResult, sgisResult, naverResult] = await Promise.allSettled([
      Promise.all(queries.map((q) => searchNear(coords!.lat, coords!.lng, radius, q))),
      fetchSohoTradeArea(coords.lat, coords.lng, radius),
      fetchSgisPopulation(coords.lat, coords.lng),
      fetchNaverTrend(),
    ]);

    /* 3. 카카오 경쟁 데이터 처리 */
    const kakaoPlaces: KakaoPlace[][] =
      kakaoResults.status === "fulfilled" ? kakaoResults.value : [];

    const seen = new Set<string>();
    const unique: KakaoPlace[] = [];
    kakaoPlaces.flat().forEach((p) => {
      if (!seen.has(p.id)) { seen.add(p.id); unique.push(p); }
    });

    const count = (keyword: string) =>
      unique.filter((p) => p.place_name.includes(keyword) || p.category_name.includes(keyword)).length;

    const competitors = {
      total:     unique.length,
      gyms:      count("헬스"),
      ptCenters: count("PT"),
      pilates:   count("필라테스"),
      yoga:      count("요가"),
      crossfit:  count("크로스핏"),
      places: unique
        .map((p) => ({
          id:       p.id,
          name:     p.place_name,
          category: p.category_name,
          distance: parseInt(p.distance || "0"),
          address:  p.road_address_name || p.address_name,
        }))
        .sort((a, b) => a.distance - b.distance),
    };

    const score = unique.length <= 2 ? 1 : unique.length <= 5 ? 2 : unique.length <= 9 ? 3 : 4;

    /* 4. 소상공인 인구 데이터 */
    const soho   = sohoResult.status  === "fulfilled" ? sohoResult.value  : null;
    const sgis   = sgisResult.status  === "fulfilled" ? sgisResult.value  : null;
    const naver  = naverResult.status === "fulfilled" ? naverResult.value : null;

    const population = soho
      ? {
          floating: soho.floating,
          resident: soho.resident,
          worker:   soho.worker,
          source:   soho.source,
        }
      : {
          floating: null,
          resident: null,
          worker:   null,
          source:   null,
        };

    return NextResponse.json({
      address,
      coords,
      radius,
      competitors,
      population,
      sgisPopulation: sgis,
      trend:          naver,
      marketData:     MARKET_DATA,
      competition:    { score, label: intensityLabel(unique.length) },
      insights:       computeInsights(score),
      analyzedAt:     new Date().toISOString(),
      dataSources: {
        kakao: kakaoResults.status === "fulfilled",
        soho:  !!SOHO_KEY && sohoResult.status === "fulfilled" && !!soho,
        sgis:  !!SGIS_CON_KEY && sgisResult.status === "fulfilled" && !!sgis,
        naver: !!NAVER_ID && naverResult.status === "fulfilled" && !!naver,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: `서버 오류: ${msg}` }, { status: 500 });
  }
}
