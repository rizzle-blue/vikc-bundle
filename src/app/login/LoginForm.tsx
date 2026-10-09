"use client";

import { useActionState, useEffect, useState } from "react";
import { Alert, Button, Card, Input, Space, Typography } from "antd";
import { signIn, type LoginState } from "./actions";

const { Title, Paragraph } = Typography;

/**
 * Plain <form action={…}> rather than AntD's Form: a server action needs React to own the submit,
 * and the code must never be handled by client-side code.
 */
export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, null);
  // Until React has hydrated, a submit would be a *native* form post — no server action, no cookie,
  // and the user sees nothing happen. Keep the button disabled for that instant.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <Card style={{ maxWidth: 420, margin: "64px auto" }}>
      <Title level={4} style={{ marginBottom: 4 }}>Nhập mã truy cập</Title>
      <Paragraph type="secondary">
        Đoàn Shakaijin · VIKC 2026. Thành viên dùng mã của đoàn, ban tổ chức dùng mã quản trị.
      </Paragraph>
      {state?.error && <Alert type="error" showIcon message={state.error} style={{ marginBottom: 12 }} />}
      <form action={formAction}>
        <input type="hidden" name="next" value={next} />
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Input.Password name="code" size="large" placeholder="Mã truy cập" autoFocus autoComplete="off" required />
          <Button type="primary" htmlType="submit" size="large" loading={pending || !ready} disabled={!ready}>
            Vào
          </Button>
        </Space>
      </form>
      <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
        Mã chỉ giữ link riêng tư — không phải tài khoản. Ai có mã đều sửa được thông tin của đoàn.
      </Paragraph>
    </Card>
  );
}
