"use client";

import { Alert, Card, Checkbox, Col, DatePicker, Form, Input, Row, Select, Typography } from "antd";
import type { Dayjs } from "dayjs";
import { EXAM_GRADES, checkEligibility } from "@/lib/registration";

const { Text, Paragraph } = Typography;

export type ExamValues = {
  exam_grade_applied?: string;
  exam_also_shodan?: boolean;
  exam_current_rank?: string;
  exam_current_rank_issued_on?: Dayjs | null;
  exam_current_rank_issued_by?: string;
  exam_dojo_approved?: boolean;
};

/** The exam-specific questions, shown when the member ticks the Kyu/Dan exam event. */
export default function ExamFields({
  values, dateOfBirth, rosterRank, vkfMember, examDate,
}: {
  values: ExamValues;
  dateOfBirth?: string | null;
  rosterRank?: string | null;
  vkfMember?: boolean;
  examDate?: string | null;
}) {
  const eligibility = checkEligibility({
    dateOfBirth,
    currentRank: values.exam_current_rank ?? rosterRank,
    currentRankIssuedOn: values.exam_current_rank_issued_on ? values.exam_current_rank_issued_on.format("YYYY-MM-DD") : null,
    gradeApplied: values.exam_grade_applied,
    examDate,
    vkfMember,
  });

  return (
    <Card size="small" title="Chi tiết thi Kyu/Dan" style={{ margin: "8px 0 12px 26px" }}>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="exam_grade_applied" label="Kyu/Dan đăng ký thi" rules={[{ required: true, message: "Chọn cấp đẳng" }]}>
            <Select placeholder="Chọn" options={EXAM_GRADES.map((g) => ({ value: g, label: g }))} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="exam_current_rank" label="Trình độ hiện tại">
            <Input placeholder={rosterRank ?? "2 kyu"} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="exam_current_rank_issued_on"
            label="Ngày cấp bằng hiện có"
            tooltip="VKF dựa vào ngày này để xét thời gian tập luyện tối thiểu."
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} placeholder="Chọn ngày" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="exam_current_rank_issued_by" label="Nơi/đơn vị cấp bằng hiện có">
            <Input placeholder="VKF / CLB ABC" />
          </Form.Item>
        </Col>
        {values.exam_grade_applied === "1 kyu" && (
          <Col xs={24}>
            <Form.Item name="exam_also_shodan" valuePropName="checked">
              <Checkbox>Đăng ký thi tiếp Shodan ngay sau khi đạt 1 Kyu (VKF cho phép)</Checkbox>
            </Form.Item>
          </Col>
        )}
        <Col xs={24}>
          <Form.Item name="exam_dojo_approved" valuePropName="checked">
            <Checkbox>CLB đã xác nhận hồ sơ này</Checkbox>
          </Form.Item>
        </Col>
      </Row>

      {eligibility.grade && (
        <Paragraph style={{ marginBottom: 0 }}>
          {eligibility.warnings.length === 0 ? (
            <Alert
              type="success"
              showIcon
              message={
                <Text style={{ fontSize: 13 }}>
                  Đủ điều kiện theo bảng VKF
                  {eligibility.age !== null ? ` (${eligibility.age} tuổi` : ""}
                  {eligibility.yearsSinceCurrent !== null ? `, ${eligibility.yearsSinceCurrent} năm từ bằng hiện có)` : eligibility.age !== null ? ")" : ""}
                </Text>
              }
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              message="Ban tổ chức sẽ kiểm tra lại"
              description={<ul style={{ margin: 0, paddingLeft: 18 }}>{eligibility.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            />
          )}
        </Paragraph>
      )}
    </Card>
  );
}
