import {afterEach,expect,it,vi} from 'vitest';
import {initializeTelegramViewport} from './telegramViewport';

let dispose=()=>{};
afterEach(()=>{dispose();delete window.Telegram});
function client(supported=true){
 const events=new Map<string,()=>void>();
 const app={initData:'test',ready:vi.fn(),expand:vi.fn(),close:vi.fn(),isFullscreen:false,
  isVersionAtLeast:vi.fn(()=>supported),requestFullscreen:vi.fn(),
  safeAreaInset:{top:47,bottom:34,left:0,right:0},contentSafeAreaInset:{top:56,bottom:0,left:0,right:0},
  onEvent:vi.fn((name:string,cb:()=>void)=>events.set(name,cb)),offEvent:vi.fn()};
 window.Telegram={WebApp:app};return {app,events};
}
it('requests native fullscreen and follows confirmation and inset updates',()=>{
 const {app,events}=client();dispose=initializeTelegramViewport();
 expect(app.requestFullscreen).toHaveBeenCalledOnce();
 expect(document.documentElement.classList.contains('telegram-fullscreen')).toBe(false);
 app.isFullscreen=true;events.get('fullscreenChanged')!();
 expect(document.documentElement.classList.contains('telegram-fullscreen')).toBe(true);
 expect(document.documentElement.style.getPropertyValue('--mini-content-top')).toBe('56px');
 app.safeAreaInset.top=0;events.get('safeAreaChanged')!();
 expect(document.documentElement.style.getPropertyValue('--mini-device-top')).toBe('0px');
 app.isFullscreen=false;events.get('fullscreenChanged')!();
 expect(document.documentElement.classList.contains('telegram-fullscreen')).toBe(false);
 expect(app.requestFullscreen).toHaveBeenCalledOnce();
 dispose();expect(app.offEvent).toHaveBeenCalledTimes(4);dispose=()=>{};
});
it('does not request fullscreen for older clients',()=>{const {app}=client(false);dispose=initializeTelegramViewport();expect(app.requestFullscreen).not.toHaveBeenCalled()});
it('does not affect ordinary browser sessions',()=>{const {app}=client();app.initData='';dispose=initializeTelegramViewport();expect(app.requestFullscreen).not.toHaveBeenCalled()});
it('does not break startup when a client rejects fullscreen',()=>{const {app}=client();app.requestFullscreen.mockImplementation(()=>{throw Error('unsupported')});expect(()=>{dispose=initializeTelegramViewport()}).not.toThrow()});
