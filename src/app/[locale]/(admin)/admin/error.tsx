"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <Card className="mx-auto mt-12 max-w-xl">
      <CardHeader>
        <CardTitle>管理员页面加载失败</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          页面没有正常取得数据。请重试一次；如果仍失败，请检查生产日志。
        </p>
        <Button type="button" onClick={reset}>重新加载</Button>
      </CardContent>
    </Card>
  );
}
