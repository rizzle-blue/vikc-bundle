"use client";

import { List, NumberField, TextField, useTable } from "@refinedev/antd";
import { Table, Tag } from "antd";

/** Derived view: nights/days per member and how the nights split across the two legs. */
export default function StayPage() {
  const { tableProps } = useTable({
    resource: "v_member_stay",
    meta: { idColumnName: "member_id" },
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  });

  return (
    <List resource="v_member_stay" title="Đêm / ngày (tự tính)">
      <Table {...tableProps} rowKey="member_id" size="middle">
        <Table.Column dataIndex="member_id" title="Mã TV" width={90} />
        <Table.Column dataIndex="full_name" title="Họ tên" render={(v: string) => <TextField value={v} />} />
        <Table.Column dataIndex="nights" title="Đêm" width={80} render={(v: number) => <NumberField value={v} />} />
        <Table.Column dataIndex="days" title="Ngày" width={80} render={(v: number) => <NumberField value={v} />} />
        <Table.Column
          dataIndex="tam_chuc_nights"
          title="Đêm Tam Chúc"
          width={130}
          render={(v: number) => <NumberField value={v} />}
        />
        <Table.Column
          dataIndex="ha_noi_nights"
          title="Đêm Hà Nội"
          width={120}
          render={(v: number) => <NumberField value={v} />}
        />
        <Table.Column
          dataIndex="complete"
          title="Đủ thông tin"
          width={110}
          render={(v: boolean) => (v ? <Tag color="green">đủ</Tag> : <Tag color="orange">thiếu</Tag>)}
        />
      </Table>
    </List>
  );
}
