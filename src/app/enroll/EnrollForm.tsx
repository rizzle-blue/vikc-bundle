"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert, Button, Card, Col, DatePicker, Divider, Form, Input, Row, Select, Space, Tag, Typography, message,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { TAM_CHUC_NIGHTS, WINDOW, deriveStay, missingProfileFields } from "@/lib/registration";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import EventCheckins from "./EventCheckins";
import BasicInfoFields from "./BasicInfoFields";
import ProfileFields from "./ProfileFields";
import ExamFields from "./ExamFields";
import type { EventRow, Selection, SessionRow } from "./types";

const { Title, Paragraph, Text } = Typography;
const ROOM_TYPES = ["Đôi", "Ba", "Đơn"];

type Member = { id: string; full_name: string; rank: string | null };
type Profile = Record<string, unknown> & { current_rank_issued_on?: string | null };
/** Roster facts the form needs for the exam eligibility check. */
type MemberInfo = {
  full_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  rank: string | null;
  vkf_id: string | null;
};
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [info, setInfo] = useState<MemberInfo | null>(null);

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
      const [trip, evs, counts, sess, mine, prof, member] = await Promise.all([
        supabase.from("registrations").select("*").eq("member_id", id).maybeSingle(),
        supabase
          .from("events")
          .select("id, code, name_vi, kind, starts_at, counts_as_entry, included_in_package, price_vnd, capacity, form_schema, notes, sort_order")
          .eq("active", true)
          .order("sort_order"),
        supabase.from("v_event_signup_counts").select("event_id, signups"),
        supabase.from("event_sessions").select("id, event_id, starts_at, title").order("starts_at"),
        supabase.from("event_signups").select("event_id, session_id, answers, status").eq("member_id", id),
        supabase.from("member_profiles").select("*").eq("member_id", id).maybeSingle(),
        supabase.from("members").select("full_name, gender, date_of_birth, phone, email, rank, vkf_id").eq("id", id).maybeSingle(),
      ]);
      const firstError = trip.error ?? evs.error ?? counts.error ?? sess.error ?? mine.error ?? prof.error ?? member.error;
      if (firstError) setError(firstError.message);

      form.setFieldsValue({
        arrival_at: trip.data?.arrival_at ? dayjs(trip.data.arrival_at) : null,
        departure_at: trip.data?.departure_at ? dayjs(trip.data.departure_at) : null,
        room_type: trip.data?.room_type ?? null,
        roommate: trip.data?.roommate ?? null,
        notes: trip.data?.notes ?? null,
      });

      // paperwork: profile + the exam entry that belongs to the exam event
      const profileRow = (prof.data ?? null) as Profile | null;
      setProfile(profileRow);
      setInfo((member.data ?? null) as MemberInfo | null);
      const examEvent = (evs.data ?? []).find((e) => e.kind === "exam");
      const examEntry = examEvent
        ? (await supabase.from("exam_entries").select("*")
            .eq("member_id", id).eq("event_id", examEvent.id).eq("withdrawn", false).maybeSingle()).data
        : null;
      const roster = (member.data ?? null) as MemberInfo | null;
      form.setFieldsValue({
        full_name_vi: (profileRow?.full_name_vi as string) ?? roster?.full_name ?? "",
        gender: (profileRow?.gender as string) ?? roster?.gender ?? undefined,
        date_of_birth: profileRow?.date_of_birth ? dayjs(profileRow.date_of_birth as string) : roster?.date_of_birth ? dayjs(roster.date_of_birth) : null,
        phone: (profileRow?.phone as string) ?? roster?.phone ?? "",
        email: (profileRow?.email as string) ?? roster?.email ?? "",
        declared_vkf_member:
          (profileRow?.declared_vkf_member as boolean | null) ?? Boolean(roster?.vkf_id),
        declared_vkf_id: (profileRow?.declared_vkf_id as string) ?? roster?.vkf_id ?? "",
        full_name_latin: (profileRow?.full_name_latin as string) ?? "",
        full_name_kanji: (profileRow?.full_name_kanji as string) ?? "",
        use_kanji_on_certificate: Boolean(profileRow?.use_kanji_on_certificate),
        national_id: (profileRow?.national_id as string) ?? "",
        nationality: (profileRow?.nationality as string) ?? "Việt Nam",
        occupation: (profileRow?.occupation as string) ?? "",
        address: (profileRow?.address as string) ?? "",
        dojo_name: (profileRow?.dojo_name as string) ?? "Shakaijin",
        emergency_contact: (profileRow?.emergency_contact as string) ?? "",
        certificate_mailing_address: (profileRow?.certificate_mailing_address as string) ?? "",
        exam_grade_applied: (examEntry?.grade_applied as string) ?? undefined,
        exam_also_shodan: Boolean(examEntry?.also_shodan),
        exam_current_rank: (examEntry?.current_rank as string) ?? (member.data?.rank as string) ?? "",
        exam_current_rank_issued_on: examEntry?.current_rank_issued_on
          ? dayjs(examEntry.current_rank_issued_on as string)
          : profileRow?.current_rank_issued_on
            ? dayjs(profileRow.current_rank_issued_on as string)
            : null,
        exam_current_rank_issued_by: (examEntry?.current_rank_issued_by as string) ?? (profileRow?.current_rank_issued_by as string) ?? "",
        exam_dojo_approved: Boolean(examEntry?.dojo_approved),
      } as never);

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

  // exam-specific fields (typed, not the generic form_schema): the grade drives the VKF fee bracket
  const examEvent = events.find((e) => e.kind === "exam");
  const examChecked = Boolean(examEvent && selections[examEvent.event_id]?.checked);
  const examValues = {
    exam_grade_applied: Form.useWatch<string | undefined>("exam_grade_applied", form) as string | undefined,
    exam_current_rank: Form.useWatch<string | undefined>("exam_current_rank", form) as string | undefined,
    exam_current_rank_issued_on: Form.useWatch<Dayjs | null>("exam_current_rank_issued_on", form) as Dayjs | null,
  };
  const profileMissing = missingProfileFields(profile as Record<string, unknown> | null).length;

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

      // VKF paperwork (reused by every form the club submits)
      const raw = values as unknown as Record<string, unknown>;
      const text = (key: string) => {
        const v = raw[key];
        return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
      };
      const profileUpsert = await supabase.from("member_profiles").upsert(
        {
          member_id: values.member_id,
          full_name_vi: text("full_name_vi"),
          gender: text("gender"),
          date_of_birth: (raw.date_of_birth as Dayjs | null)?.format("YYYY-MM-DD") ?? null,
          phone: text("phone"),
          email: text("email"),
          declared_vkf_member: raw.declared_vkf_member === true,
          declared_vkf_id: text("declared_vkf_id"),
          full_name_latin: text("full_name_latin"),
          full_name_kanji: text("full_name_kanji"),
          use_kanji_on_certificate: raw.use_kanji_on_certificate === true,
          national_id: text("national_id"),
          nationality: text("nationality"),
          address: text("address"),
          occupation: text("occupation"),
          dojo_name: text("dojo_name"),
          emergency_contact: text("emergency_contact"),
          certificate_mailing_address: text("certificate_mailing_address"),
          current_rank_photo_url: text("current_rank_photo_url"),
          current_rank: text("exam_current_rank") ?? profile?.current_rank ?? null,
          current_rank_issued_on: examValues.exam_current_rank_issued_on
            ? examValues.exam_current_rank_issued_on.format("YYYY-MM-DD")
            : (profile?.current_rank_issued_on as string | null) ?? null,
          current_rank_issued_by: text("exam_current_rank_issued_by"),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id" },
      );
      if (profileUpsert.error) throw profileUpsert.error;

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
      // the exam entry: typed row for the VKF submission, withdrawn when the member unticks it
      if (examEvent) {
        if (examChecked) {
          const grade = text("exam_grade_applied");
          if (!grade) throw new Error("Thi Kyu/Dan cần chọn cấp đẳng đăng ký thi.");
          const entry = await supabase.from("exam_entries").upsert(
            {
              member_id: values.member_id,
              event_id: examEvent.event_id,
              grade_applied: grade,
              also_shodan: grade === "1 kyu" && raw.exam_also_shodan === true,
              current_rank: text("exam_current_rank") ?? info?.rank ?? null,
              current_rank_issued_on: examValues.exam_current_rank_issued_on
                ? examValues.exam_current_rank_issued_on.format("YYYY-MM-DD")
                : null,
              current_rank_issued_by: text("exam_current_rank_issued_by"),
              dojo_approved: raw.exam_dojo_approved === true,
              withdrawn: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "member_id,event_id" },
          );
          if (entry.error) throw entry.error;
        } else {
          const withdraw = await supabase.from("exam_entries")
            .update({ withdrawn: true, updated_at: new Date().toISOString() })
            .eq("member_id", values.member_id).eq("event_id", examEvent.event_id);
          if (withdraw.error) throw withdraw.error;
        }
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

        {loaded && <BasicInfoFields rosterRank={info?.rank ?? null} rosterVkfId={info?.vkf_id ?? null} />}
        {loaded && <ProfileFields mustFill={profileMissing} />}

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
            {examChecked && (
              <ExamFields
                values={examValues}
                dateOfBirth={info?.date_of_birth ?? null}
                rosterRank={info?.rank ?? null}
                vkfMember={Boolean(info?.vkf_id)}
                examDate={examEvent?.starts_at ?? null}
              />
            )}
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
