"use client";

import { ThemedLayout } from "@refinedev/antd";

/** Admin shell: sider + header + the menu Refine derives from `resources`. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ThemedLayout>{children}</ThemedLayout>;
}
