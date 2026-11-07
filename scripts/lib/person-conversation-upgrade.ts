import postgres from "postgres";
import { personUpgradeFixture } from "../../tests/database/person-conversation-fixture";
const url = new URL(process.env.DATABASE_TEST_URL!);
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55322" ||
  !/^\/mov177_[a-f0-9]{12}_upgrade$/.test(url.pathname)
)
  throw Error("Disposable MOV-177 upgrade required.");
const db = postgres(url.toString(), { max: 1, ssl: false, onnotice: () => {} });
try {
  console.log(JSON.stringify(await personUpgradeFixture(db)));
} finally {
  await db.end({ timeout: 1 });
}
