import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db, paymentDisputes, paymentOrders, users } from "@/db";
import { requireAdmin } from "@/lib/auth/admin";

export default async function PaymentDisputesPage() {
  await requireAdmin();
  const disputes = await db
    .select({
      id: paymentDisputes.disputeId,
      status: paymentDisputes.status,
      reason: paymentDisputes.reason,
      amount: paymentDisputes.amount,
      currency: paymentDisputes.currency,
      dueBy: paymentDisputes.dueBy,
      updatedAt: paymentDisputes.updatedAt,
      evidence: paymentDisputes.evidenceSnapshot,
      orderNo: paymentOrders.orderNo,
      email: users.email,
      billingStatus: users.billingStatus,
      creditDebt: users.creditDebt,
    })
    .from(paymentDisputes)
    .innerJoin(paymentOrders, eq(paymentOrders.id, paymentDisputes.paymentOrderId))
    .innerJoin(users, eq(users.id, paymentDisputes.userId))
    .orderBy(desc(paymentDisputes.updatedAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment disputes</h1>
        <p className="text-muted-foreground">
          Review the evidence snapshot here, then submit the response in Stripe.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stripe dispute cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>User / account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No disputes recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  disputes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.id}</div>
                        <Badge variant="outline">{item.status}</Badge>
                        <div className="text-xs text-muted-foreground">{item.orderNo}</div>
                      </TableCell>
                      <TableCell>
                        <div>{item.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.billingStatus}; debt {item.creditDebt}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(item.amount / 100).toFixed(2)} {item.currency.toUpperCase()}
                      </TableCell>
                      <TableCell>{item.reason ?? "—"}</TableCell>
                      <TableCell>
                        {item.dueBy ? item.dueBy.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        {item.evidence ? (
                          <details className="max-w-md">
                            <summary className="cursor-pointer text-sm font-medium">
                              View snapshot
                            </summary>
                            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                              {JSON.stringify(item.evidence, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          "Missing"
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`https://dashboard.stripe.com/disputes/${item.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Stripe
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
