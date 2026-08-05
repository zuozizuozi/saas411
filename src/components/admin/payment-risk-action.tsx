"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface PaymentRiskActionProps {
  orderId: number;
  orderNo: string;
  riskStatus: string;
  fulfilled: boolean;
  canDecide: boolean;
}

export function PaymentRiskAction({
  orderId,
  orderNo,
  riskStatus,
  fulfilled,
  canDecide,
}: PaymentRiskActionProps) {
  const router = useRouter();
  const remarkId = useId();
  const [decision, setDecision] = useState<"APPROVE" | "BLOCK" | null>(null);
  const [remark, setRemark] = useState("");
  const [isPending, setIsPending] = useState(false);

  const submit = async () => {
    if (!decision || remark.trim().length < 3) {
      toast.error("Please enter at least 3 characters for the audit note.");
      return;
    }
    setIsPending(true);
    try {
      const response = await fetch(`/api/v1/admin/payment-risk/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, remark: remark.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Payment risk update failed");
      }
      toast.success(
        decision === "APPROVE"
          ? fulfilled
            ? "Payment review approved."
            : "Payment approved and credits fulfilled."
          : "Payment remains blocked."
      );
      setDecision(null);
      setRemark("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment risk update failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canDecide && riskStatus !== "CLEAR" && riskStatus !== "RESOLVED" && (
          <Button size="sm" onClick={() => setDecision("APPROVE")}>
            Approve
          </Button>
        )}
        {canDecide && riskStatus !== "BLOCKED" && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDecision("BLOCK")}
          >
            Block
          </Button>
        )}
      </div>
      <Dialog open={decision !== null} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "APPROVE" ? "Approve payment" : "Block payment"}
            </DialogTitle>
            <DialogDescription>
              Order {orderNo}. Approval can release held credits; blocking never issues a
              Stripe refund automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <label className="font-medium" htmlFor={remarkId}>
              Audit note
            </label>
            <Input
              id={remarkId}
              value={remark}
              maxLength={500}
              placeholder="Evidence reviewed and decision reason"
              onChange={(event) => setRemark(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={decision === "BLOCK" ? "destructive" : "default"}
              disabled={isPending}
              onClick={() => void submit()}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
