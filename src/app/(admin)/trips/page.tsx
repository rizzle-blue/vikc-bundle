"use client";

import { DateField, EditButton, List, TextField, useTable } from "@refinedev/antd";
import { Table, Tag } from "antd";

/**
 * One row per member: the two datetimes that drive everything else.
 * `member_id` is the primary key, so Refine is told about it through `meta.idColumnName`.
 */
export default function TripsPage() {
  const { tableProps } = useTable({
    resource: "registrations",
    meta: { idColumnName: "member_id" },
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  });

  return (
    <List resource="registrations" title="Giờ đến & giờ về">
      <Table {...tableProps} rowKey="member_id" size="middle">
        <Table.Column dataIndex="member_id" title="Mã TV" width={90} />
        <Table.Column
          dataIndex="arrival_at"
          title="Đến"
          render={(v: string | null) => (v ? <DateField value={v} format="DD/MM/YYYY HH:mm" /> : <Tag color="red">chưa điền</Tag>)}
        />
        <Table.Column
          dataIndex="departure_at"
          title="Về"
          render={(v: string | null) => (v ? <DateField value={v} format="DD/MM/YYYY HH:mm" /> : <Tag color="red">chưa điền</Tag>)}
        />
        <Table.Column dataIndex="room_type" title="Phòng" width={90} render={(v: string | null) => v ?? "—"} />
        <Table.Column
          dataIndex="team3"
          title="Đội 3"
          width={80}
          render={(v: boolean) => (v ? <Tag color="blue">x</Tag> : "")}
        />
        <Table.Column
          dataIndex="team5"
          title="Đội 5"
          width={80}
          render={(v: boolean) => (v ? <Tag color="blue">x</Tag> : "")}
        />
        <Table.Column dataIndex="exam_grade" title="Thi" width={90} render={(v: string | null) => v ?? "—"} />
        <Table.Column
          dataIndex="updated_at"
          title="Cập nhật"
          width={140}
          render={(v: string | null) => (v ? <DateField value={v} format="DD/MM/YYYY HH:mm" /> : "—")}
        />
        <Table.Column
          title=""
          width={80}
          render={(_, r: { member_id: string }) => (
            <EditButton resource="registrations" recordItemId={r.member_id} meta={{ idColumnName: "member_id" }} size="small" />
          )}
        />
      </Table>
    </List>
  );
}
