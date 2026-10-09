"use client";

import { Card, Col, Form, Input, Row, Select, Switch, Typography } from "antd";

const { Paragraph, Text } = Typography;

/**
 * The paperwork VKF's registration workbook asks for and the roster cannot provide
 * (docs/spec-member-registration.md). Filled once, reused by every submitted form.
 */
export default function ProfileFields({ mustFill }: { mustFill: number }) {
  return (
    <Card
      size="small"
      title="Hồ sơ cá nhân (VKF yêu cầu)"
      extra={mustFill > 0 ? <Text type="warning">còn thiếu {mustFill} mục</Text> : <Text type="success">đã đủ</Text>}
      style={{ marginBottom: 12 }}
    >
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        Ban tổ chức phải gửi VKF bản Excel kèm đơn thi Kyu/Dan. Những thông tin này in trên bằng,
        nên cần đúng chính tả.
      </Paragraph>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="full_name_latin"
            label="Họ tên chữ Latin (IN HOA, dùng trên bằng)"
            tooltip="Ví dụ: NGUYEN VAN A"
          >
            <Input placeholder="NGUYEN VAN A" style={{ textTransform: "uppercase" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="full_name_kanji" label="Họ tên chữ Hán (nếu có)">
            <Input placeholder="例：山田 太郎" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="use_kanji_on_certificate" label="In tên Kanji trên bằng?" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="national_id" label="Số CCCD / Hộ chiếu" rules={[{ pattern: /^[A-Za-z0-9]*$/, message: "Chỉ chữ và số" }]}>
            <Input placeholder="012345678901" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="nationality" label="Quốc tịch">
            <Input placeholder="Việt Nam" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="occupation" label="Nghề nghiệp">
            <Input placeholder="Kỹ sư phần mềm" />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item name="address" label="Địa chỉ">
            <Input placeholder="Số nhà, đường, quận, tỉnh/thành" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="dojo_name" label="Tên CLB">
            <Input placeholder="Shakaijin" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="emergency_contact" label="Liên hệ khẩn cấp (tên + số ĐT)">
            <Input placeholder="Nguyễn Thị B — 0901234567" />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item
            name="current_rank_photo_url"
            label="Link ảnh bằng hiện có (ảnh ghi rõ họ tên)"
            tooltip="VKF yêu cầu ảnh chụp bằng Kyu/Dan hiện tại, nhìn rõ họ tên. Dán link Google Drive / iCloud (nhớ bật chia sẻ cho người xem)."
            rules={[{ type: "url", message: "Dán link ảnh (http…)", warningOnly: true }]}
          >
            <Input placeholder="https://drive.google.com/…" />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item name="certificate_mailing_address" label="Địa chỉ nhận bằng">
            <Input placeholder="Theo địa chỉ của CLB" />
          </Form.Item>
        </Col>
      </Row>
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
        Giới tính, ngày sinh, email, số điện thoại, trình độ hiện tại lấy từ danh sách thành viên.
        Sai thì báo ban tổ chức sửa.
      </Paragraph>
    </Card>
  );
}
