export type FormSchemaField = {
  name: string;
  label: string;
  type?: "text" | "select" | "boolean";
  required?: boolean;
  options?: string[];
};

export type EventRow = {
  event_id: number;
  code: string;
  name_vi: string;
  kind: string;
  starts_at: string | null;
  counts_as_entry: boolean;
  included_in_package: boolean;
  price_vnd: number | null;
  capacity: number | null;
  signups: number;
  form_schema: FormSchemaField[] | null;
  notes: string | null;
  sort_order: number;
};

export type SessionRow = { id: number; event_id: number; starts_at: string; title: string | null };

export type Selection = { checked: boolean; sessions: number[]; answers: Record<string, unknown> };
