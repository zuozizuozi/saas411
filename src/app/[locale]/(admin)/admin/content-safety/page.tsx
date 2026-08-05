import { desc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { contentModerationEvents, db, users } from "@/db";
import { requireAdmin } from "@/lib/auth/admin";

export default async function ContentSafetyPage() {
  await requireAdmin();
  const events = await db
    .select({
      id: contentModerationEvents.id,
      stage: contentModerationEvents.stage,
      provider: contentModerationEvents.provider,
      decision: contentModerationEvents.decision,
      model: contentModerationEvents.model,
      videoUuid: contentModerationEvents.videoUuid,
      categories: contentModerationEvents.categories,
      reason: contentModerationEvents.reason,
      promptHash: contentModerationEvents.promptHash,
      createdAt: contentModerationEvents.createdAt,
      email: users.email,
    })
    .from(contentModerationEvents)
    .innerJoin(users, eq(users.id, contentModerationEvents.userId))
    .orderBy(desc(contentModerationEvents.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Content safety</h1>
        <p className="text-muted-foreground">
          Privacy-minimized input, provider, and output moderation decisions.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Latest moderation events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time / user</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Model / video</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No moderation events recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => {
                    const categories = Array.isArray(event.categories)
                      ? event.categories.filter(
                          (category): category is string => typeof category === "string"
                        )
                      : [];
                    return (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div>{event.createdAt.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {event.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.stage}</Badge>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {event.provider}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              event.decision === "BLOCK" || event.decision === "ERROR"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {event.decision}
                          </Badge>
                          {categories.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {categories.join(", ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>{event.model ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {event.videoUuid ?? `prompt ${event.promptHash?.slice(0, 10) ?? "—"}`}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md text-sm">
                          {event.reason}
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
