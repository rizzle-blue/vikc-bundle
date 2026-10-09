"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Col, Row, Space, Statistic, Switch, Table, Tag, Typography, message } from "antd";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { adminSetExpected } from "@/lib/adminApi";

const { Title, Paragraph } = Typography;

type EventRow = {
  event_id: number; code: string; name_vi: string; kind: string; starts_at: string | null;
  counts_as_entry: boolean; included_in_package: boolean; price_vnd: number | null;
  capacity: number | null; signups: number; confirmed: number; sort_order: number;
};
type MemberRow = { id: string; full_name: string; rank: string | null; expected: boolean };
type StayRow = { member_id: string; nights: number | null; complete: boolean | null; arrival_at: string | null };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";

/** Operator dashboard: the programme at a glance, who is expected, and the exports. */
export default function AdminPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [stays, setStays] = useState<StayRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabaseConfigured) return;
    const [e, m, s] = await Promise.all([
      supabase.from("v_event_signup_counts")
        .select("event_id, code, name_vi, kind, starts_at, counts_as_entry, included_in_package, price_vnd, capacity, signups, confirmed, sort_order")
        .order("sort_order"),
      supabase.from("members").select("id, full_name, rank, expected").order("full_name"),
      supabase.from("v_member_stay").select("member_id, nights, complete, arrival_at"),
    ]);
    if (e.error ?? m.error ?? s.error) setError((e.error ?? m.error ?? s.error)?.message ?? "load failed");
    setEvents((e.data ?? []) as EventRow[]);
    setMembers((m.data ?? []) as MemberRow[]);
    setStays((s.data ?? []) as StayRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stayOf = (id: string) => stays.find((s) => s.member_id === id);
  const totalSignups = events.reduce((n, e) => n + e.signups, 0);
  const expectedCount = members.filter((m) => m.expected).length;
  const registered = stays.filter((s) => s.arrival_at).length;

  const toggleExpected = async (id: string, expected: boolean) => {
    try {
      await adminSetExpected([id], expected);
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, expected } : m)));
    } catch (e) {
      void message.error(String((e as Error).message));
    }
  };

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Title level={2}>Ban tổ chức · VIKC 2026</Title>
      <Paragraph type="secondary">
        <Link href="/track">Bảng theo dõi</Link> · <Link href="/enroll">Trang thành viên</Link> ·
        {" "}<a href="/api/admin/export?kind=counts">CSV sự kiện</a> ·
        {" "}<a href="/api/admin/export?kind=members">CSV thành viên</a> ·
        {" "}<a href="/api/admin/export">CSV tất cả đăng ký</a>
      </Paragraph>
      {!supabaseConfigured && <Alert type="error" showIcon message="Chưa cấu hình Supabase." />}
      {error && <Alert type="error" showIcon message={error} />}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Sự kiện" value={events.length} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Lượt đăng ký" value={totalSignups} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Đã đăng ký chuyến đi" value={registered} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Dự kiến tham gia" value={expectedCount} /></Card></Col>
      </Row>

      <Card
        title="Sự kiện"
        extra={<Link href="/admin/events/new"><Button type="primary">Thêm sự kiện</Button></Link>}
        style={{ marginBottom: 16 }}
      >
        <Table<EventRow>
          dataSource={events}
          rowKey="event_id"
          size="small"
          pagination={false}
          scroll={{ x: 900 }}
          columns={[
            { dataIndex: "code", title: "Mã", width: 110 },
            { dataIndex: "name_vi", title: "Tên", render: (v: string, r) => <Link href={`/admin/events/${r.event_id}`}>{v}</Link> },
            { dataIndex: "starts_at", title: "Khi", width: 160, render: when },
            { dataIndex: "kind", title: "Loại", width: 130 },
            {
              dataIndex: "counts_as_entry", title: "nội dung", width: 90,
              render: (v: boolean) => (v ? <Tag color="red">1 nội dung</Tag> : ""),
            },
            {
              dataIndex: "included_in_package", title: "Trong gói", width: 100,
              render: (v: boolean) => (v ? <Tag color="green">gồm</Tag> : ""),
            },
            { dataIndex: "price_vnd", title: "Phí", width: 110, render: (v: number | null) => (v ? v.toLocaleString("vi-VN") : "—") },
            {
              title: "Đăng ký", width: 110,
              render: (_, r) => <span>{r.signups}{r.capacity ? ` / ${r.capacity}` : ""}</span>,
            },
          ]}
        />
      </Card>

      <Card title="Thành viên — ai được dự kiến tham gia">
        <Table<MemberRow>
          dataSource={members}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 25, showSizeChanger: false }}
          scroll={{ x: 700 }}
          columns={[
            { dataIndex: "id", title: "Mã", width: 100 },
            { dataIndex: "full_name", title: "Họ tên" },
            { dataIndex: "rank", title: "Kyu/Dan", width: 110, render: (v: string | null) => v ?? "—" },
            {
              title: "Chuyến đi", width: 130,
              render: (_, r) => {
                const s = stayOf(r.id);
                return s?.arrival_at ? <Tag color="blue">{s.nights} đêm</Tag> : <Tag>chưa đăng ký</Tag>;
              },
            },
            { dataIndex: "expected", title: "Dự kiến", width: 110,
              render: (v: boolean, r) => <Switch size="small" checked={v} onChange={(c) => void toggleExpected(r.id, c)} /> },
            {
              title: "", width: 120,
              render: (_, r) => (stayOf(r.id)?.arrival_at ? <Link href={`/trips/edit/${r.id}`}>Sửa giờ</Link> : <Space />),
            },
          ]}
        />
      </Card>
    </main>
  );
}
