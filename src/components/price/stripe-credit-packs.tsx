"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useAction } from "next-safe-action/hooks";

import { createStripeCreditSessionAction } from "@/actions/stripe";
import { Button } from "@/components/ui/button";
import { getOnetimeProducts } from "@/config/credits";
import { useSigninModal } from "@/hooks/use-signin-modal";

export function StripeCreditPacks({ userId }: { userId?: string }) {
  const locale = useLocale();
  const isZh = locale === "zh";
  const signInModal = useSigninModal();
  const [selected, setSelected] = useState<string | null>(null);
  const { executeAsync } = useAction(createStripeCreditSessionAction);
  const packages = getOnetimeProducts();

  if (packages.length === 0) return null;

  const checkout = async (packageId: string) => {
    if (!userId) {
      signInModal.onOpen();
      return;
    }
    setSelected(packageId);
    try {
      const result = await executeAsync({ packageId });
      if (result?.data?.url) window.location.assign(result.data.url);
    } finally {
      setSelected(null);
    }
  };

  return (
    <section className="mx-auto mt-16 w-full max-w-screen-lg">
      <div className="mb-7 text-center">
        <h3 className="text-2xl font-semibold">
          {isZh ? "一次性积分包" : "One-time credit packs"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {isZh ? "无需订阅，积分到账后按模型实际消耗。" : "No subscription required. Credits are used per generation."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {packages.map((product) => (
          <article key={product.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
            <p className="text-sm text-muted-foreground">{product.name}</p>
            <p className="mt-3 text-3xl font-semibold">{product.credits}</p>
            <p className="text-sm text-muted-foreground">{isZh ? "积分" : "credits"}</p>
            <p className="my-5 text-xl font-medium">
              {(product.price.amount / 100).toLocaleString(locale, {
                style: "currency",
                currency: product.price.currency,
              })}
            </p>
            <Button
              className="w-full"
              disabled={selected !== null}
              onClick={() => void checkout(product.id)}
            >
              {selected === product.id
                ? isZh ? "跳转中…" : "Redirecting…"
                : isZh ? "购买积分" : "Buy credits"}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
