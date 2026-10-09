"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Col, Input, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const { Title, Paragraph, Text } = Typography;

type RegistrationRow = {
  member_id: string;
  full_name: string;
  full_name_latin: string | null;
  full_name_kanji: string | null;
  gender: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  emergency_contact: string | null;
  vkf_member: boolean | null;
  vkf_id: string | null;
  national_id: string | null;
  nationality: string | null;
  address: string | null;
  occupation: string | null;
  dojo_name: string | null;
  certificate_mailing_address: string | null;
  current_rank: string | null;
  current_rank_issued_on: string | null;
  current_rank_issued_by: string | null;
  current_rank_photo_url: string | null;
  grade_applied: string | null;
  also_shodan: boolean | null;
  dojo_approved: boolean | null;
  role: string | null;
  arrival_at: string | null;
  departure_at: string | null;
  room_type: string | null;
  roommate: string | null;
  nights: number | null;
  tam_chuc_nights: number | null;
  ha_noi_nights: number | null;
  entries: number | null;
  missing_fields: number;
  updated_at: string | null;
};

const dmy = (v: string | null) => (v ? v.split("-").reverse().join("/") : "—");
const when = (v: string | null) =>
  v ? new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";

/**
 * Scope 2 — VIKC Registration: the club's registration sheet, pre-filled from what each member
 * entered on the sign-up form. Read-only here; a member fixes their own row on /enroll, the operator
 * uses the CSV to fill VKF's workbook.
 */
export default function RegistrationPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    void (async () => {
      const { data, error: err } = await supabase
        .from("v_vikc_registration")
        .select("*")
        .order("full_name");
      if (err) setError(err.message);
      setRows((data ?? []) as RegistrationRow[]);
    })();
  }, []);

  const filtered = useMemo(
    () => (q ? rows.filter((r) => `${r.full_name} ${r.member_id}`.toLowerCase().includes(q.toLowerCase())) : rows),
    [rows, q],
  );

  const kpi = useMemo(
    () => ({
      signed: rows.length,
      ready: rows.filter((r) => r.missing_fields === 0).length,
      exam: rows.filter((r) => r.grade_applied).length,
      entries: rows.reduce((n, r) => n + (r.entries ?? 0), 0),
    }),
    [rows],
  );

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
      <Title level={2}>VIKC Registration</Title>
      <Paragraph type="secondary">
        Bảng đăng ký gửi VKF — thông tin được điền sẵn từ phần <Link href="/enroll">đăng ký của thành viên</Link>.
        {" "}<Link href="/admin">← Ban tổ chức</Link>
      </Paragraph>
      {!supabaseConfigured && <Alert type="error" showIcon message="Chưa cấu hình Supabase." />}
      {error && <Alert type="error" showIcon message={error} />}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Đã đăng ký" value={kpi.signed} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Đủ hồ sơ VKF" value={kpi.ready} suffix={`/ ${kpi.signed}`} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Đăng ký thi Kyu/Dan" value={kpi.exam} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Nội dung thi đấu" value={kpi.entries} /></Card></Col>
      </Row>

      <Card
        title="Danh sách gửi VKF"
        extra={
          <Space>
            <Input.Search placeholder="Tìm tên hoặc mã" allowClear onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
            <a href="/api/admin/export?kind=vkf"><Button type="primary">CSV cho VKF</Button></a>
          </Space>
        }
      >
        <Table<RegistrationRow>
          dataSource={filtered}
          rowKey="member_id"
          size="small"
          pagination={{ pageSize: 25, showSizeChanger: false }}
          scroll={{ x: 1800 }}
          locale={{ emptyText: "Chưa có ai đăng ký." }}
          columns={[
            { dataIndex: "member_id", title: "Mã", width: 90, fixed: "left" },
            { dataIndex: "full_name", title: "Họ và tên", width: 180, fixed: "left",
              render: (v: string) => <Text strong>{v}</Text> },
            { dataIndex: "full_name_latin", title: "Latin (in bằng)", width: 180 },
            { dataIndex: "full_name_kanji", title: "Kanji", width: 120 },
            { dataIndex: "gender", title: "Giới tính", width: 80 },
            { dataIndex: "date_of_birth", title: "Ngày sinh", width: 100, render: dmy },
            { dataIndex: "national_id", title: "CCCD/Hộ chiếu", width: 140 },
            { dataIndex: "nationality", title: "Quốc tịch", width: 100 },
            { dataIndex: "phone", title: "SĐT", width: 110 },
            { dataIndex: "email", title: "Email", width: 180, ellipsis: true },
            { dataIndex: "emergency_contact", title: "Liên hệ khẩn cấp", width: 180, ellipsis: true },
            { dataIndex: "address", title: "Địa chỉ", width: 200, ellipsis: true },
            { dataIndex: "occupation", title: "Nghề nghiệp", width: 120 },
            { dataIndex: "dojo_name", title: "CLB", width: 120 },
            { dataIndex: "vkf_member", title: "VKF", width: 80,
              render: (v: boolean) => (v ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>) },
            { dataIndex: "vkf_id", title: "Mã VKF", width: 110 },
            { dataIndex: "current_rank", title: "Trình độ", width: 100 },
            { dataIndex: "current_rank_issued_on", title: "Ngày cấp", width: 100, render: dmy },
            { dataIndex: "current_rank_issued_by", title: "Nơi cấp", width: 130 },
            {
              dataIndex: "current_rank_photo_url", title: "Ảnh bằng", width: 90,
              render: (v: string | null) => (v ? <a href={v} target="_blank" rel="noreferrer">mở</a> : <Tag color="red">thiếu</Tag>),
            },
            {
              dataIndex: "grade_applied", title: "Thi Kyu/Dan", width: 120,
              render: (v: string | null, r) =>
                v ? <Tag color="blue">{v}{r.also_shodan ? " + Shodan" : ""}</Tag> : <Text type="secondary">không thi</Text>,
            },
            { dataIndex: "dojo_approved", title: "CLB xác nhận", width: 110,
              render: (v: boolean | null) => (v ? <Tag color="green">rồi</Tag> : <Tag color="orange">chưa</Tag>) },
            { dataIndex: "role", title: "Vai trò", width: 110, render: (v: string | null) => v ?? "vận động viên" },
            { dataIndex: "arrival_at", title: "Đến", width: 140, render: when },
            { dataIndex: "departure_at", title: "Về", width: 140, render: when },
            { dataIndex: "nights", title: "Đêm", width: 110,
              render: (v: number | null, r) => `${v ?? 0} (${r.tam_chuc_nights ?? 0}NB/${r.ha_noi_nights ?? 0}HN)` },
            { dataIndex: "room_type", title: "Phòng", width: 90, render: (v: string | null) => v ?? "—" },
            { dataIndex: "roommate", title: "Ở cùng", width: 130 },
            { dataIndex: "entries", title: "Nội dung", width: 90 },
            {
              title: "Hồ sơ", width: 110, fixed: "right",
              render: (_, r) =>
                r.missing_fields === 0 ? <Tag color="green">đủ</Tag> : <Tag color="red">thiếu {r.missing_fields}</Tag>,
            },
            { dataIndex: "updated_at", title: "Cập nhật", width: 140, render: when },
          ]}
        />
      </Card>
    </main>
  );
}
