"use client";

import Link from "next/link";
import { Card, Col, Row, Space, Typography } from "antd";
import { supabaseConfigured } from "@/lib/supabase";

const { Title, Paragraph, Text } = Typography;

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <Title level={2}>VIKC 2026 · Đoàn Shakaijin</Title>
      <Paragraph>
        1st Vietnam International Kendo Championships — 19–22/11/2026, Tam Chúc (Ninh Bình), sau đó giao lưu
        Hà Nội 23–29/11/2026.
      </Paragraph>
      {!supabaseConfigured && (
        <Paragraph type="danger">
          Chưa cấu hình <Text code>NEXT_PUBLIC_SUPABASE_URL</Text> / <Text code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Text>.
        </Paragraph>
      )}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Link href="/enroll">
            <Card hoverable title="Đăng ký giờ đến & giờ về">
              <Paragraph>Chọn tên, nhập giờ đến và giờ về. Hệ thống tự tính số đêm, số ngày.</Paragraph>
              <Space><Text strong>Dành cho thành viên →</Text></Space>
            </Card>
          </Link>
        </Col>
        <Col xs={24} md={12}>
          <Link href="/track">
            <Card hoverable title="Bảng theo dõi">
              <Paragraph>Quân số từng ngày 18–30/11, tiến độ điền thông tin, hạn chót 20/10 & 25/10.</Paragraph>
              <Space><Text strong>Dành cho ban tổ chức →</Text></Space>
            </Card>
          </Link>
        </Col>
      </Row>
    </main>
  );
}
