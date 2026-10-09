"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Card, Col, Progress, Row, Statistic, Table, Tag, Typography } from "antd";
import { DEADLINES, daysUntil } from "@/lib/registration";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const { Title, Paragraph, Text } = Typography;

/** Shape of the `v_member_stay` view row (snake_case, straight from PostgREST). */
type StayRow = {
  member_id: string;
  full_name: string;
  arrival_at: string | null;
  departure_at: string | null;
  room_type: string | null;
  complete: boolean;
  nights: number;
  days: number;
  tam_chuc_nights: number;
  ha_noi_nights: number;
  outside_nights: number;
};
type DayRow = { vn_day: string; present: number; confirmed: number; vikc_days: boolean; ha_noi_days: boolean };

const dmy = (d: string | null) =>
  d ? new Date(d).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";

/** Admin board: who is in Vietnam on which day, and who has not filled their datetimes yet. */
export default function TrackPage() {
  const [stays, setStays] = useState<StayRow[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    void (async () => {
      const [stayRes, dayRes] = await Promise.all([
        supabase
          .from("v_member_stay")
          .select("member_id, full_name, arrival_at, departure_at, room_type, complete, nights, days, tam_chuc_nights, ha_noi_nights, outside_nights")
          .order("full_name"),
        supabase.from("v_headcount_per_day").select("vn_day, present, confirmed, vikc_days, ha_noi_days").order("vn_day"),
      ]);
      if (stayRes.error ?? dayRes.error) setError((stayRes.error ?? dayRes.error)?.message ?? "load failed");
      setStays((stayRes.data ?? []) as StayRow[]);
      setDays((dayRes.data ?? []) as DayRow[]);
    })();
  }, []);

  const kpi = useMemo(() => {
    const filled = stays.filter((s) => s.arrival_at && s.departure_at);
    return {
      total: stays.length,
      filled: filled.length,
      missing: stays.length - filled.length,
      nights: filled.reduce((sum, s) => sum + (s.nights ?? 0), 0),
      rooms: stays.filter((s) => s.room_type).length,
    };
  }, [stays]);

  const finishedPercent = kpi.total ? Math.round((kpi.filled / kpi.total) * 100) : 0;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <Title level={2}>Bảng theo dõi · Shakaijin VIKC 2026</Title>
      <Paragraph type="secondary">
        Quân số tính từ giờ đến / giờ về của từng thành viên · <Link href="/enroll">trang đăng ký cho thành viên</Link>
      </Paragraph>
      {!supabaseConfigured && <Alert type="error" showIcon message="Chưa cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY)." />}
      {error && <Alert type="error" showIcon message={error} />}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card><Statistic title="Thành viên" value={kpi.total} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Đã điền giờ đến & về" value={kpi.filled} suffix={`/ ${kpi.total}`} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Chưa điền" value={kpi.missing} valueStyle={kpi.missing ? { color: "#cf1322" } : undefined} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Tổng đêm (dự kiến)" value={kpi.nights} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card title="Tiến độ điền thông tin">
            <Progress percent={finishedPercent} status={finishedPercent === 100 ? "success" : "active"} />
            <Paragraph type="secondary" style={{ marginTop: 8 }}>
              {kpi.rooms} / {kpi.total} đã chọn loại phòng
            </Paragraph>
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card title="Hạn đăng ký · 20/10/2026">
            <Statistic value={daysUntil(DEADLINES.register)} suffix="ngày" />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card title="Hạn thanh toán · 25/10/2026">
            <Statistic value={daysUntil(DEADLINES.pay)} suffix="ngày" />
          </Card>
        </Col>
      </Row>

      <Card title="Quân số theo ngày (18–30/11/2026)" style={{ marginBottom: 16 }}>
        <Table<DayRow>
          dataSource={days}
          rowKey="vn_day"
          size="small"
          pagination={false}
          scroll={{ x: 640 }}
          columns={[
            {
              dataIndex: "vn_day",
              title: "Ngày",
              render: (d: string) => {
                const day = days.find((x) => x.vn_day === d);
                return (
                  <span>
                    {new Date(d).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", weekday: "short" })}
                    {day?.vikc_days && <Tag color="red" style={{ marginLeft: 6 }}>VIKC</Tag>}
                    {day?.ha_noi_days && <Tag color="blue" style={{ marginLeft: 6 }}>Hà Nội</Tag>}
                  </span>
                );
              },
            },
            { dataIndex: "present", title: "Có mặt (đã biết đến)", width: 180 },
            { dataIndex: "confirmed", title: "Đã đủ 2 mốc giờ", width: 160 },
          ]}
        />
      </Card>

      <Card title="Từng thành viên">
        <Table<StayRow>
          dataSource={stays}
          rowKey="member_id"
          size="small"
          scroll={{ x: 720 }}
          pagination={{ pageSize: 25, showSizeChanger: false }}
          columns={[
            { dataIndex: "member_id", title: "Mã", width: 90 },
            { dataIndex: "full_name", title: "Họ tên" },
            { dataIndex: "arrival_at", title: "Đến", render: (v: string | null) => dmy(v) },
            { dataIndex: "departure_at", title: "Về", render: (v: string | null) => dmy(v) },
            { dataIndex: "nights", title: "Đêm", width: 70 },
            { dataIndex: "room_type", title: "Phòng", width: 90, render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
            {
              title: "Trạng thái",
              width: 120,
              render: (_, r) =>
                r.arrival_at && r.departure_at ? (
                  r.room_type ? <Tag color="green">đủ</Tag> : <Tag color="orange">thiếu phòng</Tag>
                ) : (
                  <Tag color="red">chưa điền</Tag>
                ),
            },
          ]}
        />
      </Card>
    </main>
  );
}
