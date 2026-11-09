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
};

// id is the reference the mock's star was spent with, so its Writing and
// Speaking sections can prove to the server that this mock was paid for.
export function newFullMock(listeningExamID:string,readingExamID:string,paidReference?:string):FullMockSession {
  const id=paidReference||(typeof crypto.randomUUID==="function"?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return {id,started_at:new Date().toISOString(),stage:"overview",listening_exam_id:listeningExamID,reading_exam_id:readingExamID};
}

export function fullMockKey(userID:string){return `mockai.full-mock.${userID}`}
export function readFullMock(userID:string):FullMockSession|null {
  try { const raw=localStorage.getItem(fullMockKey(userID));return raw?JSON.parse(raw) as FullMockSession:null } catch { return null }
}
export function writeFullMock(userID:string,value:FullMockSession|null){if(value)localStorage.setItem(fullMockKey(userID),JSON.stringify(value));else localStorage.removeItem(fullMockKey(userID))}
