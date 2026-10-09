"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Form, Input, Row, Select, Space, Switch, Tag, Typography, message,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { TAM_CHUC_NIGHTS, WINDOW, deriveStay } from "@/lib/registration";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const { Title, Paragraph, Text } = Typography;
const ROOM_TYPES = ["Đôi", "Ba", "Đơn"];
const EXAM_GRADES = ["1 kyu", "1 dan", "2 dan", "3 dan", "4 dan", "5 dan"];

type Member = { id: string; full_name: string; rank: string | null };
type Values = {
  member_id: string;
  arrival_at: Dayjs | null;
  departure_at: Dayjs | null;
  room_type: string | null;
  roommate: string | null;
  exam_grade: string | null;
  team3: boolean;
  team5: boolean;
  dojo_exchange: boolean;
  notes: string | null;
};

/**
 * The member-facing page: pick your name, enter when you arrive and when you leave.
 * Everything else (nights, days, which leg, headcount) is derived — see @/lib/registration.
 * No login (decision 1a): writes go through the publishable key + RLS, so the link can edit rows.
 */
export default function EnrollPage() {
  const [form] = Form.useForm<Values>();
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  /** Load whatever this member already filled in, so they can correct it. */
  const loadExisting = async (id: string) => {
    const { data, error: err } = await supabase
      .from("registrations")
      .select("*")
      .eq("member_id", id)
      .maybeSingle();
    if (err) {
      setError(err.message);
      return;
    }
    setLoaded(true);
    form.setFieldsValue({
      arrival_at: data?.arrival_at ? dayjs(data.arrival_at) : null,
      departure_at: data?.departure_at ? dayjs(data.departure_at) : null,
      room_type: data?.room_type ?? null,
      roommate: data?.roommate ?? null,
      exam_grade: data?.exam_grade ?? null,
      team3: data?.team3 ?? false,
      team5: data?.team5 ?? false,
      dojo_exchange: data?.dojo_exchange ?? false,
      notes: data?.notes ?? null,
    });
  };

  const save = async (values: Values) => {
    if (!values.member_id) {
      void message.warning("Chọn tên của bạn trước.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      arrival_at: values.arrival_at ? values.arrival_at.toISOString() : null,
      departure_at: values.departure_at ? values.departure_at.toISOString() : null,
      room_type: values.room_type ?? null,
      roommate: values.roommate ?? null,
      exam_grade: values.exam_grade ?? null,
      team3: Boolean(values.team3),
      team5: Boolean(values.team5),
      dojo_exchange: Boolean(values.dojo_exchange),
      notes: values.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase.from("registrations").update(payload).eq("member_id", values.member_id);
    setSaving(false);
    if (err) {
      setError(err.message);
      void message.error("Không lưu được: " + err.message);
      return;
    }
    void message.success("Đã lưu. Cảm ơn bạn!");
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 48px" }}>
      <Title level={3} style={{ marginBottom: 4 }}>Đăng ký giờ đến & giờ về</Title>
      <Paragraph type="secondary">
        Shakaijin · VIKC 2026 (19–22/11, Tam Chúc) & giao lưu Hà Nội (23–29/11).{" "}
        <Link href="/track">Bảng theo dõi</Link>
      </Paragraph>

      {!supabaseConfigured && <Alert type="error" showIcon message="Chưa cấu hình Supabase." style={{ marginBottom: 12 }} />}
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      <Form<Values> form={form} layout="vertical" onFinish={save} initialValues={{ team3: false, team5: false, dojo_exchange: false }}>
        <Form.Item name="member_id" label="Tên của bạn" rules={[{ required: true, message: "Chọn tên của bạn" }]}>
          <Select
            showSearch
            size="large"
            placeholder="Chọn tên trong danh sách"
            optionFilterProp="label"
            onChange={(id: string) => void loadExisting(id)}
            options={members.map((m) => ({ value: m.id, label: `${m.full_name} (${m.id}${m.rank ? " · " + m.rank : ""})` }))}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="arrival_at" label="Bạn đến lúc nào?" rules={[{ required: true, message: "Nhập giờ đến" }]}>
              <DatePicker showTime format="DD/MM/YYYY HH:mm" minuteStep={5} size="large" style={{ width: "100%" }} placeholder="Chọn ngày & giờ đến" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="departure_at" label="Bạn về lúc nào?">
              <DatePicker showTime format="DD/MM/YYYY HH:mm" minuteStep={5} size="large" style={{ width: "100%" }} placeholder="Chọn ngày & giờ về" />
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
            <Divider orientation="left" plain>Thông tin thêm (không bắt buộc)</Divider>
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
              <Col xs={24} md={12}>
                <Form.Item name="exam_grade" label="Đăng ký thi Kyu/Dan">
                  <Select allowClear options={EXAM_GRADES.map((v) => ({ value: v, label: v }))} placeholder="Không thi" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="team3" label="Đội 3 người" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="team5" label="Đội 5 người" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="dojo_exchange" label="Giao lưu võ đường Hà Nội" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="notes" label="Ghi chú">
              <Input.TextArea rows={2} placeholder="Ví dụ: bay chuyến VJ…, cần phòng cùng anh A" />
            </Form.Item>
          </>
        )}

        <Button type="primary" htmlType="submit" size="large" loading={saving} disabled={!memberId}>
          Lưu
        </Button>
        <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
          Trang này không cần đăng nhập: ai có link cũng sửa được. Nếu cần sửa lại, chọn tên và lưu tiếp.
        </Paragraph>
      </Form>
    </main>
  );
}
