import {useEffect,useMemo,useState} from 'react';
import {AdminStudent,AdminStudentProgress,adminStudentsAPI} from './adminStudentAPI';

const date=(value?:string)=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'No activity yet';
const band=(value:number|null|undefined)=>value==null?'Not assessed':value.toFixed(1);
const identity=(student:AdminStudent)=>student.telegram_username?`@${student.telegram_username}`:student.email||student.telegram_id?`Telegram ${student.telegram_id}`:'Telegram student';

export default function AdminStudents(){
 const [students,setStudents]=useState<AdminStudent[]>([]),[selected,setSelected]=useState(''),[progress,setProgress]=useState<AdminStudentProgress|null>(null),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;adminStudentsAPI.list().then(items=>{if(active){setStudents(items);setSelected(items[0]?.id||'')}}).catch(()=>active&&setError('Students could not be loaded.')).finally(()=>active&&setLoading(false));return()=>{active=false}},[]);
 useEffect(()=>{if(!selected){setProgress(null);return}let active=true;setDetailLoading(true);setError('');adminStudentsAPI.get(selected).then(item=>active&&setProgress(item)).catch(()=>active&&setError('Student progress could not be loaded.')).finally(()=>active&&setDetailLoading(false));return()=>{active=false}},[selected]);
 const filtered=useMemo(()=>{const value=query.trim().toLowerCase();return value?students.filter(s=>[s.display_name,s.email,s.telegram_username,s.telegram_id].some(v=>v?.toLowerCase().includes(value))):students},[students,query]);
 return <div className="admin-students">
  <header className="admin-page-heading"><p className="eyebrow">Student success</p><h1>Students</h1><p>See who has joined, what they are practising, and how their assessment scores are developing.</p></header>
  {error&&<div className="admin-notice" role="alert">{error}</div>}
  <div className="student-admin-layout">
   <aside className="student-roster" aria-label="Student roster"><label>Search students<input aria-label="Search students" placeholder="Name, email or Telegram" value={query} onChange={e=>setQuery(e.target.value)}/></label><p>{filtered.length} of {students.length} students</p>{loading?<span role="status">Loading students…</span>:filtered.length?filtered.map(student=><button key={student.id} className={selected===student.id?'active':''} onClick={()=>setSelected(student.id)}><span><strong>{student.display_name}</strong><small>{identity(student)}</small></span><span className="student-roster-score"><b>{band(student.latest_band)}</b><small>{student.completed_mocks?`${student.completed_mocks} scored`:'Not assessed'}</small></span></button>):<div className="student-empty">No students match this search.</div>}</aside>
   <main className="student-progress-panel">{detailLoading?<p role="status">Loading student progress…</p>:progress?<StudentDetail data={progress}/>:<div className="student-empty"><h2>Select a student</h2><p>Their assessments and progress will appear here.</p></div>}</main>
  </div>
 </div>
}

function StudentDetail({data}:{data:AdminStudentProgress}){const s=data.student;return <>
 <section className="student-profile-head"><div><p className="eyebrow">Student profile</p><h2>{s.display_name}</h2><p>{identity(s)} · Joined {date(s.joined_at)}</p></div><div><span>Latest activity</span><strong>{date(s.last_activity_at)}</strong></div></section>
 <section className="student-score-grid" aria-label="Student statistics"><Metric label="Overall mock average" value={band(s.average_band)}/><Metric label="Best mock band" value={band(s.best_band)}/><Metric label="Completed mocks" value={String(s.completed_mocks)}/><Metric label="Practice answers" value={String(s.practice_answers)}/><Metric label="Writing reports" value={String(s.writing_reports)}/><Metric label="Speaking reports" value={String(s.speaking_reports)}/></section>
 <section className="student-detail-section"><h3>Skill progress</h3>{data.skills.length?<div className="student-skill-grid">{data.skills.map(item=><article key={item.skill}><span>{item.skill}</span><strong>{item.latest_band.toFixed(1)}</strong><small>{item.completed} completed · {item.average_band.toFixed(1)} average · {item.best_band.toFixed(1)} best</small></article>)}</div>:<Empty text="No scored Reading or Listening tests yet."/>}</section>
 <section className="student-detail-section"><h3>Test history</h3>{data.attempts.length?<div className="student-activity-list">{data.attempts.map(item=><article key={item.id}><div><strong>{item.title}</strong><small>{item.skill} · {date(item.started_at)}</small></div><div><b>{band(item.band_score)}</b><small>{item.status.replaceAll('_',' ')} · {item.answered}/{item.question_count} answered{item.status==='scored'?` · ${item.correct} correct`:''}</small></div></article>)}</div>:<Empty text="This student has not started a test yet."/>}</section>
 <section className="student-detail-section"><h3>Writing and Speaking reports</h3>{data.reports.length?<div className="student-activity-list">{data.reports.map(item=><article key={item.id}><div><strong>{item.kind==='writing'?'Writing':'Speaking'} · {item.title}</strong><small>{date(item.updated_at)}</small></div><div><b>{band(item.overall)}</b><small>{item.status}</small></div></article>)}</div>:<Empty text="No Writing or Speaking submissions yet."/>}</section>
 </>}
function Metric({label,value}:{label:string;value:string}){return <article><span>{label}</span><strong>{value}</strong></article>}
function Empty({text}:{text:string}){return <div className="student-empty"><p>{text}</p></div>}
