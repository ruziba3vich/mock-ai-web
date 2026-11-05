import {useEffect,useMemo,useState} from 'react';
import {AdminStudent,AdminStudentProgress,adminStudentsAPI} from './adminStudentAPI';
import {AdminFilter,AdminFilters,AdminHeading,AdminSheet,AdminTable,useSearch} from './AdminResource';

const date=(value?:string)=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'No activity yet';
const band=(value:number|null|undefined)=>value==null?'Not assessed':value.toFixed(1);
const identity=(student:AdminStudent)=>student.telegram_username?`@${student.telegram_username}`:student.email||student.telegram_id?`Telegram ${student.telegram_id}`:'Telegram student';

/**
 * The student roster.
 *
 * Nothing here is editable -- a student's progress is the record of what they
 * did -- so the row opens a read-only sheet rather than a form. The filter
 * that matters is "has this student been assessed yet", because an unassessed
 * student is the one an operator has to chase.
 */
export default function AdminStudents(){
 const [students,setStudents]=useState<AdminStudent[]>([]),[selected,setSelected]=useState(''),[progress,setProgress]=useState<AdminStudentProgress|null>(null),[query,setQuery]=useState(''),[assessment,setAssessment]=useState('all'),[loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;adminStudentsAPI.list().then(items=>{if(active)setStudents(items)}).catch(()=>active&&setError('Students could not be loaded.')).finally(()=>active&&setLoading(false));return()=>{active=false}},[]);
 useEffect(()=>{if(!selected){setProgress(null);return}let active=true;setDetailLoading(true);setError('');adminStudentsAPI.get(selected).then(item=>active&&setProgress(item)).catch(()=>active&&setError('Student progress could not be loaded.')).finally(()=>active&&setDetailLoading(false));return()=>{active=false}},[selected]);
 const matching=useSearch(students,query,student=>[student.display_name,student.email,student.telegram_username,student.telegram_id]);
 const filtered=useMemo(()=>matching.filter(student=>assessment==='all'||(assessment==='scored'?student.completed_mocks>0:student.completed_mocks===0)),[matching,assessment]);
 const open=students.find(student=>student.id===selected);
 return <div className="admin-students">
  <AdminHeading title="Students" description="See who has joined, what they are practising, and how their assessment scores are developing."/>
  {error&&!selected&&<div className="admin-notice" role="alert">{error}</div>}
  <div className="admin-listing">
   <AdminFilters label="Search students" value={query} onChange={setQuery} placeholder="Name, email or Telegram"
    count={`${filtered.length} of ${students.length} students`}>
    <AdminFilter label="Assessment" value={assessment} onChange={setAssessment} options={[
     {value:'all',label:'Everyone'},{value:'scored',label:'Assessed'},{value:'unassessed',label:'Not assessed'}]}/>
   </AdminFilters>
   <AdminTable label="Student roster" noun="students" action="View"
    columns={[{key:'name',label:'Student',width:'minmax(200px,2fr)'},{key:'identity',label:'Identity',width:'minmax(150px,1fr)'},{key:'mocks',label:'Mocks',width:'90px'},{key:'band',label:'Latest band',width:'120px'},{key:'practice',label:'Practice',width:'100px'},{key:'activity',label:'Last active',width:'minmax(150px,1fr)'}]}
    rows={filtered.map(student=>({id:student.id,openLabel:`View ${student.display_name}`,selected:selected===student.id,
     open:()=>setSelected(student.id),
     cells:[<strong>{student.display_name}</strong>,identity(student),student.completed_mocks,<b>{band(student.latest_band)}</b>,student.practice_answers,date(student.last_activity_at)]}))}
    empty={loading?'Loading students…':students.length?'No students match these filters.':'No students have joined yet.'}/>
  </div>
  {open&&<AdminSheet wide title={open.display_name} subtitle={`${identity(open)} · Joined ${date(open.joined_at)}`}
   onClose={()=>setSelected('')}
   footer={<><span className="admin-sheet-spacer"/><button className="secondary-action" onClick={()=>setSelected('')}>Close</button></>}>
   {error&&<div className="admin-notice" role="alert">{error}</div>}
   {detailLoading?<p role="status">Loading student progress…</p>:progress?<StudentDetail data={progress}/>:null}
  </AdminSheet>}
 </div>
}

function StudentDetail({data}:{data:AdminStudentProgress}){const s=data.student;return <>
 <section className="student-score-grid" aria-label="Student statistics"><Metric label="Overall mock average" value={band(s.average_band)}/><Metric label="Best mock band" value={band(s.best_band)}/><Metric label="Completed mocks" value={String(s.completed_mocks)}/><Metric label="Practice answers" value={String(s.practice_answers)}/><Metric label="Writing reports" value={String(s.writing_reports)}/><Metric label="Speaking reports" value={String(s.speaking_reports)}/></section>
 <section className="student-detail-section"><h3>Skill progress</h3>{data.skills.length?<div className="student-skill-grid">{data.skills.map(item=><article key={item.skill}><span>{item.skill}</span><strong>{item.latest_band.toFixed(1)}</strong><small>{item.completed} completed · {item.average_band.toFixed(1)} average · {item.best_band.toFixed(1)} best</small></article>)}</div>:<Empty text="No scored Reading or Listening tests yet."/>}</section>
 <section className="student-detail-section"><h3>Test history</h3>{data.attempts.length?<div className="student-activity-list">{data.attempts.map(item=><article key={item.id}><div><strong>{item.title}</strong><small>{item.skill} · {date(item.started_at)}</small></div><div><b>{band(item.band_score)}</b><small>{item.status.replaceAll('_',' ')} · {item.answered}/{item.question_count} answered{item.status==='scored'?` · ${item.correct} correct`:''}</small></div></article>)}</div>:<Empty text="This student has not started a test yet."/>}</section>
 <section className="student-detail-section"><h3>Writing and Speaking reports</h3>{data.reports.length?<div className="student-activity-list">{data.reports.map(item=><article key={item.id}><div><strong>{item.kind==='writing'?'Writing':'Speaking'} · {item.title}</strong><small>{date(item.updated_at)}</small></div><div><b>{band(item.overall)}</b><small>{item.status}</small></div></article>)}</div>:<Empty text="No Writing or Speaking submissions yet."/>}</section>
 </>}
function Metric({label,value}:{label:string;value:string}){return <article><span>{label}</span><strong>{value}</strong></article>}
function Empty({text}:{text:string}){return <div className="student-empty"><p>{text}</p></div>}
