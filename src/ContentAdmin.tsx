import { useEffect, useState } from "react";
import { Content, ContentQuestion, Draft, learningAPI } from "./learning";

const question = (): ContentQuestion => ({
  type: "short_answer",
  prompt: "",
  options: [],
  answers: [],
  explanation: "",
});
const blank = (): Content => ({
  title: "Untitled practice",
  description: "",
  skill: "reading",
  purpose: "practice",
  duration_seconds: 600,
  instructions: "",
  sections: [
    {
      title: "Section 1",
      passage: "",
      audio_url: "",
      instructions: "",
      questions: [question()],
    },
  ],
  bands: [],
});
export default function ContentAdmin() {
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [id, setID] = useState<string>(),
    [data, setData] = useState<Content>(blank),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    try {
      setDrafts(await learningAPI.drafts());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cannot load content");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function section(index: number, key: string, value: unknown) {
    setData({
      ...data,
      sections: data.sections.map((s, i) =>
        i === index ? { ...s, [key]: value } : s,
      ),
    });
  }
  function editQuestion(s: number, q: number, key: string, value: unknown) {
    section(
      s,
      "questions",
      data.sections[s].questions.map((v, i) =>
        i === q ? { ...v, [key]: value } : v,
      ),
    );
  }
  async function save(publish = false) {
    setBusy(true);
    setMessage("");
    try {
      const saved = await learningAPI.saveDraft(id, data);
      setID(saved.id);
      if (publish) {
        await learningAPI.publish(saved.id);
        setMessage(
          "Published. Students can now open this content. Earlier attempts keep their original version.",
        );
      } else {
        setMessage("Draft saved.");
      }
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="content page-content content-admin">
      <header className="page-header">
        <p className="eyebrow">Administrator workspace</p>
        <h1>Content studio</h1>
        <p>
          Create original materials, preview every question, then publish.
          Corrections produce a new version and preserve existing attempts.
        </p>
      </header>
      <div className="admin-toolbar">
        <select
          aria-label="Choose draft"
          value={id || ""}
          onChange={(e) => {
            const d = drafts.find((v) => v.id === e.target.value);
            setID(d?.id);
            setData(d?.data || blank());
            setPreview(false);
            setMessage("");
          }}
        >
          <option value="">New content</option>
          {drafts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.data.title}
              {d.exam_id ? " · published" : " · draft"}
            </option>
          ))}
        </select>
        <button
          className="secondary-action"
          onClick={() => {
            setID(undefined);
            setData(blank());
            setPreview(false);
          }}
        >
          New draft
        </button>
        <button
          className="secondary-action"
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Edit content" : "Preview"}
        </button>
        <button
          className="secondary-action"
          disabled={busy}
          onClick={() => void save()}
        >
          Save draft
        </button>
        <button
          className="primary-action"
          disabled={busy}
          onClick={() => void save(true)}
        >
          {busy ? "Working…" : "Publish version"}
        </button>
      </div>
      {message && (
        <p role="status" className="instruction-box">
          {message}
        </p>
      )}
      {preview ? (
        <section className="content-preview">
          <h2>{data.title}</h2>
          <p>{data.description}</p>
          <p>{data.instructions}</p>
          {data.sections.map((s, i) => (
            <article key={i}>
              <h2>{s.title}</h2>
              {s.audio_url && <audio controls src={s.audio_url} />}
              <p className="passage-preview">{s.passage}</p>
              {s.questions.map((q, j) => (
                <div className="preview-question" key={j}>
                  <h3>
                    {j + 1}. {q.prompt}
                  </h3>
                  {q.options.map((o, k) => (
                    <p key={k}>
                      {String.fromCharCode(65 + k)}. {o}
                    </p>
                  ))}
                  <details>
                    <summary>Answer and explanation</summary>
                    <p>{q.answers.join(" / ")}</p>
                    <p>{q.explanation}</p>
                  </details>
                </div>
              ))}
            </article>
          ))}
        </section>
      ) : (
        <div className="admin-form">
          <label>
            Title
            <input
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              value={data.description}
              onChange={(e) =>
                setData({ ...data, description: e.target.value })
              }
            />
          </label>
          <div className="admin-columns">
            <label>
              Skill
              <select
                value={data.skill}
                onChange={(e) => setData({ ...data, skill: e.target.value })}
              >
                <option value="reading">Reading</option>
                <option value="listening">Listening</option>
              </select>
            </label>
            <label>
              Format
              <select
                value={data.purpose}
                onChange={(e) => setData({ ...data, purpose: e.target.value })}
              >
                <option value="practice">Untimed practice</option>
                <option value="mock">Timed mock</option>
              </select>
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min="1"
                max="240"
                value={data.duration_seconds / 60}
                onChange={(e) =>
                  setData({
                    ...data,
                    duration_seconds: Number(e.target.value) * 60,
                  })
                }
              />
            </label>
          </div>
          <label>
            Instructions
            <textarea
              value={data.instructions}
              onChange={(e) =>
                setData({ ...data, instructions: e.target.value })
              }
            />
          </label>
          {data.sections.map((s, i) => (
            <fieldset key={i}>
              <legend>Section {i + 1}</legend>
              <label>
                Section title
                <input
                  value={s.title}
                  onChange={(e) => section(i, "title", e.target.value)}
                />
              </label>
              <label>
                Section instructions
                <input
                  value={s.instructions}
                  onChange={(e) => section(i, "instructions", e.target.value)}
                />
              </label>
              <label>
                {data.skill === "listening"
                  ? "Transcript (for editors)"
                  : "Reading passage"}
                <textarea
                  rows={8}
                  value={s.passage}
                  onChange={(e) => section(i, "passage", e.target.value)}
                />
              </label>
              {data.skill === "listening" && (
                <label>
                  Recording URL (HTTPS)
                  <input
                    type="url"
                    value={s.audio_url}
                    onChange={(e) => section(i, "audio_url", e.target.value)}
                  />
                  <small>
                    Use an original or licensed audio file. Test playback in
                    Preview before publishing.
                  </small>
                </label>
              )}
              {s.questions.map((q, j) => (
                <fieldset key={j}>
                  <legend>Question {j + 1}</legend>
                  <label>
                    Type
                    <select
                      value={q.type}
                      onChange={(e) =>
                        editQuestion(i, j, "type", e.target.value)
                      }
                    >
                      {[
                        "short_answer",
                        "multiple_choice",
                        "multiple_select",
                        "true_false_not_given",
                        "sentence_completion",
                        "matching",
                      ].map((t) => (
                        <option key={t} value={t}>
                          {t.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prompt
                    <textarea
                      value={q.prompt}
                      onChange={(e) =>
                        editQuestion(i, j, "prompt", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Options (one per line; leave empty for text answers)
                    <textarea
                      value={q.options.join("\n")}
                      onChange={(e) =>
                        editQuestion(
                          i,
                          j,
                          "options",
                          e.target.value.split("\n"),
                        )
                      }
                    />
                  </label>
                  <label>
                    Accepted answers (one per line)
                    <textarea
                      value={q.answers.join("\n")}
                      onChange={(e) =>
                        editQuestion(
                          i,
                          j,
                          "answers",
                          e.target.value.split("\n"),
                        )
                      }
                    />
                  </label>
                  <label>
                    Explanation
                    <textarea
                      value={q.explanation}
                      onChange={(e) =>
                        editQuestion(i, j, "explanation", e.target.value)
                      }
                    />
                  </label>
                  <button
                    className="secondary-action"
                    onClick={() =>
                      section(
                        i,
                        "questions",
                        s.questions.filter((_, k) => j !== k),
                      )
                    }
                  >
                    Remove question
                  </button>
                </fieldset>
              ))}
              <button
                className="secondary-action"
                onClick={() =>
                  section(i, "questions", [...s.questions, question()])
                }
              >
                Add question
              </button>
            </fieldset>
          ))}
          <button
            className="secondary-action"
            onClick={() =>
              setData({
                ...data,
                sections: [
                  ...data.sections,
                  {
                    title: `Section ${data.sections.length + 1}`,
                    instructions: "",
                    passage: "",
                    audio_url: "",
                    questions: [question()],
                  },
                ],
              })
            }
          >
            Add section
          </button>
          {data.purpose === "mock" && (
            <fieldset>
              <legend>Band conversion</legend>
              <p>
                Enter the minimum correct answers for each band. Include a
                threshold of zero. Short mocks provide indicative estimates
                only.
              </p>
              {data.bands.map((b, i) => (
                <div className="admin-columns" key={i}>
                  <label>
                    Minimum correct
                    <input
                      type="number"
                      min="0"
                      value={b.minimum}
                      onChange={(e) =>
                        setData({
                          ...data,
                          bands: data.bands.map((v, j) =>
                            i === j
                              ? { ...v, minimum: Number(e.target.value) }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Band
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="9"
                      value={b.band}
                      onChange={(e) =>
                        setData({
                          ...data,
                          bands: data.bands.map((v, j) =>
                            i === j
                              ? { ...v, band: Number(e.target.value) }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    onClick={() =>
                      setData({
                        ...data,
                        bands: data.bands.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setData({
                    ...data,
                    bands: [...data.bands, { minimum: 0, band: 0 }],
                  })
                }
              >
                Add band threshold
              </button>
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
