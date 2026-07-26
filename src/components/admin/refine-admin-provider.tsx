"use client";

import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";

/**
 * Refine is deliberately limited to the internal console. Authentication and
 * authorization stay server-side in Better Auth and the existing admin APIs.
 */
export function RefineAdminProvider({ children }: { children: React.ReactNode }) {
  return (
    <Refine
      routerProvider={routerProvider}
      resources={[
        { name: "users" },
        { name: "videos" },
        { name: "credits" },
        { name: "models" },
        { name: "provider-health" },
      ]}
      options={{ disableTelemetry: true, syncWithLocation: false }}
    >
      {children}
    </Refine>
  );
}
