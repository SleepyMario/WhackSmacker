import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  authenticateUser,
  createDatabasePool,
  createSession,
  createUser,
  databaseConfig,
  databaseMigrationStatus,
  hashPassword,
  migrateDatabase,
  normalizeUsername,
  recordUserReview,
  redactDatabaseError,
  resolveSession,
  revokeSession,
  selectedPackages,
  selectPackage,
  unselectPackage,
  updateUserSettings,
  userSettings,
  userHasSelectedPackage,
  verifyPassword
} from "../dist/packages/storage/postgres.js";
import { startWebServer } from "../dist/apps/web/server.js";

test("username normalization and versioned scrypt passwords are deterministic and safe", async () => {
  assert.equal(normalizeUsername("  Alice.Example  "), "alice.example");
  assert.throws(() => normalizeUsername("bad name"), /safe letters/);
  assert.throws(() => normalizeUsername("bad\u0000name"), /safe letters/);
  const encoded = await hashPassword("correct horse battery staple");
  assert.match(encoded, /^wsm-scrypt-v1\$N=16384,r=8,p=1,l=32\$/);
  assert.equal(await verifyPassword("correct horse battery staple", encoded), true);
  assert.equal(await verifyPassword("incorrect password", encoded), false);
  assert.doesNotMatch(encoded, /correct horse/);
  assert.equal(redactDatabaseError(new Error("connect postgresql://secret-user:secret-pass@db.example/test failed")),"connect postgresql://[redacted]@db.example/test failed");
});

