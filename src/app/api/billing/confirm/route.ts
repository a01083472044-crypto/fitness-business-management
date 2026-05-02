import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PLAN_PRICES: Record<string, number> = {
  starter: 29000,
  pro:     59000,
};

export async function POST(req: NextRequest) {
  /* ── Supabase Admin Client (함수 내부에서 생성 → 빌드 시 env 미필요) ── */
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );

  try {
    const { authKey, customerKey, plan } = await req.json();

    if (!authKey || !customerKey || !plan) {
      return NextResponse.json({ error: "필수 파라미터가 누락됐습니다." }, { status: 400 });
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "결제 키가 서버에 설정되지 않았습니다." }, { status: 500 });
    }

    /* ── 1) 토스페이먼츠 빌링키 발급 ── */
    const tossRes = await fetch(
      "https://api.tosspayments.com/v1/billing/authorizations/issue",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ authKey, customerKey }),
      }
    );

    if (!tossRes.ok) {
      const tossErr = await tossRes.json();
      console.error("Toss billing issue error:", tossErr);
      return NextResponse.json(
        { error: tossErr.message ?? "빌링키 발급 실패" },
        { status: 400 }
      );
    }

    const tossData = await tossRes.json();
    const billingKey: string = tossData.billingKey;

    /* ── 2) customerKey → user_id 조회 ── */
    // customerKey = "fitboss_{userId}"
    const userId = customerKey.replace("fitboss_", "");

    /* ── 3) subscriptions 테이블에 저장 ── */
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id:             userId,
          plan,
          status:              "trial",
          billing_key:         billingKey,
          customer_key:        customerKey,
          trial_ends_at:       trialEndsAt,
          current_period_start: new Date().toISOString(),
          current_period_end:   trialEndsAt,
          updated_at:          new Date().toISOString(),
        },
        { onConflict: "customer_key" }
      );

    if (upsertError) {
      console.error("Supabase upsert error:", upsertError);
      return NextResponse.json({ error: "구독 정보 저장 실패" }, { status: 500 });
    }

    /* ── 4) user_profiles 구독 상태 업데이트 ── */
    await supabaseAdmin
      .from("user_profiles")
      .update({ role: "superadmin" })
      .eq("id", userId)
      .eq("role", "pending");

    return NextResponse.json({ success: true, plan, trialEndsAt });
  } catch (err) {
    console.error("Billing confirm error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
