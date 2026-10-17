import { sql } from "drizzle-orm";
import { check, date, integer, text, uuid } from "drizzle-orm/pg-core";
import { app, profiles } from "./foundation";

export const accountPersonalDetails = app.table(
  "account_personal_details",
  {
    profileId: uuid("profile_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    birthdate: date("birthdate", { mode: "string" }),
    gender: text("gender"),
    revision: integer("revision").notNull().default(1),
  },
  (table) => [
    check(
      "account_personal_details_revision_check",
      sql`${table.revision} > 0`,
    ),
    check(
      "account_birthdate_minimum",
      sql`${table.birthdate} >= date '1900-01-01'`,
    ),
    check(
      "account_gender_bounds",
      sql`${table.gender} is null or (${table.gender} = btrim(${table.gender}) and char_length(${table.gender}) between 1 and 80 and ${table.gender} !~ '[[:cntrl:]]')`,
    ),
  ],
);