test("real PostgreSQL migrations, sessions, and two-user state are isolated", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const root = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await root.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await root.end();
  const config = databaseConfig({ DATABASE_URL: process.env.TEST_DATABASE_URL });
  assert.ok(config);
  const pool = createDatabasePool(config);
  let server;
  let restarted;
  try {
    const concurrent=await Promise.all([migrateDatabase(pool),migrateDatabase(pool)]);
    assert.deepEqual(concurrent.flat(), ["001_public_alpha_users.sql", "002_user_package_indexes.sql", "003_state_constraints.sql"]);
    assert.ok((await databaseMigrationStatus(pool)).every(x => x.applied));
    assert.deepEqual(await migrateDatabase(pool), []);

    const a = await createUser(pool, "AccountA", "alpha password is safely long", "admin");
    const b = await createUser(pool, "AccountB", "bravo password is safely long", "user");
    assert.equal((await authenticateUser(pool, "accounta", "alpha password is safely long"))?.id, a.id);
    assert.equal(await authenticateUser(pool, "accounta", "wrong password"), undefined);

    const session = await createSession(pool, a, 3600, "127.0.0.1", "test");
    assert.equal((await resolveSession(pool, session.token))?.id, a.id);
    const stored = await pool.query("SELECT token_hash,csrf_token_hash FROM sessions WHERE user_id=$1", [a.id]);
    assert.notEqual(stored.rows[0].token_hash, session.token);
    assert.notEqual(stored.rows[0].csrf_token_hash, session.csrf);
    await revokeSession(pool, session.token);
    assert.equal(await resolveSession(pool, session.token), undefined);

    await updateUserSettings(pool, a.id, "zh-Hant-TW", "dark");
    await updateUserSettings(pool, b.id, "en-US", "light");
    assert.deepEqual(await userSettings(pool, a.id), { locale: "zh-Hant-TW", theme: "dark" });
    assert.deepEqual(await userSettings(pool, b.id), { locale: "en-US", theme: "light" });

    await selectPackage(pool, a.id, "com.example.curriculum", "1.0.0");
    await selectPackage(pool, b.id, "com.example.curriculum", "2.0.0");
    assert.equal(await userHasSelectedPackage(pool,a.id,"com.example.curriculum","1.0.0"),true);
    assert.equal(await userHasSelectedPackage(pool,a.id,"com.example.curriculum","2.0.0"),false);
    assert.equal(await userHasSelectedPackage(pool,b.id,"com.example.curriculum","1.0.0"),false);
    assert.equal(await userHasSelectedPackage(pool,b.id,"com.example.curriculum","2.0.0"),true);
    assert.equal((await selectedPackages(pool, a.id)).length, 1);
    assert.equal((await selectedPackages(pool, b.id)).length, 1);
    await unselectPackage(pool, a.id, "com.example.curriculum", "1.0.0", true);
    assert.equal((await selectedPackages(pool, a.id)).length, 0);
    assert.equal((await selectedPackages(pool, b.id)).length, 1);
    await selectPackage(pool, a.id, "com.example.curriculum", "1.0.0");

    const identity = { packageId: "com.example.curriculum", packageVersion: "1.0.0", sourcePath: "review/cards.tsv", itemId: "same-card" };
    await recordUserReview(pool, a.id, identity, "good", "2026-07-11T00:00:00Z");
    assert.equal(Number((await pool.query("SELECT count(*) count FROM review_history WHERE user_id=$1", [a.id])).rows[0].count), 1);
    assert.equal(Number((await pool.query("SELECT count(*) count FROM review_history WHERE user_id=$1", [b.id])).rows[0].count), 0);

    server = await startWebServer({ host: "127.0.0.1", port: 0, databaseUrl: process.env.TEST_DATABASE_URL, secureCookies:true });
    const address = server.address(); assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const login = async (username, password) => {
      const response = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
      const cookies = response.headers.getSetCookie().map(x => x.split(";", 1)[0]).join("; ");
      return { response, cookies, csrf: /(?:^|; )wsm_csrf=([^;]+)/.exec(cookies)?.[1] };
    };
    const loginA = await login("AccountA", "alpha password is safely long");
    const loginB = await login("AccountB", "bravo password is safely long");
    assert.equal(loginA.response.status, 200); assert.equal(loginB.response.status, 200);
    assert.match(loginA.response.headers.getSetCookie().join(" "), /wsm_session=.*HttpOnly.*SameSite=Strict.*Secure/);
    assert.equal((await login("AccountA", "wrong password")).response.status, 401);
    assert.equal((await login("AccountA", "wrong password")).response.status, 429);
    const readItems=(auth,version)=>fetch(`${base}/api/review-items?packageId=com.example.curriculum&version=${encodeURIComponent(version)}`,{headers:{cookie:auth.cookies}});
    const itemStatuses=[(await readItems(loginA,"1.0.0")).status,(await readItems(loginA,"2.0.0")).status,(await readItems(loginB,"2.0.0")).status,(await readItems(loginB,"1.0.0")).status];
    assert.deepEqual(itemStatuses,[200,403,200,403]);
    assert.equal((await fetch(`${base}/api/review-items?packageId=com.example.curriculum`,{headers:{cookie:loginA.cookies}})).status,400);
    assert.equal((await readItems(loginA,"9.9.9")).status,403);
    const unavailableA=await (await fetch(`${base}/api/curricula`,{headers:{cookie:loginA.cookies}})).json();
    const unavailableB=await (await fetch(`${base}/api/curricula`,{headers:{cookie:loginB.cookies}})).json();
    assert.ok(unavailableA.unavailable.some(x=>x.packageId==="com.example.curriculum"&&x.packageVersion==="1.0.0"));
    assert.ok(unavailableB.unavailable.some(x=>x.packageId==="com.example.curriculum"&&x.packageVersion==="2.0.0"));
    const mutate = (path, auth, body) => fetch(`${base}${path}`, { method: "PUT", headers: { cookie: auth.cookies, origin: base, "x-csrf-token": auth.csrf, "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await mutate("/api/settings", loginA, { locale: "zh-Hant-TW", user_id: b.id })).status, 200);
    assert.equal((await mutate("/api/settings", loginB, { locale: "en-US" })).status, 200);
    assert.equal((await fetch(`${base}/api/settings`, { method: "PUT", headers: { cookie: loginA.cookies, origin: base, "content-type": "application/json" }, body: JSON.stringify({ locale: "en-US" }) })).status, 403);
    assert.equal((await userSettings(pool, a.id)).locale, "zh-TW");
    assert.equal((await userSettings(pool, b.id)).locale, "en");
    const logoutA=await fetch(`${base}/api/logout`,{method:"POST",headers:{cookie:loginA.cookies,origin:base,"x-csrf-token":loginA.csrf}});
    assert.equal(logoutA.status,200);
    assert.equal((await fetch(`${base}/api/state`,{headers:{cookie:loginA.cookies}})).status,401);
    await pool.query("UPDATE users SET enabled=false WHERE id=$1",[b.id]);
    assert.equal((await fetch(`${base}/api/state`,{headers:{cookie:loginB.cookies}})).status,401);
    assert.equal((await login("AccountB", "bravo password is safely long")).response.status,401);
    await pool.query("UPDATE users SET enabled=true WHERE id=$1",[b.id]);
    await new Promise(resolve => server.close(resolve));

    restarted = await startWebServer({ host: "127.0.0.1", port: 0, databaseUrl: process.env.TEST_DATABASE_URL });
    const restartedAddress = restarted.address(); assert.ok(restartedAddress && typeof restartedAddress === "object");
    assert.equal((await fetch(`http://127.0.0.1:${restartedAddress.port}/api/state`, { headers: { cookie: loginB.cookies } })).status, 200);
    await new Promise(resolve => restarted.close(resolve));
  } finally {
    for (const running of [server,restarted]) {
      if (!running?.listening) continue;
      running.closeAllConnections();
      await new Promise(resolve => running.close(resolve));
    }
    await pool.end();
  }
});
