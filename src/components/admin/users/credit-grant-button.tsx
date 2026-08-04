"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreditGrantButtonProps {
  userId: string;
  userEmail: string;
}

export function CreditGrantButton({ userId, userEmail }: CreditGrantButtonProps) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [credits, setCredits] = useState("100");
  const [expiry, setExpiry] = useState("365");
  const [reason, setReason] = useState("");

  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !requestId) setRequestId(crypto.randomUUID());
  };

  const submit = async () => {
    const amount = Number(credits);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) {
      toast.error("请输入 1 到 1,000,000 之间的整数积分");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("请填写至少 3 个字符的发放原因");
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/credits/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId ?? crypto.randomUUID(),
          credits: amount,
          expiryDays: expiry === "never" ? null : Number(expiry),
          reason: reason.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message || "积分发放失败");
      }

      toast.success(`已向 ${userEmail} 发放 ${amount} 积分`);
      setOpen(false);
      setRequestId(null);
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "积分发放失败");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={updateOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Gift className="h-4 w-4" />
          发放积分
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>发放福利积分</DialogTitle>
          <DialogDescription>
            向 {userEmail} 创建一个独立积分包，不影响用户已有积分。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <label className="font-medium" htmlFor={`${fieldId}-credits`}>积分数量</label>
            <Input
              id={`${fieldId}-credits`}
              type="number"
              min={1}
              max={1_000_000}
              step={1}
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
            />
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium" htmlFor={`${fieldId}-expiry`}>有效期</label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger id={`${fieldId}-expiry`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 天</SelectItem>
                <SelectItem value="30">30 天</SelectItem>
                <SelectItem value="90">90 天</SelectItem>
                <SelectItem value="365">365 天</SelectItem>
                <SelectItem value="never">永久有效</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium" htmlFor={`${fieldId}-reason`}>发放原因</label>
            <Input
              id={`${fieldId}-reason`}
              value={reason}
              maxLength={500}
              placeholder="例如：活动福利、客服补偿"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button type="button" disabled={isPending} onClick={() => void submit()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            确认发放
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
