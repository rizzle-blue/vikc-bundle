"use client";

import { Refine } from "@refinedev/core";
import { dataProvider } from "@refinedev/supabase";
import routerProvider from "@refinedev/nextjs-router/app";
import { supabase } from "@/lib/supabase";
import { resources } from "@/lib/resources";

/** Refine wiring: Supabase (PostgREST + RLS) as the data source, the App Router as the router. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Refine
      dataProvider={dataProvider(supabase)}
      routerProvider={routerProvider}
      resources={resources}
      options={{
        disableTelemetry: true,
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
        projectId: "vikc-2026",
        title: { text: "VIKC 2026 · Shakaijin" },
      }}
    >
      {children}
    </Refine>
  );
}
