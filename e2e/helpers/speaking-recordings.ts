import {execFileSync} from "node:child_process";
import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from "node:crypto";

// Explicit operator-only fixture preparation. Never writes decrypted audio or
// encryption keys to disk. Only the new QA session/account may be mutated.
const ssh=["-i",`${process.env.HOME}/.ssh/arch`,"-o","BatchMode=yes","statistics@46.8.176.85"];
function sql(query:string){return execFileSync("ssh",[...ssh,"docker exec -i mock_ai_postgres psql -X -qAt -U mock_ai -d mock_ai -v ON_ERROR_STOP=1"],{input:query,encoding:"utf8",maxBuffer:128*1024*1024}).trim()}
function uuid(value:string){if(!/^[0-9a-f-]{36}$/i.test(value))throw new Error("Invalid fixture identifier");return value}
export function sourceFingerprint(source:string){return sql(`SELECT md5(row_to_json(s)::text || (SELECT json_agg(row_to_json(t) ORDER BY t.position)::text FROM speaking_turns t WHERE t.session_id=s.id)) FROM speaking_sessions s WHERE s.id='${uuid(source)}';`)}
export function cloneSpeakingRecordings(source:string,user:string){
 uuid(source);uuid(user);
 const approved=sql(`SELECT count(*) FROM users WHERE id='${user}' AND display_name='Temporary Speaking report E2E' AND email LIKE 'speaking-report-%@example.test';`);
 if(approved!=="1")throw new Error("Target is not a temporary QA account");
 const meta=JSON.parse(sql(`SELECT row_to_json(s) FROM (SELECT id,topic,status,audio_expires_at>now() AS valid FROM speaking_sessions WHERE id='${source}') s;`));
 if(meta.status!=="completed" || !meta.valid)throw new Error("Source must be a completed interview with unexpired recordings");
 const env=JSON.parse(execFileSync("ssh",[...ssh,"docker inspect --format '{{json .Config.Env}}' mock_ai_api"],{encoding:"utf8"})) as string[];
 const secret=env.find(v=>v.startsWith("AI_KEY_ENCRYPTION_KEY="))?.split("=").slice(1).join("=");
 if(!secret)throw new Error("Encryption configuration unavailable");
 const master=Buffer.from(secret,"hex"),id=randomUUID();
 try{
  const turns=JSON.parse(sql(`SELECT json_agg(json_build_object('position',position,'ciphertext',encode(recording,'base64')) ORDER BY position) FROM speaking_turns WHERE session_id='${source}' AND answered AND NOT skipped AND recording IS NOT NULL;`)) as {position:number;ciphertext:string}[];
  if(turns.length!==11)throw new Error("Expected eleven human answers");
  const statements=["BEGIN;",`INSERT INTO speaking_sessions(id,user_id,examiner,topic,model,rubric_version,audio_expires_at) SELECT '${id}','${user}',examiner,topic,model,rubric_version,audio_expires_at FROM speaking_sessions WHERE id='${source}';`];
  for(const turn of turns){
   if(!Number.isInteger(turn.position)||turn.position<0||turn.position>10)throw new Error("Invalid turn");
   const encrypted=Buffer.from(turn.ciphertext,"base64");
   const decipher=createDecipheriv("aes-256-gcm",master,encrypted.subarray(0,12));
   decipher.setAAD(Buffer.from(`mockai:speaking:recording:v1:${source}:${turn.position}`));decipher.setAuthTag(encrypted.subarray(-16));
   const audio=Buffer.concat([decipher.update(encrypted.subarray(12,-16)),decipher.final()]);
   try{
    const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",master,nonce);
    cipher.setAAD(Buffer.from(`mockai:speaking:recording:v1:${id}:${turn.position}`));
    const sealed=Buffer.concat([nonce,cipher.update(audio),cipher.final(),cipher.getAuthTag()]);
    statements.push(`INSERT INTO speaking_turns(session_id,position,part,prompt,seconds,prep_seconds,voice_status,recording,duration_ms,answered,skipped,live_transcript) SELECT '${id}',position,part,prompt,seconds,prep_seconds,'ready',decode('${sealed.toString("base64")}','base64'),duration_ms,true,false,live_transcript FROM speaking_turns WHERE session_id='${source}' AND position=${turn.position};`);
   }finally{audio.fill(0)}
  }
  statements.push("COMMIT;");sql(statements.join("\n"));return id;
 }finally{master.fill(0)}
}
export function removeTemporarySpeakingUser(id:string){sql(`DELETE FROM users WHERE id='${uuid(id)}' AND display_name='Temporary Speaking report E2E' AND email LIKE 'speaking-report-%@example.test';`)}
