import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { RefineThemes } from "@refinedev/antd";
import Providers from "./providers";
import "@ant-design/v5-patch-for-react-19";
import "@refinedev/antd/dist/reset.css";

export const metadata: Metadata = {
  title: "VIKC 2026 · Shakaijin",
  description: "Đăng ký giờ đến / giờ về và theo dõi đoàn Shakaijin — VIKC 2026 (19–22/11) & giao lưu Hà Nội (23–29/11)",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Every page reads live data from Supabase and every screen is a client component; static
// prerendering would only trip over AntD's RSC interplay, so the app renders dynamically.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AntdRegistry>
          <ConfigProvider locale={viVN} theme={RefineThemes.Blue}>
            {/* Refine reads the query string (pagination/filters) → needs a Suspense boundary */}
            <Suspense fallback={null}>
              <Providers>{children}</Providers>
            </Suspense>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
