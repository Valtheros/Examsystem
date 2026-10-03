// Explicitly opt-in local review accounts; never run on production.
import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
const password = process.env.REVIEW_PASSWORD;
if (!url || new URL(url).hostname !== "localhost" || !password || password.length < 12) {
  throw new Error("Local DATABASE_URL and REVIEW_PASSWORD (12+ characters) are required");
}
const sql = postgres(url, { max: 1 });
try {
  for (const [username, role] of [
    ["review.admin", "ผู้ดูแลระบบ"], ["review.officer", "เจ้าหน้าที่"],
    ["review.teacher", "อาจารย์"], ["review.print", "หน่วยโสต"],
  ]) {
    const existing = await sql`select id from better_auth.users where username=${username}`;
    if (existing.length) continue;
    const id = randomUUID();
    const hash = await hashPassword(password);
    await sql.begin(async tx => {
      await tx`insert into better_auth.users (id,name,email,email_verified,username,display_username,role,must_change_password)
        values (${id},${`ทดสอบ ${role}`},${`${username}@example.local`},true,${username},${username},${role},false)`;
      await tx`insert into better_auth.accounts (id,issuer,account_id,provider_id,user_id,password)
        values (${randomUUID()},'local:credential',${id},'credential',${id},${hash})`;
    });
    console.log(`Created ${username}`);
  }
} finally { await sql.end(); }
