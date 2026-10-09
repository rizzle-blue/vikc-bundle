"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, Switch, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { adminCreateEvent, adminUpdateEvent } from "@/lib/adminApi";

export const EVENT_KINDS = [
  ["seminar", "Seminar"], ["godo", "Godo Keiko"], ["exam", "Thi Kyu/Dan"],
  ["team_shiai", "Thi đấu đồng đội"], ["party", "Tiệc"], ["dojo", "Giao lưu võ đường"],
  ["meal", "Bữa ăn"], ["meeting", "Họp"], ["ceremony", "Lễ"], ["tour", "Tham quan"], ["other", "Khác"],
] as const;

type EventValues = {
  id?: number;
  code: string;
  name_vi: string;
  name_en?: string;
  kind: string;
  starts_at?: Dayjs | null;
  ends_at?: Dayjs | null;
  venue?: string;
  counts_as_entry: boolean;
  included_in_package: boolean;
  price_vnd?: number | null;
  capacity?: number | null;
  signup_opens_at?: Dayjs | null;
  signup_closes_at?: Dayjs | null;
  requires_team: boolean;
  team_size?: number | null;
  team_gender?: string | null;
  form_schema?: string;
  sort_order: number;
  active: boolean;
  notes?: string;
};

const iso = (d?: Dayjs | null) => (d ? d.toISOString() : null);

export default function EventForm({ initial, eventId }: { initial?: Record<string, unknown>; eventId?: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialValues: Partial<EventValues> = {
    code: (initial?.code as string) ?? "",
    name_vi: (initial?.name_vi as string) ?? "",
    name_en: (initial?.name_en as string) ?? "",
    kind: (initial?.kind as string) ?? "other",
    starts_at: initial?.starts_at ? dayjs(initial.starts_at as string) : null,
    ends_at: initial?.ends_at ? dayjs(initial.ends_at as string) : null,
    venue: (initial?.venue as string) ?? "",
    counts_as_entry: Boolean(initial?.counts_as_entry),
    included_in_package: Boolean(initial?.included_in_package),
    price_vnd: (initial?.price_vnd as number) ?? null,
    capacity: (initial?.capacity as number) ?? null,
    signup_opens_at: initial?.signup_opens_at ? dayjs(initial.signup_opens_at as string) : null,
    signup_closes_at: initial?.signup_closes_at ? dayjs(initial.signup_closes_at as string) : null,
    requires_team: Boolean(initial?.requires_team),
    team_size: (initial?.team_size as number) ?? null,
    team_gender: (initial?.team_gender as string) ?? null,
    form_schema: initial?.form_schema ? JSON.stringify(initial.form_schema, null, 2) : "",
    sort_order: (initial?.sort_order as number) ?? 0,
    active: initial?.active === undefined ? true : Boolean(initial.active),
    notes: (initial?.notes as string) ?? "",
  };

  const save = async (values: EventValues) => {
    setSaving(true);
    setError(null);
    const payload = {
      ...values,
      starts_at: iso(values.starts_at),
      ends_at: iso(values.ends_at),
      signup_opens_at: iso(values.signup_opens_at),
      signup_closes_at: iso(values.signup_closes_at),
      price_vnd: values.price_vnd ?? null,
      capacity: values.capacity ?? null,
      team_size: values.team_size ?? null,
      team_gender: values.team_gender ?? null,
      form_schema: values.form_schema?.trim() ? values.form_schema : null,
    };
    try {
      if (eventId) {
        await adminUpdateEvent({ ...payload, id: eventId });
        void message.success("Đã lưu");
      } else {
        const res = (await adminCreateEvent(payload)) as { data?: { id?: number } };
        void message.success("Đã tạo");
        if (res?.data?.id) router.push(`/admin/events/${res.data.id}`);
      }
      router.refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={eventId ? `Sửa sự kiện #${eventId}` : "Thêm sự kiện mới"}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <Form<EventValues> layout="vertical" initialValues={initialValues} onFinish={save}>
        <Space wrap size="large" align="start">
          <Form.Item name="code" label="Mã (không đổi sau khi tạo)" rules={[{ required: true, message: "Nhập mã" }]}>
            <Input style={{ width: 180 }} disabled={Boolean(eventId)} placeholder="team3-nam" />
          </Form.Item>
          <Form.Item name="kind" label="Loại">
            <Select style={{ width: 200 }} options={EVENT_KINDS.map(([v, l]) => ({ value: v, label: l }))} />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị">
            <InputNumber style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="active" label="Đang mở" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>

        <Form.Item name="name_vi" label="Tên (tiếng Việt)" rules={[{ required: true, message: "Nhập tên" }]}>
          <Input />
        </Form.Item>
        <Form.Item name="name_en" label="Tên (English)">
          <Input />
        </Form.Item>

        <Space wrap size="large" align="start">
          <Form.Item name="starts_at" label="Bắt đầu">
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="ends_at" label="Kết thúc">
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="venue" label="Địa điểm">
            <Input style={{ width: 280 }} />
          </Form.Item>
        </Space>

        <Space wrap size="large" align="start">
          <Form.Item name="counts_as_entry" label="Tính là 1 “nội dung” (gói VKF)" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="included_in_package" label="Đã bao gồm trong gói" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="price_vnd" label="Phí / người (để trống nếu đã gồm)">
            <InputNumber style={{ width: 180 }} step={50000} />
          </Form.Item>
          <Form.Item name="capacity" label="Số chỗ">
            <InputNumber style={{ width: 120 }} />
          </Form.Item>
        </Space>

        <Space wrap size="large" align="start">
          <Form.Item name="signup_opens_at" label="Mở đăng ký">
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="signup_closes_at" label="Hạn đăng ký">
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="requires_team" label="Thi đấu đồng đội" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="team_size" label="Số người / đội">
            <InputNumber style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="team_gender" label="Giới tính">
            <Select
              style={{ width: 140 }}
              allowClear
              options={[{ value: "Nam" }, { value: "Nữ" }, { value: "Hỗn hợp" }]}
            />
          </Form.Item>
        </Space>

        <Form.Item
          name="form_schema"
          label="Trường hỏi thêm khi đăng ký (JSON)"
          tooltip='Ví dụ: [{"name":"grade","label":"Kyu/Dan đăng ký thi","type":"select","required":true,"options":["1 kyu","1 dan"]}]'
        >
          <Input.TextArea rows={4} style={{ fontFamily: "monospace", fontSize: 12 }} />
        </Form.Item>
        <Form.Item name="notes" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>Lưu</Button>
          <Button onClick={() => router.push("/admin")}>Về bảng điều khiển</Button>
        </Space>
      </Form>
    </Card>
  );
}
