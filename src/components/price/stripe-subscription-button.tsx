"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  confirmStripeSubscriptionUpgradeAction,
  createStripeSessionAction,
  previewStripeSubscriptionChangeAction,
} from "@/actions/stripe";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { StripeSubscriptionChangePreview } from "@/services/billing";

type UpgradeQuote = Extract<
  StripeSubscriptionChangePreview,
  { kind: "upgrade" }
>;

export function StripeSubscriptionButton({
  planId,
  label,
  className,
  disabled,
}: {
  planId: string;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [quote, setQuote] = useState<UpgradeQuote | null>(null);
  const previewAction = useAction(previewStripeSubscriptionChangeAction);
  const checkoutAction = useAction(createStripeSessionAction);
  const upgradeAction = useAction(confirmStripeSubscriptionUpgradeAction);
  const isPending =
    previewAction.status === "executing" ||
    checkoutAction.status === "executing" ||
    upgradeAction.status === "executing";
  const isZh = locale.toLowerCase().startsWith("zh");

  async function startChange() {
    const result = await previewAction.executeAsync({ planId });
    const change = result?.data;
    if (!change) {
      toast.error(isZh ? "无法读取订阅信息" : "Could not load subscription details");
      return;
    }

    if (change.kind === "portal") {
      window.location.href = change.url;
      return;
    }
    if (change.kind === "upgrade") {
      setQuote(change);
      return;
    }

    const checkout = await checkoutAction.executeAsync({ planId });
    if (!checkout?.data?.url) {
      toast.error(isZh ? "无法创建支付页面" : "Could not open checkout");
      return;
    }
    window.location.href = checkout.data.url;
  }

  async function confirmUpgrade() {
    if (!quote) return;
    const result = await upgradeAction.executeAsync({
      planId: quote.targetPriceId,
      prorationDate: quote.prorationDate,
    });
    const change = result?.data;
    if (!change?.success) {
      toast.error(isZh ? "升级失败，请重新获取报价" : "Upgrade failed. Please try again.");
      return;
    }

    setQuote(null);
    if (change.url) {
      window.location.href = change.url;
      return;
    }
    toast.success(
      change.paymentPending
        ? isZh
          ? "付款处理中，成功后套餐和积分会自动更新"
          : "Payment is processing. Your plan and credits will update automatically."
        : isZh
          ? "套餐已升级，增量积分正在入账"
          : "Plan upgraded. Incremental credits are being added."
    );
    router.refresh();
  }

  const formattedAmount = quote
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: quote.currency.toUpperCase(),
      }).format(quote.amount / 100)
    : "";

  return (
    <>
      <Button
        type="button"
        className={className}
        disabled={disabled || isPending}
        onClick={startChange}
      >
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isPending ? (isZh ? "处理中…" : "Processing…") : label}
      </Button>
      <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
        {isZh
          ? "继续即同意当前服务条款；退款或银行争议会撤销对应权益，审核期间生成服务可能受限。"
          : "Continuing accepts the current terms. Refunds or bank disputes reverse related benefits and may limit generation during review."}
      </p>

      <AlertDialog open={Boolean(quote)} onOpenChange={(open) => !open && setQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isZh ? "确认立即升级" : "Confirm immediate upgrade"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {quote
                  ? isZh
                    ? `${quote.currentPlan} → ${quote.targetPlan}`
                    : `${quote.currentPlan} → ${quote.targetPlan}`
                  : null}
              </span>
              <span className="block">
                {isZh
                  ? `现在预计补收 ${formattedAmount}，并补发 ${quote?.credits ?? 0} 积分。仅计算本周期剩余时间，不追溯已使用月份；税费以 Stripe 最终账单为准。`
                  : `Estimated charge now: ${formattedAmount}, with ${quote?.credits ?? 0} incremental credits. Only the remaining current period is prorated; taxes are finalized by Stripe.`}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {isZh ? "取消" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={confirmUpgrade}>
              {isZh ? "确认并付款" : "Confirm and pay"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
