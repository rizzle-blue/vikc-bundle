import type { ResourceProps } from "@refinedev/core";

/** Only what this trip needs: the roster, one trip row per member, and two derived views. */
export const resources: ResourceProps[] = [
  { name: "track", list: "/track", meta: { label: "Bảng theo dõi" } },
  { name: "enroll", list: "/enroll", meta: { label: "Đăng ký giờ đến / về" } },
  { name: "registrations", list: "/trips", edit: "/trips/edit/:id", meta: { label: "Giờ đến & về" } },
  { name: "v_member_stay", list: "/stay", meta: { label: "Đêm / ngày" } },
  { name: "members", list: "/members", meta: { label: "Thành viên" } },
];
