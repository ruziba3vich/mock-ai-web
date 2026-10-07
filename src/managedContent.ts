import { apiRequest } from "./auth";

export type ContentKind = "daily_challenge"|"achievement"|"vocabulary"|"writing_prompt"|"speaking_plan";
export type ManagedContent = { id:string; kind:ContentKind; slug:string; title:string; summary:string; status:"draft"|"published"|"archived"; sort_order:number; starts_at?:string; ends_at?:string; data:Record<string,unknown>; created_at:string; updated_at:string };
export type Dashboard = { summary:{users:number;new_users_7d:number;active_users_7d:number;completed_mocks:number;average_band:number;writing_reports:number;speaking_reports:number;published_exams:number;exam_drafts:number;published_content:number;managed_drafts:number}; trend:{date:string;signups:number;active_students:number;attempts:number}[]; content:{kind:string;status:string;count:number}[] };
export const managedContentAPI={
  dashboard:()=>apiRequest<Dashboard>("/api/v1/admin/dashboard"),
  adminList:async(kind="")=>(await apiRequest<{items:ManagedContent[]}>(`/api/v1/admin/managed-content${kind?`?kind=${kind}`:""}`)).items,
  studentList:async(kind:ContentKind)=>(await apiRequest<{items:ManagedContent[]}>(`/api/v1/content?kind=${kind}`)).items,
  save:(item:ManagedContent)=>apiRequest<ManagedContent>(`/api/v1/admin/managed-content${item.id?`/${item.id}`:""}`,{method:item.id?"PUT":"POST",body:JSON.stringify(item)}),
  remove:(id:string)=>apiRequest<void>(`/api/v1/admin/managed-content/${id}`,{method:"DELETE"}),
};
