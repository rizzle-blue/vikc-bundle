"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Card, Col, Progress, Row, Statistic, Table, Tag, Typography } from "antd";
import { DEADLINES, daysUntil } from "@/lib/registration";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const { Title, Paragraph, Text } = Typography;

type StayRow = {
  member_id: string; full_name: string; expected: boolean | null; role: string | null;
  arrival_at: string | null; departure_at: string | null; room_type: string | null;
  complete: boolean | null; nights: number | null; tam_chuc_nights: number | null; ha_noi_nights: number | null;
};
type DayRow = { vn_day: string; present: number; confirmed: number; vikc_days: boolean; ha_noi_days: boolean };
type EventRow = {
  event_id: number; code: string; name_vi: string; kind: string; starts_at: string | null;
  counts_as_entry: boolean; included_in_package: boolean; price_vnd: number | null;
  capacity: number | null; signups: number; confirmed: number; sort_order: number;
};
type EntryRow = { member_id: string; entries: number };

const dmy = (d: string | null) =>
  d ? new Date(d).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";
const day = (d: string) =>
  new Date(d).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", weekday: "short" });

/** Organiser board: who signed up, what they entered, and how many people are there each day. */
export default function TrackPage() {
  const [stays, setStays] = useState<StayRow[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    void (async () => {
      const [stay, dayRes, ev, entry] = await Promise.all([
        supabase.from("v_member_stay")
          .select("member_id, full_name, expected, role, arrival_at, departure_at, room_type, complete, nights, tam_chuc_nights, ha_noi_nights")
          .order("full_name"),
        supabase.from("v_headcount_per_day").select("vn_day, present, confirmed, vikc_days, ha_noi_days").order("vn_day"),
        supabase.from("v_event_signup_counts")
          .select("event_id, code, name_vi, kind, starts_at, counts_as_entry, included_in_package, price_vnd, capacity, signups, confirmed, sort_order")
          .order("sort_order"),
        supabase.from("v_member_entry_count").select("member_id, entries"),
      ]);
      const firstError = stay.error ?? dayRes.error ?? ev.error ?? entry.error;
      if (firstError) setError(firstError.message);
      setStays((stay.data ?? []) as StayRow[]);
      setDays((dayRes.data ?? []) as DayRow[]);
      setEvents((ev.data ?? []) as EventRow[]);
      setEntries((entry.data ?? []) as EntryRow[]);
    })();
  }, []);

  const kpi = useMemo(() => {
    const registered = stays.filter((s) => s.arrival_at);
    return {
      roster: stays.length,
      registered: registered.length,
      expected: stays.filter((s) => s.expected).length,
      nights: registered.reduce((n, s) => n + (s.nights ?? 0), 0),
      rooms: registered.filter((s) => s.room_type).length,
      signups: events.reduce((n, e) => n + e.signups, 0),
      oneEntry: entries.filter((e) => e.entries === 1).length,
      twoEntries: entries.filter((e) => e.entries >= 2).length,
    };
  }, [stays, events, entries]);

  const finished = kpi.roster ? Math.round((kpi.registered / kpi.roster) * 100) : 0;
  const registered = stays.filter((s) => s.arrival_at);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Title level={2}>Bảng theo dõi · Shakaijin VIKC 2026</Title>
      <Paragraph type="secondary">
        Quân số tính từ giờ đến / giờ về của từng thành viên · <Link href="/enroll">trang đăng ký</Link>
        {" · "}<Link href="/admin">ban tổ chức</Link>
      </Paragraph>
      {!supabaseConfigured && <Alert type="error" showIcon message="Chưa cấu hình Supabase." />}
      {error && <Alert type="error" showIcon message={error} />}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Đã đăng ký" value={kpi.registered} suffix={`/ ${kpi.roster}`} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Ban tổ chức dự kiến" value={kpi.expected} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Tổng đêm (dự kiến)" value={kpi.nights} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Lượt đăng ký sự kiện" value={kpi.signups} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card title="Tiến độ">
            <Progress percent={finished} status={finished === 100 ? "success" : "active"} />
            <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
              {kpi.rooms} / {kpi.registered} đã chọn loại phòng · danh sách 22 thành viên chỉ là dữ liệu tham chiếu,
              không phải ai cũng tham gia.
            </Paragraph>
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card title="Số nội dung thi đấu (gói VKF)">
            <Statistic value={kpi.twoEntries} suffix="VĐV 2 nội dung" />
            <Text type="secondary" style={{ fontSize: 12 }}>{kpi.oneEntry} VĐV 1 nội dung</Text>
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card title={`Hạn đăng ký · ${DEADLINES.register.split("-").reverse().join("/")}`}>
            <Statistic value={daysUntil(DEADLINES.register)} suffix="ngày" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Thanh toán trước {daysUntil(DEADLINES.pay)} ngày (25/10/2026)
            </Text>
          </Card>
        </Col>
      </Row>

      <Card title="Nội dung đã mở đăng ký" style={{ marginBottom: 16 }}>
        <Table<EventRow>
          dataSource={events}
          rowKey="event_id"
          size="small"
          pagination={false}
          scroll={{ x: 860 }}
          columns={[
            { dataIndex: "name_vi", title: "Sự kiện", render: (v: string) => <Text strong>{v}</Text> },
            { dataIndex: "starts_at", title: "Khi", width: 150, render: dmy },
            { dataIndex: "kind", title: "Loại", width: 130 },
            {
              dataIndex: "counts_as_entry", title: "nội dung", width: 100,
              render: (v: boolean) => (v ? <Tag color="red">có</Tag> : ""),
            },
            { dataIndex: "price_vnd", title: "Phí", width: 110, render: (v: number | null) => (v ? v.toLocaleString("vi-VN") : "—") },
            {
              title: "Đăng ký", width: 120,
              render: (_, r) => (
                <span>
                  <Text strong>{r.signups}</Text>
                  <Text type="secondary">{r.capacity ? ` / ${r.capacity}` : ""}</Text>
                </span>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Quân số theo ngày (18–30/11/2026)" style={{ marginBottom: 16 }}>
        <Table<DayRow>
          dataSource={days}
          rowKey="vn_day"
          size="small"
          pagination={false}
          scroll={{ x: 640 }}
          columns={[
            {
              dataIndex: "vn_day", title: "Ngày",
              render: (d: string, r) => (
                <span>
                  {day(d)}
                  {r.vikc_days && <Tag color="red" style={{ marginLeft: 6 }}>VIKC</Tag>}
                  {r.ha_noi_days && <Tag color="blue" style={{ marginLeft: 6 }}>Hà Nội</Tag>}
                </span>
              ),
            },
            { dataIndex: "present", title: "Có mặt (đã biết đến)", width: 180 },
            { dataIndex: "confirmed", title: "Đã đủ 2 mốc giờ", width: 160 },
          ]}
        />
      </Card>

      <Card title={`Đã đăng ký (${registered.length})`}>
        <Table<StayRow>
          dataSource={registered}
          rowKey="member_id"
          size="small"
          pagination={{ pageSize: 25, showSizeChanger: false }}
          scroll={{ x: 900 }}
          columns={[
            { dataIndex: "member_id", title: "Mã", width: 90 },
            { dataIndex: "full_name", title: "Họ tên" },
            { dataIndex: "role", title: "Vai trò", width: 110, render: (v: string | null) => v ?? "vận động viên" },
            { dataIndex: "arrival_at", title: "Đến", render: dmy },
            { dataIndex: "departure_at", title: "Về", render: dmy },
            {
              dataIndex: "nights", title: "Đêm", width: 90,
              render: (v: number | null, r) => <span>{v ?? 0}<Text type="secondary" style={{ fontSize: 11 }}> ({r.tam_chuc_nights ?? 0}NB/{r.ha_noi_nights ?? 0}HN)</Text></span>,
            },
            { dataIndex: "room_type", title: "Phòng", width: 90, render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
            {
              title: "Trạng thái", width: 120,
              render: (_, r) => (r.complete ? <Tag color="green">đủ</Tag> : <Tag color="orange">thiếu phòng</Tag>),
            },
          ]}
        />
      </Card>
    </main>
  );
}
