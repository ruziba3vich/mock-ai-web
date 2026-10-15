import {apiRequest} from './auth';

export type AdminStudent={id:string;display_name:string;email?:string;telegram_username?:string;telegram_id?:string;joined_at:string;last_activity_at?:string;attempts:number;completed_mocks:number;practice_answers:number;writing_reports:number;speaking_reports:number;average_band:number|null;best_band:number|null;latest_band:number|null};
export type AdminStudentAttempt={id:string;title:string;skill:string;status:string;started_at:string;submitted_at?:string;band_score:number|null;answered:number;correct:number;question_count:number};
export type AdminStudentSkill={skill:string;completed:number;average_band:number;best_band:number;latest_band:number};
export type AdminStudentReport={id:string;kind:'writing'|'speaking';title:string;status:string;overall:number|null;updated_at:string};
export type AdminStudentProgress={student:AdminStudent;skills:AdminStudentSkill[];attempts:AdminStudentAttempt[];reports:AdminStudentReport[]};
export const adminStudentsAPI={
 list:async()=>(await apiRequest<{students:AdminStudent[]}>('/api/v1/admin/students')).students,
 get:(id:string)=>apiRequest<AdminStudentProgress>(`/api/v1/admin/students/${id}`)
};
