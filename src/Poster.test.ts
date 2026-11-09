import { describe, expect, it } from "vitest";
import { posterTitle } from "./Poster";

describe("posterTitle", () => {
  it("keeps book and test number from Cambridge titles", () => {
    expect(posterTitle("Cambridge IELTS 4 · Reading Test 4")).toBe("Cam 4 Test 4");
    expect(posterTitle("Cambridge 17 Listening Test 2")).toBe("Cam 17 Test 2");
  });
  it("keeps the numbered part of other titles", () => {
    expect(posterTitle("Academic Reading Test 1")).toBe("Test 1");
  });
  it("drops words the poster colour already says and falls back to the title", () => {
    expect(posterTitle("Academic Reading · Urban Gardens")).toBe("Urban Gardens");
    expect(posterTitle("Reading")).toBe("Reading");
  });
});
