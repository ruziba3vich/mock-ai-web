import {expect,it,vi} from "vitest";
import {apiRequest} from "./auth";
import {managedContentAPI,ManagedContent} from "./managedContent";
vi.mock("./auth",()=>({apiRequest:vi.fn()}));
it("does not send server-owned timestamps when creating or updating content",async()=>{
 const item={id:"",kind:"vocabulary",slug:"test",title:"Test",status:"draft",created_at:"",updated_at:"",data:{}} as ManagedContent;
 for(const id of ["","existing"]){
  await managedContentAPI.save({...item,id});
  const [path,options]=vi.mocked(apiRequest).mock.calls.at(-1)!;
  expect(path).toBe(`/api/v1/admin/managed-content${id?"/existing":""}`);
  const body=JSON.parse(String(options!.body));
  expect(body).not.toHaveProperty("created_at");expect(body).not.toHaveProperty("updated_at");expect(body.title).toBe("Test");
 }
});
