import { expect, it } from "vitest";

/**
 * The retired hosts and where they now point. Kept in step with main.tsx by
 * this test, because getting it wrong either strands people on a half-working
 * app or sends them into a redirect loop.
 */
const MOVED: Record<string, string> = {
  "mockai.admin.chessinsight.uz": "panel.mock-ai.uz",
  "mock.web.chessinsight.uz": "mock-ai.uz",
};

it("forwards every retired host to a different live host", () => {
  for (const [from, to] of Object.entries(MOVED)) {
    expect(from).not.toBe(to);
    // A target that is itself retired would loop forever.
    expect(MOVED[to]).toBeUndefined();
  }
});

it("never forwards a host that is still in service", () => {
  for (const live of ["mock-ai.uz", "panel.mock-ai.uz", "www.mock-ai.uz", "localhost", "127.0.0.1"]) {
    expect(MOVED[live]).toBeUndefined();
  }
});

it("keeps the admin panel on the centre host and the staff host only", async () => {
  const source = await import("node:fs").then(fs => fs.readFileSync("src/main.tsx", "utf8"));
  // The old admin host must not also be treated as an admin host, or the
  // redirect races the panel it is trying to replace.
  const admins = source.match(/ADMIN_HOSTS = new Set\(\[(.*?)\]\)/s)?.[1] ?? "";
  expect(admins).toContain("panel.mock-ai.uz");
  expect(admins).toContain("main.mock-ai.uz");
  expect(admins).not.toContain("chessinsight");
  // And main.tsx must agree with the table above.
  for (const from of Object.keys(MOVED)) expect(source).toContain(from);
});
