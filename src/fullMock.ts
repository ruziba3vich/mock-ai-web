export type FullMockStage = "overview"|"listening"|"break_reading"|"reading"|"break_writing"|"writing"|"break_speaking"|"speaking"|"complete";
export type FullMockSession = {
  id:string; started_at:string; stage:FullMockStage;
  listening_exam_id:string; reading_exam_id:string;
  listening_band?:number; reading_band?:number;
  writing_submission_id?:string; speaking_session_id?:string;
  writing_task1_submission_id?:string;
  writing_task1_content_id?:string; writing_task2_content_id?:string;
  writing_task1_draft_id?:string; writing_task2_draft_id?:string;
  break_until?:string;
  /** Set when this mock is a centre's scheduled exam, sat on the centre's computer. */
  exam_session_id?:string;
  /** The centre left Speaking out of this exam: it ends after Writing. */
  no_speaking?:boolean;
  /** The centre's teachers mark this exam's essays, not a model. */
  hand_marked_writing?:boolean;
  /** The named mock this is (see examSetKey): its own Writing tasks are used when it has them. */
  set_key?:string;
  /** When Task 1 first opened: both Writing tasks share one 60-minute clock from here. */
  writing_started_at?:string;
};

/** "Sunday Mock Test · Reading" and "Sunday Mock Test · Writing Task 1" belong to one mock: "sunday mock test". */
export function examSetKey(title:string){return title.toLowerCase().replace(/\b(reading|listening|writing task [12])\b/g,"").replace(/[^a-z0-9]+/g," ").trim()}

// id is the reference the mock's star was spent with, so its Writing and
// Speaking sections can prove to the server that this mock was paid for.
export function newFullMock(listeningExamID:string,readingExamID:string,paidReference?:string,setKey?:string):FullMockSession {
  const id=paidReference||(typeof crypto.randomUUID==="function"?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return {id,started_at:new Date().toISOString(),stage:"overview",listening_exam_id:listeningExamID,reading_exam_id:readingExamID,set_key:setKey||undefined};
}

export function fullMockKey(userID:string){return `mockai.full-mock.${userID}`}
export function readFullMock(userID:string):FullMockSession|null {
  try { const raw=localStorage.getItem(fullMockKey(userID));return raw?JSON.parse(raw) as FullMockSession:null } catch { return null }
}
export function writeFullMock(userID:string,value:FullMockSession|null){if(value)localStorage.setItem(fullMockKey(userID),JSON.stringify(value));else localStorage.removeItem(fullMockKey(userID))}
