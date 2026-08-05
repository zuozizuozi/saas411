import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { PaymentRiskAction } from "@/components/admin/payment-risk-action";
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
import { db, paymentOrders, users } from "@/db";
import { requireAdmin } from "@/lib/auth/admin";

export default async function PaymentRiskPage() {
  await requireAdmin();
  const orders = await db
    .select({
      id: paymentOrders.id,
      orderNo: paymentOrders.orderNo,
      status: paymentOrders.status,
      riskStatus: paymentOrders.riskStatus,
      riskLevel: paymentOrders.riskLevel,
      riskScore: paymentOrders.riskScore,
      riskReason: paymentOrders.riskReason,
      reviewId: paymentOrders.reviewId,
      earlyFraudWarningId: paymentOrders.earlyFraudWarningId,
      paymentIntentId: paymentOrders.paymentIntentId,
      amount: paymentOrders.amount,
      currency: paymentOrders.currency,
      creditsGranted: paymentOrders.creditsGranted,
      creditsRevoked: paymentOrders.creditsRevoked,
      fulfilledAt: paymentOrders.fulfilledAt,
      updatedAt: paymentOrders.updatedAt,
      email: users.email,
      billingStatus: users.billingStatus,
    })
    .from(paymentOrders)
    .innerJoin(users, eq(users.id, paymentOrders.userId))
    .orderBy(desc(paymentOrders.updatedAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment risk</h1>
        <p className="text-muted-foreground">
          Radar reviews, elevated-risk holds, early fraud warnings, and failed payments.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Latest Stripe payment decisions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Amount / credits</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No payment orders recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const stripeHref = order.reviewId
                      ? `https://dashboard.stripe.com/radar/reviews/${order.reviewId}`
                      : order.paymentIntentId
                        ? `https://dashboard.stripe.com/payments/${order.paymentIntentId}`
                        : null;
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="font-medium">{order.orderNo}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.status} · {order.updatedAt.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{order.email}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.billingStatus}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">{order.riskStatus}</Badge>
                            {order.riskLevel && <Badge>{order.riskLevel}</Badge>}
                            {order.riskScore !== null && (
                              <Badge variant="secondary">score {order.riskScore}</Badge>
                            )}
                            {order.earlyFraudWarningId && (
                              <Badge variant="destructive">EFW</Badge>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {order.riskReason ?? "No risk reason"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {(order.amount / 100).toFixed(2)} {order.currency.toUpperCase()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.creditsGranted - order.creditsRevoked} net credits
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.fulfilledAt ? order.fulfilledAt.toLocaleString() : "Held"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <PaymentRiskAction
                              orderId={order.id}
                              orderNo={order.orderNo}
                              riskStatus={order.riskStatus}
                              fulfilled={Boolean(order.fulfilledAt)}
                              canDecide={
                                Boolean(order.fulfilledAt) ||
                                order.status === "PAID" ||
                                order.status === "PARTIALLY_REFUNDED"
                              }
                            />
                            {stripeHref && (
                              <Button asChild size="sm" variant="outline">
                                <Link href={stripeHref} target="_blank" rel="noreferrer">
                                  Open in Stripe
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
