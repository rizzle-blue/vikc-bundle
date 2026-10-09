#!/usr/bin/env node
// Regenerate supabase/seed_members.sql from resources/members.json (roster is the source of truth).
// Run: node scripts/gen-member-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const members = JSON.parse(readFileSync(join(root, "resources/members.json"), "utf8"));

const q = (v) => (v === null || v === undefined || v === "" || v === "-" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const isoDate = (v) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v ?? "");
  return m ? `'${m[3]}-${m[2]}-${m[1]}'` : "null";
};

const rows = members
  .map((m) =>
    `  (${q(m.memberId)}, ${q(m.vkfId)}, ${q(m.fullName)}, ${q(m.gender)}, ${isoDate(m.dateOfBirth)}, ` +
    `${q(m.rank)}, ${q(m.email)}, ${q(m.phone)})`)
  .join(",\n");

const sql = `-- GENERATED FILE — do not edit by hand. Source: resources/members.json
-- Regenerate: node scripts/gen-member-seed.mjs
-- Idempotent: safe to run after every migration, and after roster edits.

insert into public.members (id, vkf_id, full_name, gender, date_of_birth, rank, email, phone) values
${rows}
on conflict (id) do update set
  vkf_id        = excluded.vkf_id,
  full_name     = excluded.full_name,
  gender        = excluded.gender,
  date_of_birth = excluded.date_of_birth,
  rank          = excluded.rank,
  email         = excluded.email,
  phone         = excluded.phone;

-- Nothing is pre-enrolled: the roster is reference data. A registrations row appears only when
-- a member signs up (docs/spec-events.md); the expected flag is the operator's own marker.
`;

writeFileSync(join(root, "supabase/seed_members.sql"), sql);
console.log(`wrote supabase/seed_members.sql (${members.length} members)`);
