"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";

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

interface GenerationControlButtonProps {
  userId: string;
  userEmail: string;
  isPaused: boolean;
  pauseSource?: string | null;
  pauseReason?: string | null;
}

export function GenerationControlButton({
  userId,
  userEmail,
  isPaused,
  pauseSource,
  pauseReason,
}: GenerationControlButtonProps) {
  const router = useRouter();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (reason.trim().length < 3) {
      toast.error("请填写至少 3 个字符的处理原因");
      return;
    }
    setIsPending(true);
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/generation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isPaused ? "RESUME" : "PAUSE",
          reason: reason.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message || "生成权限更新失败");
      }

      toast.success(isPaused ? `已恢复 ${userEmail} 的视频生成` : `已暂停 ${userEmail} 的视频生成`);
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成权限更新失败");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={isPaused ? "default" : "destructive"}
          size="sm"
        >
          {isPaused ? (
            <PlayCircle className="h-4 w-4" />
          ) : (
            <PauseCircle className="h-4 w-4" />
          )}
          {isPaused ? "恢复生成" : "暂停生成"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isPaused ? "恢复视频生成" : "暂停视频生成"}</DialogTitle>
          <DialogDescription>
            {isPaused
              ? `${userEmail} 将可以重新提交视频生成任务。`
              : `${userEmail} 仍可登录和查看历史内容，但不能提交新的生成任务。`}
          </DialogDescription>
        </DialogHeader>
        {isPaused && (pauseSource || pauseReason) && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <div>暂停来源：{pauseSource === "CREDIT_VELOCITY" ? "异常额度消耗" : "管理员手动暂停"}</div>
            {pauseReason && <div className="mt-1 break-words">原因：{pauseReason}</div>}
          </div>
        )}
        <div className="space-y-2 text-sm">
          <label className="font-medium" htmlFor={reasonId}>
            {isPaused ? "恢复说明" : "暂停原因"}
          </label>
          <Input
            id={reasonId}
            value={reason}
            maxLength={500}
            placeholder={isPaused ? "例如：人工审核通过" : "例如：疑似异常批量生成"}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {isPaused && pauseSource === "CREDIT_VELOCITY" && (
          <p className="text-xs text-muted-foreground">
            恢复后将获得 72 小时自动风控豁免，避免同一消耗窗口立即再次暂停。
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant={isPaused ? "default" : "destructive"}
            disabled={isPending}
            onClick={() => void submit()}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPaused ? "确认恢复" : "确认暂停"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
