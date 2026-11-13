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
  /** The student finished this mock before: its sections open in any order, one at a time. */
  revisit?:boolean;
};

/** A revisited mock has no breaks and no end: after each section it returns to its section list, cleared for the next choice. */
export function settleFullMock(s:FullMockSession):FullMockSession {
  if(!s.revisit||!(s.stage.startsWith("break_")||s.stage==="complete"))return s;
  return {...s,stage:"overview",break_until:undefined,writing_task1_submission_id:undefined,writing_submission_id:undefined,writing_task1_draft_id:undefined,writing_task2_draft_id:undefined,writing_started_at:undefined,speaking_session_id:undefined};
}

/** "Sunday Mock Test · Reading" and "Sunday Mock Test · Writing Task 1" belong to one mock: "sunday mock test". */
export function examSetKey(title:string){return title.toLowerCase().replace(/\b(reading|listening|writing task [12])\b/g,"").replace(/[^a-z0-9]+/g," ").trim()}

// id is the reference the mock's star was spent with, so its Writing and
// Speaking sections can prove to the server that this mock was paid for.
export function newFullMock(listeningExamID:string,readingExamID:string,paidReference?:string,setKey?:string,revisit?:boolean):FullMockSession {
  const id=paidReference||(typeof crypto.randomUUID==="function"?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return {id,started_at:new Date().toISOString(),stage:"overview",listening_exam_id:listeningExamID,reading_exam_id:readingExamID,set_key:setKey||undefined,revisit:revisit||undefined};
}

// shortcut: mocks finished are remembered in this browser only, so another device relies on the Listening and Reading history instead; store it on the server if that proves too loose.
const finishedKey=(userID:string)=>`mockai.full-mock-finished.${userID}`;
function finishedMocks(userID:string):string[] {try{return JSON.parse(localStorage.getItem(finishedKey(userID))||"[]") as string[]}catch{return []}}
export function finishedFullMock(userID:string,id:string){return finishedMocks(userID).includes(id)}

export function fullMockKey(userID:string){return `mockai.full-mock.${userID}`}
export function readFullMock(userID:string):FullMockSession|null {
  try { const raw=localStorage.getItem(fullMockKey(userID));return raw?JSON.parse(raw) as FullMockSession:null } catch { return null }
}
export function writeFullMock(userID:string,value:FullMockSession|null){if(value?.stage==="complete"&&!finishedFullMock(userID,value.id))localStorage.setItem(finishedKey(userID),JSON.stringify([...finishedMocks(userID),value.id]));if(value)localStorage.setItem(fullMockKey(userID),JSON.stringify(value));else localStorage.removeItem(fullMockKey(userID))}
