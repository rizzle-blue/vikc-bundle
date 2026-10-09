"use client";

import { Badge, Card, Checkbox, Divider, Empty, Input, Select, Space, Switch, Tag, Typography } from "antd";
import type { FormSchemaField, EventRow, SessionRow, Selection } from "./types";

const { Text, Paragraph } = Typography;

const GROUPS: { kinds: string[]; title: string; hint?: string }[] = [
  { kinds: ["team_shiai"], title: "Thi đấu đồng đội", hint: "Mỗi nội dung tính vào gói VKF (1 hoặc 2 nội dung)." },
  { kinds: ["exam"], title: "Thi Kyu/Dan", hint: "Lệ phí thi theo cấp đẳng, ban tổ chức thu riêng." },
  { kinds: ["seminar", "godo", "party", "ceremony", "meeting"], title: "Chương trình chung", hint: "Đã bao gồm trong gói." },
  { kinds: ["dojo"], title: "Giao lưu võ đường Hà Nội", hint: "Mỗi ngày một võ đường — chọn những ngày bạn tham gia." },
  { kinds: ["tour", "meal", "other"], title: "Khác" },
];

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";

function SchemaFields({
  fields, answers, onChange,
}: {
  fields: FormSchemaField[];
  answers: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}) {
  return (
    <div style={{ marginTop: 8, paddingLeft: 26 }}>
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        {fields.map((f) => (
          <div key={f.name}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {f.label}{f.required ? " *" : ""}
            </Text>
            {f.type === "select" ? (
              <Select
                size="small"
                style={{ width: 220, display: "block" }}
                placeholder="Chọn"
                value={(answers[f.name] as string) ?? undefined}
                onChange={(v) => onChange(f.name, v)}
                options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
              />
            ) : f.type === "boolean" ? (
              <Switch size="small" checked={Boolean(answers[f.name])} onChange={(v) => onChange(f.name, v)} />
            ) : (
              <Input
                size="small"
                style={{ maxWidth: 260 }}
                value={(answers[f.name] as string) ?? ""}
                onChange={(e) => onChange(f.name, e.target.value)}
              />
            )}
          </div>
        ))}
      </Space>
    </div>
  );
}

export default function EventCheckins({
  events, sessions, selections, onToggle, onSession, onAnswer, disabled,
}: {
  events: EventRow[];
  sessions: Record<number, SessionRow[]>;
  selections: Record<number, Selection>;
  onToggle: (eventId: number, checked: boolean) => void;
  onSession: (eventId: number, sessionId: number, checked: boolean) => void;
  onAnswer: (eventId: number, name: string, value: unknown) => void;
  disabled: boolean;
}) {
  if (!events.length) return <Empty description="Chưa có sự kiện nào được mở." />;

  return (
    <>
      {GROUPS.map((group) => {
        const inGroup = events.filter((e) => group.kinds.includes(e.kind));
        if (!inGroup.length) return null;
        return (
          <Card key={group.title} size="small" title={group.title} style={{ marginBottom: 12 }}>
            {group.hint && <Paragraph type="secondary" style={{ fontSize: 12 }}>{group.hint}</Paragraph>}
            {inGroup.map((e) => {
              const sel = selections[e.event_id];
              const own = sessions[e.event_id] ?? [];
              const fields = (e.form_schema ?? []) as FormSchemaField[];
              return (
                <div key={e.event_id} style={{ padding: "6px 0" }}>
                  <Checkbox
                    disabled={disabled}
                    checked={Boolean(sel?.checked)}
                    onChange={(ev) => onToggle(e.event_id, ev.target.checked)}
                  >
                    <Space wrap size={6}>
                      <Text strong>{e.name_vi}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{when(e.starts_at)}</Text>
                      {e.counts_as_entry && <Tag color="red">tính 1 nội dung</Tag>}
                      {e.included_in_package && <Tag color="green">trong gói</Tag>}
                      {!e.included_in_package && e.price_vnd ? <Tag>{e.price_vnd.toLocaleString("vi-VN")}đ</Tag> : null}
                      {e.capacity ? <Text type="secondary" style={{ fontSize: 12 }}>{e.signups}/{e.capacity} chỗ</Text> : null}
                    </Space>
                  </Checkbox>

                  {sel?.checked && own.length > 0 && (
                    <div style={{ marginTop: 6, paddingLeft: 26 }}>
                      <Space direction="vertical" size={2}>
                        {own.map((s) => (
                          <Checkbox
                            key={s.id}
                            disabled={disabled}
                            checked={sel.sessions.includes(s.id)}
                            onChange={(ev) => onSession(e.event_id, s.id, ev.target.checked)}
                          >
                            <Text style={{ fontSize: 13 }}>{s.title ?? "Buổi"}</Text>{" "}
                            <Text type="secondary" style={{ fontSize: 12 }}>{when(s.starts_at)}</Text>
                          </Checkbox>
                        ))}
                      </Space>
                    </div>
                  )}

                  {sel?.checked && fields.length > 0 && (
                    <SchemaFields fields={fields} answers={sel.answers} onChange={(n, v) => onAnswer(e.event_id, n, v)} />
                  )}
                  {e.notes && sel?.checked && (
                    <Paragraph type="secondary" style={{ fontSize: 12, margin: "4px 0 0 26px" }}>{e.notes}</Paragraph>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}
      <Divider style={{ margin: "12px 0" }} />
      <Badge status="processing" text={<Text type="secondary" style={{ fontSize: 12 }}>
        Đăng ký sự kiện được lưu cùng nút “Lưu” phía dưới.
      </Text>} />
    </>
  );
}
