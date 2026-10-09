"use client";

import { List, TextField, useTable } from "@refinedev/antd";
import { Space, Table, Tag } from "antd";

/** The roster — read-only for everyone (grants allow SELECT only). */
export default function MembersPage() {
  const { tableProps } = useTable({
    resource: "members",
    syncWithLocation: true,
    sorters: { initial: [{ field: "full_name", order: "asc" }] },
    pagination: { pageSize: 50 },
  });

  return (
    <List resource="members" title="Thành viên">
      <Table {...tableProps} rowKey="id" size="middle">
        <Table.Column dataIndex="id" title="Mã" width={90} />
        <Table.Column dataIndex="full_name" title="Họ tên" render={(v: string) => <TextField value={v} />} />
        <Table.Column dataIndex="gender" title="Giới tính" width={90} />
        <Table.Column dataIndex="rank" title="Kyu/Dan" width={110} />
        <Table.Column dataIndex="date_of_birth" title="Ngày sinh" width={120} />
        <Table.Column
          dataIndex="vkf_id"
          title="VKF"
          width={90}
          render={(v: string | null) => (v ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>)}
        />
        <Table.Column
          dataIndex="phone"
          title="Liên hệ"
          render={(_, r: { phone: string | null; email: string | null }) => (
            <Space direction="vertical" size={0}>
              <span>{r.phone ?? "—"}</span>
              <span style={{ color: "#888", fontSize: 12 }}>{r.email ?? ""}</span>
            </Space>
          )}
        />
      </Table>
    </List>
  );
}
