"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Alert, Descriptions, DatePicker, Form, Input, Select, Switch } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { deriveStay } from "@/lib/registration";

const ROOM_TYPES = ["Đôi", "Ba", "Đơn"];
const EXAM_GRADES = ["1 kyu", "1 dan", "2 dan", "3 dan", "4 dan", "5 dan"];

type FormValues = {
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

/** Admin fix-up of one member's two datetimes (the member's own page is /enroll). */
export default function TripEditPage() {
  const { id } = useParams<{ id: string }>();
  const { formProps, saveButtonProps, query } = useForm<FormValues>({
    resource: "member_trip",
    id,
    action: "edit",
    meta: { idColumnName: "member_id" },
  });
  const [form] = Form.useForm<FormValues>();

  // the picker needs dayjs objects, the database gives ISO strings
  useEffect(() => {
    const record = query?.data?.data as Record<string, unknown> | undefined;
    if (!record) return;
    form.setFieldsValue({
      ...(record as unknown as FormValues),
      arrival_at: record.arrival_at ? dayjs(record.arrival_at as string) : null,
      departure_at: record.departure_at ? dayjs(record.departure_at as string) : null,
    });
  }, [query?.data, form]);

  const arrival = Form.useWatch<Dayjs | null>("arrival_at", form);
  const departure = Form.useWatch<Dayjs | null>("departure_at", form);
  const stay = deriveStay({
    arrivalAt: arrival ? arrival.toISOString() : null,
    departureAt: departure ? departure.toISOString() : null,
  });

  return (
    <Edit resource="member_trip" recordItemId={id} title={`Giờ đến & về — ${id}`} saveButtonProps={saveButtonProps}>
      {stay.warnings.includes("departure-before-arrival") && (
        <Alert type="error" showIcon message="Giờ về phải sau giờ đến." style={{ marginBottom: 16 }} />
      )}
      <Form<FormValues>
        {...formProps}
        form={form}
        layout="vertical"
        onFinish={(values) =>
          formProps.onFinish?.({
            ...values,
            arrival_at: values.arrival_at ? (values.arrival_at as Dayjs).toISOString() : null,
            departure_at: values.departure_at ? (values.departure_at as Dayjs).toISOString() : null,
          })
        }
      >
        <Form.Item name="member_id" label="Mã thành viên">
          <Input disabled />
        </Form.Item>
        <Form.Item name="arrival_at" label="Giờ đến (dự kiến)">
          <DatePicker showTime format="DD/MM/YYYY HH:mm" minuteStep={5} style={{ width: 260 }} allowClear />
        </Form.Item>
        <Form.Item name="departure_at" label="Giờ về (dự kiến)">
          <DatePicker showTime format="DD/MM/YYYY HH:mm" minuteStep={5} style={{ width: 260 }} allowClear />
        </Form.Item>
        <Descriptions size="small" column={3} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Đêm">{stay.nights}</Descriptions.Item>
          <Descriptions.Item label="Ngày">{stay.days}</Descriptions.Item>
          <Descriptions.Item label="Tam Chúc / Hà Nội">
            {stay.tamChucNights} / {stay.haNoiNights}
          </Descriptions.Item>
        </Descriptions>
        <Form.Item name="room_type" label="Loại phòng">
          <Select allowClear options={ROOM_TYPES.map((v) => ({ value: v, label: v }))} style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="roommate" label="Bạn cùng phòng">
          <Input placeholder="Mã TV hoặc tên" style={{ maxWidth: 320 }} />
        </Form.Item>
        <Form.Item name="exam_grade" label="Thi Kyu/Dan">
          <Select allowClear options={EXAM_GRADES.map((v) => ({ value: v, label: v }))} style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="team3" label="Đội 3" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="team5" label="Đội 5" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="dojo_exchange" label="Giao lưu võ đường HN" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="notes" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Edit>
  );
}
