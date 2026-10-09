"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert, Button, Card, Col, DatePicker, Divider, Form, Input, Row, Select, Space, Tag, Typography, message,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { TAM_CHUC_NIGHTS, WINDOW, deriveStay } from "@/lib/registration";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import EventCheckins from "./EventCheckins";
import type { EventRow, Selection, SessionRow } from "./types";

const { Title, Paragraph, Text } = Typography;
const ROOM_TYPES = ["Đôi", "Ba", "Đơn"];

type Member = { id: string; full_name: string; rank: string | null };
type Values = {
  member_id: string;
  arrival_at: Dayjs | null;
  departure_at: Dayjs | null;
  room_type: string | null;
  roommate: string | null;
  notes: string | null;
};

/**
 * Member page: enter when you arrive and when you leave, then check in to the events you take part
 * in. The roster is reference data — the registration row is created on first save.
 */
export default function EnrollForm() {
  const [form] = Form.useForm<Values>();
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<Record<number, SessionRow[]>>({});
  const [selections, setSelections] = useState<Record<number, Selection>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    void (async () => {
      const { data, error: err } = await supabase.from("members").select("id, full_name, rank").order("full_name");
      if (err) setError(err.message);
      setMembers((data ?? []) as Member[]);
    })();
  }, []);

  const memberId = Form.useWatch<string>("member_id", form);
  const arrival = Form.useWatch<Dayjs | null>("arrival_at", form);
  const departure = Form.useWatch<Dayjs | null>("departure_at", form);
  const stay = useMemo(
    () =>
      deriveStay({
        arrivalAt: arrival ? arrival.toISOString() : null,
        departureAt: departure ? departure.toISOString() : null,
      }),
    [arrival, departure],
  );

  /** Load what this member already filled in: the trip row and every event they checked. */
  const loadMember = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [trip, evs, counts, sess, mine] = await Promise.all([
        supabase.from("registrations").select("*").eq("member_id", id).maybeSingle(),
        supabase
          .from("events")
          .select("id, code, name_vi, kind, starts_at, counts_as_entry, included_in_package, price_vnd, capacity, form_schema, notes, sort_order")
          .eq("active", true)
          .order("sort_order"),
        supabase.from("v_event_signup_counts").select("event_id, signups"),
        supabase.from("event_sessions").select("id, event_id, starts_at, title").order("starts_at"),
        supabase.from("event_signups").select("event_id, session_id, answers, status").eq("member_id", id),
      ]);
      const firstError = trip.error ?? evs.error ?? counts.error ?? sess.error ?? mine.error;
      if (firstError) setError(firstError.message);

      form.setFieldsValue({
        arrival_at: trip.data?.arrival_at ? dayjs(trip.data.arrival_at) : null,
        departure_at: trip.data?.departure_at ? dayjs(trip.data.departure_at) : null,
        room_type: trip.data?.room_type ?? null,
        roommate: trip.data?.roommate ?? null,
        notes: trip.data?.notes ?? null,
      });

      const signups = (counts.data ?? []) as { event_id: number; signups: number }[];
      setEvents(
        (evs.data ?? []).map((e) => ({
          ...e,
          event_id: e.id as number,
          signups: signups.find((c) => c.event_id === e.id)?.signups ?? 0,
        })) as EventRow[],
      );

      const byEvent: Record<number, SessionRow[]> = {};
      for (const s of (sess.data ?? []) as SessionRow[]) (byEvent[s.event_id] ??= []).push(s);
      setSessions(byEvent);

      const sel: Record<number, Selection> = {};
      for (const row of (mine.data ?? []) as { event_id: number; session_id: number | null; answers: Record<string, unknown> | null; status: string }[]) {
        if (row.status === "cancelled") continue;
        const current = (sel[row.event_id] ??= { checked: true, sessions: [], answers: {} });
        current.checked = true;
        if (row.session_id) current.sessions.push(row.session_id);
        current.answers = { ...current.answers, ...(row.answers ?? {}) };
      }
      setSelections(sel);
      setLoaded(true);
      setSavedAt((trip.data?.updated_at as string | null) ?? null);
    } finally {
      setLoading(false);
    }
  }, [form]);

  const toggle = (eventId: number, checked: boolean) =>
    setSelections((prev) => ({
      ...prev,
      [eventId]: { checked, sessions: checked ? prev[eventId]?.sessions ?? [] : [], answers: prev[eventId]?.answers ?? {} },
    }));

  const toggleSession = (eventId: number, sessionId: number, checked: boolean) =>
    setSelections((prev) => {
      const current = prev[eventId] ?? { checked: true, sessions: [], answers: {} };
      const set = new Set(current.sessions);
      if (checked) set.add(sessionId);
      else set.delete(sessionId);
      return { ...prev, [eventId]: { ...current, checked: true, sessions: [...set] } };
    });

  const setAnswer = (eventId: number, name: string, value: unknown) =>
    setSelections((prev) => {
      const current = prev[eventId] ?? { checked: true, sessions: [], answers: {} };
      return { ...prev, [eventId]: { ...current, answers: { ...current.answers, [name]: value } } };
    });

  const entryCount = events.filter((e) => e.counts_as_entry && selections[e.event_id]?.checked).length;

  const save = async (values: Values) => {
    if (!values.member_id) {
      void message.warning("Chọn tên của bạn trước.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const trip = await supabase.from("registrations").upsert(
        {
          member_id: values.member_id,
          arrival_at: values.arrival_at ? values.arrival_at.toISOString() : null,
          departure_at: values.departure_at ? values.departure_at.toISOString() : null,
          room_type: values.room_type ?? null,
          roommate: values.roommate ?? null,
          notes: values.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id" },
      );
      if (trip.error) throw trip.error;

      // Events: the member may cancel and re-check, but the anon key has no DELETE on sign-ups
      // (by design — the row is a record). So: cancel everything shown, then confirm what is ticked.
      const cancel = await supabase
        .from("event_signups")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("member_id", values.member_id)
        .in("event_id", events.map((e) => e.event_id));
      if (cancel.error) throw cancel.error;

      const rows: Record<string, unknown>[] = [];
      for (const e of events) {
        const sel = selections[e.event_id];
        if (!sel?.checked) continue;
        const own = sessions[e.event_id] ?? [];
        const base = { member_id: values.member_id, event_id: e.event_id, status: "confirmed", answers: sel.answers ?? {} };
        if (own.length) {
          if (sel.sessions.length) for (const sid of sel.sessions) rows.push({ ...base, session_id: sid });
          else rows.push({ ...base, session_id: null });
        } else {
          rows.push({ ...base, session_id: null });
        }
      }
      if (rows.length) {
        const ins = await supabase
          .from("event_signups")
          .upsert(rows, { onConflict: "event_id,member_id,session_id" });
        if (ins.error) throw ins.error;
      }
      setSavedAt(new Date().toISOString());
      void message.success("Đã lưu. Cảm ơn bạn!");
    } catch (e) {
      const msg = (e as { message?: string }).message ?? String(e);
      setError(msg);
      void message.error("Không lưu được: " + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 48px" }}>
      <Title level={3} style={{ marginBottom: 4 }}>Đăng ký tham dự</Title>
      <Paragraph type="secondary">
        Shakaijin · VIKC 2026 (19–22/11, Tam Chúc) & giao lưu Hà Nội (23–29/11).{" "}
        <Link href="/track">Bảng theo dõi</Link>
      </Paragraph>
      {!supabaseConfigured && <Alert type="error" showIcon message="Chưa cấu hình Supabase." style={{ marginBottom: 12 }} />}
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      <Form<Values> form={form} layout="vertical" onFinish={save}>
        <Form.Item name="member_id" label="Tên của bạn" rules={[{ required: true, message: "Chọn tên của bạn" }]}>
          <Select
            showSearch
            size="large"
            placeholder="Chọn tên trong danh sách"
            optionFilterProp="label"
            loading={loading}
            onChange={(id: string) => void loadMember(id)}
            options={members.map((m) => ({ value: m.id, label: `${m.full_name} (${m.id}${m.rank ? " · " + m.rank : ""})` }))}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="arrival_at" label="Bạn đến lúc nào?" rules={[{ required: true, message: "Nhập giờ đến" }]}>
              <DatePicker showTime format="DD/MM/YYYY HH:mm" minuteStep={5} size="large" style={{ width: "100%" }} placeholder="Ngày & giờ đến" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="departure_at" label="Bạn về lúc nào?">
              <DatePicker showTime format="DD/MM/YYYY HH:mm" minuteStep={5} size="large" style={{ width: "100%" }} placeholder="Ngày & giờ về" />
            </Form.Item>
          </Col>
        </Row>

        {(arrival || departure) && (
          <Card size="small" style={{ marginBottom: 16, background: "#fafafa" }}>
            <Space split={<Divider type="vertical" />} wrap>
              <Text strong>{stay.days} ngày</Text>
              <Text strong>{stay.nights} đêm</Text>
              <Text>Tam Chúc: {stay.tamChucNights} đêm</Text>
              <Text>Hà Nội: {stay.haNoiNights} đêm</Text>
            </Space>
            {stay.warnings.includes("departure-before-arrival") && (
              <Paragraph type="danger" style={{ marginTop: 8, marginBottom: 0 }}>Giờ về phải sau giờ đến.</Paragraph>
            )}
            {stay.warnings.includes("outside-window") && (
              <Paragraph type="warning" style={{ marginTop: 8, marginBottom: 0 }}>
                Ngoài khoảng {WINDOW.from} → {WINDOW.to} — ban tổ chức sẽ kiểm tra lại.
              </Paragraph>
            )}
            {stay.outsideNights > 0 && (
              <Paragraph type="warning" style={{ marginBottom: 0 }}>
                {stay.outsideNights} đêm nằm ngoài 2 chặng (Tam Chúc {TAM_CHUC_NIGHTS.from}–{TAM_CHUC_NIGHTS.to}, Hà Nội 23–29/11).
              </Paragraph>
            )}
          </Card>
        )}

        {loaded && (
          <>
            <Divider orientation="left" plain>Phòng & ghi chú</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="room_type" label="Loại phòng">
                  <Select allowClear options={ROOM_TYPES.map((v) => ({ value: v, label: v }))} placeholder="Đôi / Ba / Đơn" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="roommate" label="Bạn cùng phòng">
                  <Input placeholder="Tên hoặc mã thành viên" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="notes" label="Ghi chú">
              <Input.TextArea rows={2} placeholder="Ví dụ: bay chuyến VJ…, cần phòng cùng anh A" />
            </Form.Item>

            <Divider orientation="left" plain>Bạn tham gia nội dung nào?</Divider>
            {events.some((e) => e.counts_as_entry) && (
              <Paragraph>
                <Tag color={entryCount >= 2 ? "red" : "blue"}>
                  {entryCount} nội dung thi đấu
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Gói VKF tính theo 1 hoặc 2 nội dung (tối đa 2).
                </Text>
              </Paragraph>
            )}
            <EventCheckins
              events={events}
              sessions={sessions}
              selections={selections}
              onToggle={toggle}
              onSession={toggleSession}
              onAnswer={setAnswer}
              disabled={saving}
            />
          </>
        )}

        <Button type="primary" htmlType="submit" size="large" loading={saving} disabled={!memberId} style={{ marginTop: 8 }}>
          Lưu
        </Button>
        {savedAt && (
          <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
            Lưu lần cuối {new Date(savedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" })}
          </Text>
        )}
        <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
          Trang này dùng mã truy cập của đoàn, không phải tài khoản: ai có mã đều sửa được. Muốn sửa lại, chọn tên và lưu tiếp.
        </Paragraph>
      </Form>
    </main>
  );
}
