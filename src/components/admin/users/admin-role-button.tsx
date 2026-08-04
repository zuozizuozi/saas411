"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Shield, ShieldAlert, Spinner } from "@/components/ui/icons";

interface AdminRoleButtonProps {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}

export function AdminRoleButton({
  userId,
  userEmail,
  isAdmin,
}: AdminRoleButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const updateRole = async () => {
    const nextIsAdmin = !isAdmin;
    if (
      !nextIsAdmin &&
      !window.confirm(`确定撤销 ${userEmail} 的管理员权限吗？`)
    ) {
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: nextIsAdmin }),
      });
      const responseText = await response.text();
      let payload: {
        success?: boolean;
        error?: { message?: string };
      } = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        // A gateway timeout can return HTML instead of the API JSON envelope.
      }

      if (!response.ok) {
        throw new Error(payload.error?.message || "管理员权限更新失败");
      }

      toast.success(nextIsAdmin ? "已设为管理员" : "已撤销管理员权限", {
        description: userEmail,
      });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "管理员权限更新失败");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={isAdmin ? "destructive" : "outline"}
      size="sm"
      disabled={isPending}
      onClick={() => void updateRole()}
    >
      {isPending ? (
        <Spinner className="h-4 w-4 animate-spin" />
      ) : isAdmin ? (
        <ShieldAlert className="h-4 w-4" />
      ) : (
        <Shield className="h-4 w-4" />
      )}
      {isAdmin ? "撤销管理员" : "设为管理员"}
    </Button>
  );
}
