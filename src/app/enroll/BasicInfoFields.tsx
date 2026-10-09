"use client";

import { Card, Checkbox, Col, DatePicker, Form, Input, Row, Select, Typography } from "antd";

const { Paragraph, Text } = Typography;

/**
 * Scope 1 — the basic information VKF needs. It arrives pre-filled from the club's roster; the member
 * confirms or corrects it. Their answer is stored on their own record, so the club's roster is never
 * rewritten (docs/spec-member-data-model.md).
 */
export default function BasicInfoFields({ rosterRank, rosterVkfId }: { rosterRank?: string | null; rosterVkfId?: string | null }) {
  return (
    <Card
      size="small"
      title="Thông tin cơ bản"
      extra={<Text type="secondary" style={{ fontSize: 12 }}>đã điền sẵn từ danh sách CLB — sửa nếu sai</Text>}
      style={{ marginBottom: 12 }}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="full_name_vi" label="Họ và tên">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="gender" label="Giới tính">
            <Select allowClear options={[{ value: "Nam" }, { value: "Nữ" }]} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="date_of_birth" label="Ngày sinh">
            <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="phone" label="Số điện thoại">
            <Input inputMode="tel" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="email" label="Email">
            <Input inputMode="email" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="declared_vkf_member" label="Là thành viên VKF?" valuePropName="checked">
            <Checkbox>Đã có thẻ thành viên VKF</Checkbox>
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="declared_vkf_id"
            label="Mã số thành viên VKF"
            tooltip="Nếu chưa có, để trống — VKF tính lệ phí thi theo dạng không phải thành viên."
          >
            <Input placeholder={rosterVkfId ?? "251000156"} />
          </Form.Item>
        </Col>
      </Row>
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
        Trình độ hiện tại{rosterRank ? ` (CLB ghi: ${rosterRank})` : ""} khai ở phần thi Kyu/Dan bên dưới.
      </Paragraph>
    </Card>
  );
}
