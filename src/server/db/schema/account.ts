import { sql } from "drizzle-orm";
import { check, date, integer, text, unique, uuid } from "drizzle-orm/pg-core";
import { app, profiles } from "./foundation";

export const accountPersonalDetails = app.table(
  "account_personal_details",
  {
    profileId: uuid("profile_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    birthdate: date("birthdate", { mode: "string" }),
    legalName: text("legal_name"),
    preferredFirstName: text("preferred_first_name"),
    username: text("username"),
    gender: text("gender"),
    revision: integer("revision").notNull().default(1),
  },
  (table) => [
    unique("account_username_unique").on(table.username),
    check(
      "account_username_format",
      sql`${table.username} is null or ${table.username} ~ '^[a-z][a-z0-9_]{2,29}$'`,
    ),
    check(
      "account_legal_name_bounds",
      sql`${table.legalName} is null or (${table.legalName} = btrim(${table.legalName}) and char_length(${table.legalName}) between 2 and 80 and ${table.legalName} !~ '[[:cntrl:]]' and ${table.legalName} ~ '[[:alnum:]]')`,
    ),
    check(
      "account_preferred_name_bounds",
      sql`${table.preferredFirstName} is null or (${table.preferredFirstName} = btrim(${table.preferredFirstName}) and char_length(${table.preferredFirstName}) between 1 and 80 and ${table.preferredFirstName} !~ '[[:cntrl:]]' and ${table.preferredFirstName} ~ '[[:alnum:]]')`,
    ),
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
