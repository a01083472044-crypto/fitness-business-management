import { NextRequest, NextResponse } from "next/server";

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY ?? "";

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

/* ── 헬퍼 ─────────────────────────────────────────────────────────────── */
async function kakaoFetch(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Kakao API error ${res.status}`);
  return res.json();
}

/** 주소 → 좌표 */
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const data = await kakaoFetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`
  );
  const doc: KakaoAddressDoc = data.documents?.[0];
  if (!doc) return null;
  return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
}

/** 키워드 기반 반경 검색 */
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

/** 경쟁 강도 문자열 */
function intensityLabel(n: number) {
  if (n <= 2) return "낮음";
  if (n <= 5) return "보통";
  if (n <= 9) return "높음";
  return "매우 높음";
}

/** 피트니스 맞춤 인사이트 */
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

    /* 2. 피트니스 업종 병렬 검색 */
    const queries = ["헬스장", "PT센터", "필라테스", "요가", "크로스핏", "스포츠센터", "체육관"];
    const results = await Promise.all(queries.map((q) => searchNear(coords!.lat, coords!.lng, radius, q)));

    /* 3. 중복 제거 (kakao place id 기준) */
    const seen = new Set<string>();
    const unique: KakaoPlace[] = [];
    results.flat().forEach((p) => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        unique.push(p);
      }
    });

    /* 4. 분류별 카운트 (카테고리명 포함 여부로 판단) */
    const count = (keyword: string) =>
      unique.filter((p) =>
        p.place_name.includes(keyword) || p.category_name.includes(keyword)
      ).length;

    const competitors = {
      total: unique.length,
      gyms:     count("헬스"),
      ptCenters:count("PT"),
      pilates:  count("필라테스"),
      yoga:     count("요가"),
      crossfit: count("크로스핏"),
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

    /* 5. 경쟁 강도 */
    const score = unique.length <= 2 ? 1 : unique.length <= 5 ? 2 : unique.length <= 9 ? 3 : 4;

    return NextResponse.json({
      address,
      coords,
      radius,
      competitors,
      competition: { score, label: intensityLabel(unique.length) },
      insights: computeInsights(score),
      analyzedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: `서버 오류: ${msg}` }, { status: 500 });
  }
}
