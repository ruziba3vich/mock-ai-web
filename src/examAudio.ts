import type { Exam } from "./exams";

// A listening test's recordings are copied into the browser before the test starts,
// so a connection that drops during the test cannot stop the recording.
const STORE = "exam-audio";
const recordings = (exam: Exam) => exam.sections.flatMap(section => section.audio_url ? [section.audio_url] : []);
const open = () => typeof caches === "undefined" ? undefined : caches.open(STORE).catch(() => undefined); // no storage in some private windows

/** Downloads every recording of the exam. Throws when one of our own recordings cannot be downloaded. */
export async function downloadAudio(exam: Exam) {
  const wanted = recordings(exam).map(url => new URL(url, location.href));
  const store = wanted.length ? await open() : undefined;
  if (!store) return;
  // Only the test about to be sat is kept.
  for (const old of await store.keys()) if (!wanted.some(url => url.href === old.url)) await store.delete(old);
  for (const url of wanted) {
    if (await store.match(url)) continue;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      await store.put(url, response).catch(() => undefined); // storage full: the recording is streamed instead
    } catch {
      // shortcut: a recording on another site that forbids downloads is streamed as before, upgrade by hosting every recording as managed audio.
      if (url.origin === location.origin) throw new Error("The recording could not be downloaded. Check your internet connection and try again.");
    }
  }
}

/** Each recording's address to play from: the downloaded copy when there is one, otherwise its own address. */
export async function localAudio(exam: Exam) {
  const store = await open(), out: Record<string, string> = {};
  for (const url of recordings(exam)) {
    const copy = await store?.match(url);
    out[url] = copy ? URL.createObjectURL(await copy.blob()) : url;
  }
  return out;
}
