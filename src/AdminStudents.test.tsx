import {cleanup,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import AdminStudents from './AdminStudents';
import {adminStudentsAPI,AdminStudent} from './adminStudentAPI';
import {studentStarsAPI} from './stars';
import {APIError} from './auth';
vi.mock('./adminStudentAPI',()=>({adminStudentsAPI:{list:vi.fn(),get:vi.fn()}}));
vi.mock('./stars',async orig=>({...await orig<typeof import('./stars')>(),studentStarsAPI:{get:vi.fn(),grant:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks()});
beforeEach(()=>{vi.mocked(studentStarsAPI.get).mockRejectedValue(new APIError(403,'forbidden'))}); // a centre admin unless a test says otherwise
const base:AdminStudent={id:'11111111-1111-1111-1111-111111111111',display_name:'Dilmurodbek',telegram_username:'dilmurod',joined_at:'2026-10-09T17:14:00Z',last_activity_at:'2026-10-10T11:00:00Z',attempts:2,completed_mocks:1,practice_answers:4,writing_reports:0,speaking_reports:0,average_band:6,best_band:6,latest_band:6};
it('searches students and displays scored, active and unassessed progress',async()=>{
 const user0=userEvent.setup();
 vi.mocked(adminStudentsAPI.list).mockResolvedValue([base,{...base,id:'22222222-2222-2222-2222-222222222222',display_name:'New Student',telegram_username:'newstudent',attempts:0,completed_mocks:0,practice_answers:0,average_band:null,best_band:null,latest_band:null,last_activity_at:undefined}]);
 vi.mocked(adminStudentsAPI.get).mockResolvedValue({student:base,skills:[{skill:'reading',completed:1,average_band:6,best_band:6,latest_band:6}],attempts:[{id:'a1',title:'Cambridge Reading',skill:'reading',status:'scored',started_at:'2026-10-10T10:00:00Z',submitted_at:'2026-10-10T11:00:00Z',band_score:6,answered:40,correct:27,question_count:40},{id:'a2',title:'Cambridge Listening',skill:'listening',status:'in_progress',started_at:'2026-10-10T12:00:00Z',band_score:null,answered:8,correct:0,question_count:40}],reports:[]});
 render(<AdminStudents/>);
 // The tab opens on the roster; one student's progress is a sheet over it.
 await user0.click(await screen.findByRole('button',{name:'View Dilmurodbek'}));
 expect(await screen.findByRole('heading',{name:'Dilmurodbek'})).toBeInTheDocument();
 expect(screen.getByText('Cambridge Reading')).toBeInTheDocument();
 expect(screen.getByText(/40\/40 answered · 27 correct/)).toBeInTheDocument();
 expect(screen.getByText('Cambridge Listening')).toBeInTheDocument();
 expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(0);
 await user0.click(screen.getByRole('button',{name:'Close'}));
 await user0.type(screen.getByLabelText('Search students'),'new');
 const roster=screen.getByLabelText('Student roster');expect(within(roster).getByText('New Student')).toBeInTheDocument();expect(within(roster).queryByText('Dilmurodbek')).not.toBeInTheDocument();
});
it('lets a platform admin add stars to a student once per click',async()=>{
 const user0=userEvent.setup();
 vi.mocked(adminStudentsAPI.list).mockResolvedValue([base]);
 vi.mocked(adminStudentsAPI.get).mockResolvedValue({student:base,skills:[],attempts:[],reports:[]});
 vi.mocked(studentStarsAPI.get).mockResolvedValue({balance:5,centre_name:'Alpha Centre'});
 vi.mocked(studentStarsAPI.grant).mockResolvedValue({balance:35,centre_name:'Alpha Centre'});
 render(<AdminStudents/>);
 await user0.click(await screen.findByRole('button',{name:'View Dilmurodbek'}));
 expect(await screen.findByText(/used only if they leave the centre/)).toBeInTheDocument();
 await user0.clear(screen.getByLabelText('How many to add'));await user0.type(screen.getByLabelText('How many to add'),'30');
 await user0.click(screen.getByRole('button',{name:'Add'}));
 expect(await screen.findByText('30 stars added.')).toBeInTheDocument();
 expect(screen.getByText((_,el)=>el?.tagName==='B'&&el.textContent==='35 stars')).toBeInTheDocument();
 const [id,count,ref]=vi.mocked(studentStarsAPI.grant).mock.calls[0];
 expect([id,count]).toEqual([base.id,30]);expect(ref).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
});
it('hides the stars section from a centre admin',async()=>{
 const user0=userEvent.setup();
 vi.mocked(adminStudentsAPI.list).mockResolvedValue([base]);
 vi.mocked(adminStudentsAPI.get).mockResolvedValue({student:base,skills:[],attempts:[],reports:[]});
 vi.mocked(studentStarsAPI.get).mockRejectedValue(new APIError(403,'forbidden'));
 render(<AdminStudents/>);
 await user0.click(await screen.findByRole('button',{name:'View Dilmurodbek'}));
 await screen.findByText('No scored Reading or Listening tests yet.');
 expect(screen.queryByRole('heading',{name:'Stars'})).not.toBeInTheDocument();
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
