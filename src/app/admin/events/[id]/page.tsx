"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Button, Card, DatePicker, Form, Input, List, Space, Table, Tag, Typography, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { adminCreateSession, adminDeleteSession } from "@/lib/adminApi";
import EventForm from "../../EventForm";

const { Title, Paragraph, Text } = Typography;

type EventRow = Record<string, unknown> & { id: number; code: string; name_vi: string };
type SessionRow = { id: number; starts_at: string; ends_at: string | null; title: string | null; venue: string | null };
type SignupRow = {
  member_id: string; full_name: string; status: string; session_title: string | null;
  answers: Record<string, unknown> | null; updated_at: string;
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";

export default function EventEditPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<{ title?: string; starts_at?: Dayjs; ends_at?: Dayjs; venue?: string }>();

  const load = useCallback(async () => {
    if (!supabaseConfigured || !Number.isFinite(id)) return;
    const [e, s, g] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).maybeSingle(),
      supabase.from("event_sessions").select("id, starts_at, ends_at, title, venue").eq("event_id", id).order("starts_at"),
      supabase.from("v_member_signups")
        .select("member_id, full_name, status, session_title, answers, updated_at")
        .eq("event_id", id).order("full_name"),
    ]);
    if (e.error ?? s.error ?? g.error) setError((e.error ?? s.error ?? g.error)?.message ?? "load failed");
    setEvent((e.data as EventRow) ?? null);
    setSessions((s.data ?? []) as SessionRow[]);
    setSignups((g.data ?? []) as SignupRow[]);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const addSession = async (values: { title?: string; starts_at?: Dayjs; ends_at?: Dayjs; venue?: string }) => {
    if (!values.starts_at) {
      void message.warning("Chọn thời gian bắt đầu của buổi.");
      return;
    }
    try {
      await adminCreateSession({
        event_id: id,
        title: values.title ?? null,
        venue: values.venue ?? null,
        starts_at: values.starts_at.toISOString(),
        ends_at: values.ends_at ? values.ends_at.toISOString() : null,
      });
      form.resetFields();
      void message.success("Đã thêm buổi");
      await load();
    } catch (e) {
      void message.error(String((e as Error).message));
    }
  };

  const removeSession = async (sessionId: number) => {
    try {
      await adminDeleteSession(sessionId);
      await load();
    } catch (e) {
      void message.error(String((e as Error).message));
    }
  };

  if (!event) {
    return (
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        {error ? <Alert type="error" showIcon message={error} /> : <Text type="secondary">Đang tải…</Text>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <Title level={3}>{event.name_vi} <Text code>{event.code}</Text></Title>
      <Paragraph type="secondary">
        <Link href="/admin">← Bảng điều khiển</Link> ·{" "}
        <a href={`/api/admin/export?event=${event.code}`}>CSV đăng ký của sự kiện này</a>
      </Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      <EventForm initial={event} eventId={id} />

      <Card title="Các buổi (mỗi buổi một dòng)" style={{ marginTop: 16 }}>
        <List
          size="small"
          dataSource={sessions}
          locale={{ emptyText: "Chưa có buổi nào — thêm bên dưới." }}
          renderItem={(s) => (
            <List.Item actions={[<Button key="del" size="small" danger onClick={() => void removeSession(s.id)}>Xoá</Button>]}>
              <Space>
                <Text strong style={{ width: 260, display: "inline-block" }}>{s.title ?? "(không tên)"}</Text>
                <span>{when(s.starts_at)}</span>
                {s.venue && <Tag>{s.venue}</Tag>}
              </Space>
            </List.Item>
          )}
        />
        <Form form={form} layout="inline" onFinish={addSession} style={{ marginTop: 12, rowGap: 8, flexWrap: "wrap" }}>
          <Form.Item name="title" label="Tên buổi">
            <Input placeholder="Yushinkai" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="starts_at" label="Bắt đầu" rules={[{ required: true, message: "" }]}>
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="ends_at" label="Kết thúc">
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="venue" label="Địa điểm">
            <Input style={{ width: 160 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">Thêm buổi</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title={`Đăng ký (${signups.length})`} style={{ marginTop: 16 }}>
        <Table<SignupRow>
          dataSource={signups}
          rowKey={(r) => `${r.member_id}-${r.session_title ?? "all"}`}
          size="small"
          pagination={{ pageSize: 25, showSizeChanger: false }}
          columns={[
            { dataIndex: "member_id", title: "Mã", width: 100 },
            { dataIndex: "full_name", title: "Họ tên" },
            { dataIndex: "session_title", title: "Buổi", render: (v: string | null) => v ?? <Text type="secondary">cả sự kiện</Text> },
            {
              dataIndex: "status", title: "Trạng thái", width: 120,
              render: (v: string) => (
                <Tag color={v === "confirmed" ? "green" : v === "waitlist" ? "orange" : v === "cancelled" ? "red" : "blue"}>{v}</Tag>
              ),
            },
            {
              dataIndex: "answers", title: "Trả lời", render: (v: Record<string, unknown> | null) =>
                v && Object.keys(v).length ? <Text code style={{ fontSize: 12 }}>{JSON.stringify(v)}</Text> : "—",
            },
            { dataIndex: "updated_at", title: "Cập nhật", width: 150, render: when },
          ]}
        />
      </Card>
    </main>
  );
}
