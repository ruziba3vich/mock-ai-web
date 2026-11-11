import { afterEach, expect, it, vi } from "vitest";
import { learningAPI, MEDIA_PART } from "./learning";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

// A whole listening test in one MP3 is larger than one request may be.
it("sends a long recording in parts and repeats a part that failed", async () => {
  vi.useFakeTimers();
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const fetcher = vi.fn<(path: string, init: RequestInit) => Promise<Response>>()
    .mockResolvedValueOnce(ok({ id: "m1", url: "/api/v1/private-media/m1" }))
    .mockRejectedValueOnce(new TypeError("connection dropped"))
    .mockImplementation(async () => ok({ size: 0 }));
  vi.stubGlobal("fetch", fetcher);
  const file = new File([new Uint8Array(2 * MEDIA_PART + 5)], "whole-test.mp3", { type: "audio/mpeg" });
  const progress: number[] = [];

  const upload = learningAPI.uploadMedia(file, "", sent => progress.push(sent));
  await vi.runAllTimersAsync();
  await expect(upload).resolves.toEqual({ id: "m1", url: "/api/v1/private-media/m1" });

  const first = fetcher.mock.calls[0][1].body as FormData;
  expect((first.get("file") as File).size).toBe(MEDIA_PART);
  expect((first.get("file") as File).name).toBe("whole-test.mp3");
  expect(first.get("partial")).toBe("1");
  expect(fetcher.mock.calls.slice(1).map(([path, init]) => [init.method, path, (init.body as Blob).size])).toEqual([
    ["PATCH", `/api/v1/admin/private-media/m1?offset=${MEDIA_PART}`, MEDIA_PART],
    ["PATCH", `/api/v1/admin/private-media/m1?offset=${MEDIA_PART}`, MEDIA_PART],
    ["PATCH", `/api/v1/admin/private-media/m1?offset=${2 * MEDIA_PART}`, 5],
  ]);
  expect(progress).toEqual([MEDIA_PART, 2 * MEDIA_PART]);
});

it("sends a short recording or a page scan in one request", async () => {
  const fetcher = vi.fn(async (_path: string, _init: RequestInit) => new Response(JSON.stringify({ id: "m2", url: "/api/v1/private-media/m2" }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  await learningAPI.uploadMedia(new File([new Uint8Array(MEDIA_PART + 1)], "page.png", { type: "image/png" }), "student-1");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((fetcher.mock.calls[0][1].body as FormData).get("partial")).toBeNull();
});
