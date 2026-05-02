import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ── Supabase Admin Client ── */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_PRICES: Record<string, number> = {
  starter: 29000,
  pro:     59000,
};

const PLAN_LABELS: Record<string, string> = {
  starter: "FitBoss 스타터",
  pro:     "FitBoss 프로",
};

/**
 * 월 정기 결제 실행 API
 * 호출: cron job 또는 관리자 수동 호출
 * Body: { userId } 또는 빈 값(전체 대상 처리)
 */
export async function POST(req: NextRequest) {
  // 내부 API 인증
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "결제 키가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body.userId;

    /* ── 대상 구독 조회 ── */
    let query = supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .eq("cancel_at_period_end", false)
      .lte("current_period_end", new Date().toISOString());

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: subs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!subs || subs.length === 0) {
      return NextResponse.json({ message: "결제 대상 없음", count: 0 });
    }

    const results = [];

    for (const sub of subs) {
      const amount = PLAN_PRICES[sub.plan];
      if (!amount) continue;

      const orderId = `fitboss_${sub.user_id}_${Date.now()}`;
      const orderName = PLAN_LABELS[sub.plan] ?? `FitBoss ${sub.plan}`;

      /* ── 토스페이먼츠 빌링 결제 ── */
      const tossRes = await fetch(
        `https://api.tosspayments.com/v1/billing/${sub.billing_key}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerKey: sub.customer_key,
            amount,
            orderId,
            orderName,
            customerEmail: "",  // 필요 시 user_profiles에서 조회
            taxFreeAmount: 0,
          }),
        }
      );

      const tossData = await tossRes.json();

      if (tossRes.ok) {
        /* ── 결제 성공: 다음 주기로 업데이트 ── */
        const nextStart = new Date();
        const nextEnd   = new Date(nextStart);
        nextEnd.setMonth(nextEnd.getMonth() + 1);

        await supabaseAdmin.from("subscriptions").update({
          current_period_start: nextStart.toISOString(),
          current_period_end:   nextEnd.toISOString(),
          updated_at:           new Date().toISOString(),
        }).eq("id", sub.id);

        await supabaseAdmin.from("payment_history").insert({
          user_id:         sub.user_id,
          subscription_id: sub.id,
          payment_key:     tossData.paymentKey,
          order_id:        orderId,
          amount,
          plan:            sub.plan,
          status:          "success",
          paid_at:         new Date().toISOString(),
        });

        results.push({ userId: sub.user_id, status: "success", amount });
      } else {
        /* ── 결제 실패: 상태를 past_due로 ── */
        await supabaseAdmin.from("subscriptions").update({
          status:     "past_due",
          updated_at: new Date().toISOString(),
        }).eq("id", sub.id);

        await supabaseAdmin.from("payment_history").insert({
          user_id:         sub.user_id,
          subscription_id: sub.id,
          order_id:        orderId,
          amount,
          plan:            sub.plan,
          status:          "failed",
        });

        results.push({ userId: sub.user_id, status: "failed", error: tossData.message });
      }
    }

    return NextResponse.json({ message: "처리 완료", count: results.length, results });
  } catch (err) {
    console.error("Billing charge error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
