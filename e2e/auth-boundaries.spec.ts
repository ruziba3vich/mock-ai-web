import {test,expect} from "@playwright/test";

test.beforeEach(()=>test.skip(!process.env.AUTH_E2E,"Opt-in: target must have Google and Telegram configured"));

test("Google starts a protected OAuth flow and rejects an unsolicited callback",async({request,baseURL})=>{
 const response=await request.get("/api/v1/auth/google/start",{maxRedirects:0});
 expect([302,303,307]).toContain(response.status());
 const location=new URL(response.headers().location);
 expect(location.hostname).toBe("accounts.google.com");
 expect(location.searchParams.get("state")?.length).toBeGreaterThan(15);
 expect(location.searchParams.get("redirect_uri")).toBe(`${baseURL}/api/v1/auth/google/callback`);
 expect(response.headers()["set-cookie"]).toContain("HttpOnly");
 const invalid=await request.get("/api/v1/auth/google/callback?code=fake&state=invalid",{maxRedirects:0});
 expect([302,303,307]).toContain(invalid.status());
 expect(invalid.headers().location).toContain("google_flow_failed");
 expect((await request.get("/api/v1/me")).status()).toBe(401);
});

test("Telegram rejects forged init data without creating a session",async({page,baseURL})=>{
 await page.addInitScript(()=>{
  (window as any).Telegram={WebApp:{initData:'auth_date=1&user=%7B%22id%22%3A1%7D&hash=invalid',ready(){},expand(){}}};
 });
 await page.goto("/");
 const response=await page.request.post("/api/v1/auth/telegram",{headers:{Origin:new URL(baseURL!).origin},data:{init_data:'auth_date=1&user=%7B%22id%22%3A1%7D&hash=invalid'}});
 expect(response.status()).toBe(401);
 expect((await page.request.get("/api/v1/me")).status()).toBe(401);
});
