import { useEffect, useMemo, useState } from "react";
import { AdminStudent, Content, ContentImport, ContentQuestion, Draft, learningAPI } from "./learning";

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
      source_image_urls: [],
      instructions: "",
      questions: [question()],
    },
  ],
  bands: [],
  access_scope: "public",
  owner_user_id: "",
});
const studentLabel = (student: AdminStudent) => `${student.display_name}${student.telegram_username ? ` · @${student.telegram_username}` : student.email ? ` · ${student.email}` : student.telegram_id ? ` · Telegram ${student.telegram_id}` : ""}`;
export default function ContentAdmin() {
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [id, setID] = useState<string>(),
    [data, setData] = useState<Content>(blank),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [imports,setImports]=useState<ContentImport[]>([]),
    [students,setStudents]=useState<AdminStudent[]>([]),
    [pdf,setPDF]=useState<File|null>(null),
    [importSkills,setImportSkills]=useState("all"),
    [importAccess,setImportAccess]=useState<"public"|"private">("public"),
    [importOwner,setImportOwner]=useState(""),
    [search,setSearch]=useState(""),
    [skillFilter,setSkillFilter]=useState("all"),
    [uploadingSection,setUploadingSection]=useState<number|null>(null),
    [rights,setRights]=useState(false);
  async function load() {
    try {
      const [nextDrafts,nextImports,nextStudents]=await Promise.all([learningAPI.drafts(),learningAPI.imports(),learningAPI.students()]);setDrafts(nextDrafts);setImports(nextImports);setStudents(nextStudents);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cannot load content");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(()=>{if(!imports.some(v=>v.status==="queued"||v.status==="processing"))return;const timer=window.setInterval(()=>void load(),3000);return()=>window.clearInterval(timer)},[imports]);
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
  async function importPDF(){if(!pdf||!rights||(importAccess==="private"&&!importOwner))return;setBusy(true);setMessage("");try{await learningAPI.importPDF(pdf,importSkills,importAccess,importAccess==="private"?importOwner:"");setPDF(null);setRights(false);setMessage("PDF uploaded. Extraction is running in the background; imported tests will appear as drafts.");await load()}catch(e){setMessage(e instanceof Error?e.message:"Import failed")}finally{setBusy(false)}}
  async function uploadAudio(index:number,file:File){setUploadingSection(index);setMessage("");try{const uploaded=await learningAPI.uploadMedia(file,data.access_scope==="private"?data.owner_user_id:"");section(index,"audio_url",uploaded.url);setMessage(`${file.name} uploaded. Save or publish the exam to apply it.`)}catch(e){setMessage(e instanceof Error?e.message:"Audio upload failed")}finally{setUploadingSection(null)}}
  function adminMediaURL(url:string){return url.startsWith("/api/v1/private-media/")?url.replace("/api/v1/private-media/","/api/v1/admin/private-media/"):url}
  const audienceIncomplete=data.access_scope==="private"&&!data.owner_user_id;
  const visibleDrafts=useMemo(()=>drafts.filter(draft=>(skillFilter==="all"||draft.data.skill===skillFilter)&&draft.data.title.toLowerCase().includes(search.trim().toLowerCase())),[drafts,search,skillFilter]);
  function scrollToEditor(){window.setTimeout(()=>{const editor=document.querySelector("#exam-editor");if(editor&&"scrollIntoView" in editor)editor.scrollIntoView({behavior:"smooth",block:"start"})},0)}
  function openDraft(draft:Draft){setID(draft.id);setData(draft.data);setPreview(false);setMessage("");scrollToEditor()}
  function newDraft(){setID(undefined);setData(blank());setPreview(false);setMessage("");scrollToEditor()}
  return (
    <div className="content page-content content-admin">
      <section className="exam-library" aria-labelledby="exam-library-title">
        <header><div><p className="eyebrow">Reading and Listening</p><h2 id="exam-library-title">Exam library</h2><p>Select any exam to edit its questions, pages, recordings, scoring, or audience.</p></div><button className="primary-action" onClick={newDraft}>Create exam</button></header>
        <div className="exam-library-controls"><label>Search exams<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title"/></label><label>Skill<select value={skillFilter} onChange={e=>setSkillFilter(e.target.value)}><option value="all">All skills</option><option value="reading">Reading</option><option value="listening">Listening</option></select></label></div>
        <div className="exam-library-table" role="table" aria-label="Reading and Listening content">
          <div className="exam-library-head" role="row"><span>Exam</span><span>Skill</span><span>Status</span><span>Audience</span><span>Questions</span><span/></div>
          {visibleDrafts.map(draft=>{const count=draft.data.sections.reduce((total,section)=>total+section.questions.length,0);const owner=students.find(v=>v.id===draft.data.owner_user_id);return <button type="button" className={id===draft.id?"exam-library-row selected":"exam-library-row"} aria-label={`Edit ${draft.data.title}`} key={draft.id} onClick={()=>openDraft(draft)}><strong>{draft.data.title}</strong><span className="exam-skill">{draft.data.skill}</span><span>{draft.exam_id?"Published":"Draft"}</span><span>{draft.data.access_scope==="private"?(owner?.display_name||"One student"):"All students"}</span><span>{count}</span><span className="exam-library-action">Edit content →</span></button>})}
          {!visibleDrafts.length&&<p className="exam-library-empty">{drafts.length?"No exams match these filters.":"No exam content yet. Create an exam or import a PDF book."}</p>}
        </div>
      </section>
      <details className="admin-import-disclosure">
        <summary><span><strong>Import a PDF book</strong><small>Create editable Reading and Listening drafts from a permitted source.</small></span><span>Open importer</span></summary>
      <section className="admin-import">
        <div><p className="eyebrow">PDF importer</p><h2>Turn a test book into editable drafts</h2><p>Upload one searchable or scanned PDF. The importer detects complete tests, copies their passages, questions and answer keys, then leaves everything unpublished for review.</p></div>
        <div className="admin-import-controls">
          <label>PDF book<input aria-label="PDF book" type="file" accept="application/pdf,.pdf" onChange={e=>setPDF(e.target.files?.[0]||null)}/><small>PDF only · maximum 50 MB · up to 1,000 pages</small></label>
          <label>Import<select aria-label="Skills to import" value={importSkills} onChange={e=>setImportSkills(e.target.value)}><option value="all">Reading and Listening</option><option value="reading">Reading only</option><option value="listening">Listening only</option></select></label>
          <label>Audience<select aria-label="Imported content audience" value={importAccess} onChange={e=>{const value=e.target.value as "public"|"private";setImportAccess(value);if(value==="public")setImportOwner("")}}><option value="public">All students</option><option value="private">One student</option></select></label>
          {importAccess==="private"&&<label>Student<select aria-label="Imported content student" required value={importOwner} onChange={e=>setImportOwner(e.target.value)}><option value="">Choose a student</option>{students.map(student=><option value={student.id} key={student.id}>{studentLabel(student)}</option>)}</select></label>}
          <label className="admin-rights"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/><span>I confirm that MockAI is allowed to reproduce and deliver this material to students.</span></label>
          <button className="primary-action" disabled={busy||!pdf||!rights||(importAccess==="private"&&!importOwner)||!!pdf&&pdf.size>50*1024*1024} onClick={()=>void importPDF()}>{busy?"Uploading…":"Upload and create drafts"}</button>
        </div>
        {!!imports.length&&<div className="admin-import-jobs" aria-label="PDF imports">{imports.map(item=><article key={item.id}><div><strong>{item.filename}</strong><span className={`status-chip status-${item.status}`}>{item.status}</span></div><p>{item.status==="processing"?`Extracting test ${item.progress_current+1}${item.progress_total?` of ${item.progress_total}`:"…"}`:item.status==="completed"?`${item.draft_ids.length} editable drafts created`:item.status==="queued"?"Waiting for extraction":item.error_message}</p>{item.warnings.map((warning,i)=><small key={i}>• {warning}</small>)}{!!item.draft_ids.length&&<div className="import-draft-links">{item.draft_ids.map((draftID,i)=><button key={draftID} onClick={()=>{const draft=drafts.find(v=>v.id===draftID);if(draft){setID(draft.id);setData(draft.data);setPreview(true);window.scrollTo({top:document.querySelector('.admin-toolbar')?.getBoundingClientRect().top||0,behavior:'smooth'})}}}>Open draft {i+1}</button>)}</div>}</article>)}</div>}
      </section>
      </details>
      <div className="admin-toolbar" id="exam-editor">
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
              {d.exam_id ? " · published" : " · draft"} · {d.data.access_scope === "private" ? "private" : "all students"}
            </option>
          ))}
        </select>
        <button
          className="secondary-action"
          onClick={() => {
            newDraft();
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
          disabled={busy||audienceIncomplete}
          onClick={() => void save()}
        >
          Save draft
        </button>
        <button
          className="primary-action"
          disabled={busy||audienceIncomplete}
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
          <p className="content-audience"><strong>Audience:</strong> {data.access_scope === "private" ? studentLabel(students.find(v=>v.id===data.owner_user_id) || {id:data.owner_user_id,display_name:"Selected student"}) : "All students"}</p>
          {data.sections.map((s, i) => (
            <article key={i}>
              <h2>{s.title}</h2>
              {s.audio_url && <audio controls src={adminMediaURL(s.audio_url)} />}
              {!!s.source_image_urls?.length && <div className="source-pages">{s.source_image_urls.map((url, page) => <img key={url} src={url} alt={`${s.title}, source page ${page + 1}`} />)}</div>}
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
          <section className="access-editor" aria-labelledby="access-title">
            <div><p className="eyebrow">Permissions</p><h3 id="access-title">Who can access this exam?</h3><p>Choose the audience for this content. This setting is available on every exam.</p></div>
            <div className="access-options">
              <label className={data.access_scope==="public"?"selected":""}><input type="radio" name="content-access" value="public" checked={data.access_scope==="public"} onChange={()=>setData({...data,access_scope:"public",owner_user_id:""})}/><span><strong>Public</strong><small>Every signed-in student can discover and take this exam.</small></span></label>
              <label className={data.access_scope==="private"?"selected":""}><input type="radio" name="content-access" value="private" checked={data.access_scope==="private"} onChange={()=>setData({...data,access_scope:"private"})}/><span><strong>Restricted</strong><small>Only one selected student can discover and take it.</small></span></label>
            </div>
            {data.access_scope==="private"&&<label className="audience-student">Student with access<select aria-label="Private student" required value={data.owner_user_id} onChange={e=>setData({...data,owner_user_id:e.target.value})}><option value="">Choose a student</option>{students.map(student=><option value={student.id} key={student.id}>{studentLabel(student)}</option>)}</select></label>}
            <p className="access-publish-note"><strong>{data.access_scope==="public"?"Public access selected.":"Restricted access selected."}</strong> Click <b>Publish version</b> above to apply this permission to the live exam.</p>
          </section>
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
                <div className="admin-audio-editor">
                  <label>
                    Listening recording
                    <input aria-label={`Section ${i+1} audio file`} type="file" accept="audio/mpeg,.mp3" disabled={uploadingSection!==null} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadAudio(i,file)}} />
                    <small>{uploadingSection===i?"Uploading recording…":"Upload an MP3 up to 25 MB. It remains private until this exam is published to its selected audience."}</small>
                  </label>
                  <label>
                    Or use an HTTPS recording URL
                    <input
                      type="url"
                      value={s.audio_url}
                      onChange={(e) => section(i, "audio_url", e.target.value)}
                    />
                  </label>
                  {s.audio_url&&<div className="admin-audio-preview"><audio controls src={adminMediaURL(s.audio_url)}/><button type="button" className="danger-link" onClick={()=>section(i,"audio_url","")}>Remove recording</button></div>}
                </div>
              )}
              <label>
                Source page image URLs (one per line)
                <textarea
                  rows={3}
                  value={(s.source_image_urls || []).join("\n")}
                  onChange={(e) => section(i, "source_image_urls", e.target.value.split("\n").map(v => v.trim()).filter(Boolean))}
                />
                <small>Private page scans used for maps, diagrams, tables, and original question layout.</small>
              </label>
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
                        "yes_no_not_given",
                        "sentence_completion",
                        "summary_completion",
                        "matching",
                        "map_labeling",
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
                    source_image_urls: [],
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
