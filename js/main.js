const Games={};
const FX={boom(host,x,y,big){const f=document.createElement('div');f.className='fx';f.style.left=x+'px';f.style.top=y+'px';f.innerHTML='<div class="xr"></div><div class="xf"></div>';
const cols=['#fde047','#fb923c','#ef4444','#fff'];
for(let i=0;i<(big?22:14);i++){const p=document.createElement('div');p.className='xp';const a=Math.random()*6.28,d=30+Math.random()*(big?70:50);
p.style.setProperty('--dx',Math.cos(a)*d+'px');p.style.setProperty('--dy',Math.sin(a)*d+'px');p.style.background=cols[i%4];f.appendChild(p)}
host.appendChild(f);setTimeout(()=>f.remove(),900)},
confetti(host,n){const w=host.clientWidth||600,cols=['#fde047','#4ade80','#60a5fa','#f472b6','#fb923c'];for(let i=0;i<(n||40);i++){const d=document.createElement('i');d.className='cfi';d.style.cssText=`left:${w/2}px;top:40%;background:${cols[i%5]};--dx:${(Math.random()-.5)*w*.8}px;--dy:${-80-Math.random()*160}px;--r:${Math.random()*720}deg;animation-delay:${Math.random()*.15}s`;host.appendChild(d);setTimeout(()=>d.remove(),1700)}}};
(()=>{const s=document.createElement('style');s.textContent=`
#toast{display:none}
#stk-toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);background:#0a0a0a;color:#fff;border:2px solid #ffffff;border-radius:12px;padding:12px 24px;font:500 16px Montserrat,sans-serif;opacity:0;pointer-events:none;z-index:9999;white-space:nowrap}
#stk-toast.good{color:#4ade80;border-color:#22c55e}#stk-toast.bad{color:#f87171;border-color:#ef4444}
#stk-toast.show{animation:stkt 2.4s ease forwards}
@keyframes stkt{0%{opacity:0;transform:translate(-50%,16px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-6px)}}
.stage{position:relative}.grid5{position:relative}.grid5.shake{animation:stks .45s}
@keyframes stks{20%{transform:translate(-5px,3px)}40%{transform:translate(5px,-3px)}60%{transform:translate(-4px,-2px)}80%{transform:translate(3px,2px)}}
.tl{aspect-ratio:1;perspective:400px;cursor:pointer;position:relative}
.fi{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .45s}.tl.flip .fi{transform:rotateY(180deg)}
.ff,.fb{position:absolute;inset:0;border-radius:10px;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;font-size:30px}
.ff{background:#262626;transition:background .15s}.tl:not(.flip):hover .ff{background:#404040}
.fb{transform:rotateY(180deg);background:#14532d}.fb.bomb{background:#7f1d1d}.tl.ghost{opacity:.5}
.fx{position:absolute;pointer-events:none;width:0;height:0;z-index:6}
.xr{position:absolute;left:-10px;top:-10px;width:20px;height:20px;border-radius:50%;border:4px solid #fb923c;animation:xr .7s ease-out forwards}
@keyframes xr{to{transform:scale(7);opacity:0;border-width:1px}}
.xf{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;background:#fde047;animation:xf .35s ease-out forwards}
@keyframes xf{to{transform:scale(4);opacity:0}}
.xp{position:absolute;left:-3px;top:-3px;width:7px;height:7px;border-radius:50%;animation:xp .8s ease-out forwards}
@keyframes xp{to{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
.cfi{position:absolute;width:8px;height:12px;z-index:8;pointer-events:none;animation:cfa 1.5s ease-out forwards}
@keyframes cfa{35%{transform:translate(calc(var(--dx)*.6),var(--dy)) rotate(calc(var(--r)*.5))}to{transform:translate(var(--dx),260px) rotate(var(--r));opacity:0}}
.play>*{min-width:0}`;document.head.appendChild(s)})();
const $=id=>document.getElementById(id);
const LIST=[['plinko','PLINKO'],['mines','MINES'],['crash','CRASH'],['chicken','CHICKEN'],['flip','FLIP'],['aviamasters','AVIAMASTERS'],['doubleornothing','DOUBLE OR NOTHING'],['blackjack','BLACKJACK'],['cases','CASES'],['guessthecup','GUESS THE CUP']];
const Pages={};
const App={cur:null,
f:n=>(+n).toFixed(2),
pts:n=>(+n).toFixed(2)+' pts',
toast(m){let t=$('stk-toast');if(!t){t=document.createElement('div');t.id='stk-toast';document.body.appendChild(t)}
t.textContent=m;t.className='';void t.offsetWidth;t.className='show '+(/boom|splat|crash|slid|missed|wrong|not enough|slow down|minimum|at most/i.test(m)?'bad':/banked|landed|reward|\+|saved/i.test(m)?'good':'')},
/* refreshes every live number: rank points (.bal, home), Gems (.gembal), the round value shown in each game (.rvv) and the header */
refresh(){document.querySelectorAll('.bal').forEach(e=>e.textContent=Econ.fi(Store.d.rc));document.querySelectorAll('.gembal').forEach(e=>e.textContent=Store.d.gems);document.querySelectorAll('.rvv').forEach(e=>e.textContent=Econ.fi(Econ.unit()));if(typeof Shell!=='undefined')Shell.update()},
/* the "round value" box every game shows instead of an amount input */
roundHTML(){return '<div class="rvrow"><label>Round value</label><div class="rv"><b class="rvv">'+Econ.fi(Econ.unit())+'</b> pts at 1x</div></div>'},
/* Start of a round: nothing is spent. Returns the round value, or 0 when the round may not start yet (slow-down gap). */
begin(el,game){if(!Store.d.user){this.route();return 0}
const w=Econ.cool(game);if(w){this.toast('Slow down: wait '+(w/1000).toFixed(1)+'s before the next round');return 0}
return Econ.unit()},
/* Settlement path: returns the points the round awarded (after the 2X bonus). */
settle(game,unit,gross,opts){const pts=Econ.settle(game,unit,gross,opts);this.refresh();return pts},
setUser(n){n=(n||'').trim().slice(0,16);if(!n)return false;Store.d.user=n;Store.save();return true},
route(){if(this.cur){this.cur();this.cur=null}
Daily.credit();   // pays a claimed reward if the page was refreshed mid-spin
if(!Store.d.user){this.welcome();return}
Shell.show(true);const k=location.hash.slice(1),g=Games[k],p=Pages[k];
if(p){this.cur=p.mount($('app'))||null;this.refresh();return}
if(!g){this.cur=Dash.home($('app'))||null;this.refresh();return}
$('app').innerHTML=`<h2 class="gt">&lt; ${g.title} &gt;</h2><div class="frame" id="gm"></div>`;
this.cur=g.mount($('gm'))||null;this.refresh()},
welcome(){Shell.show(false);$('app').innerHTML='<section class="welcome"><h1>Welcome to <span class="gold">Gold</span> 🤖</h1><input id="gu" placeholder="Type username here…" maxlength="16" autofocus><button id="gb" class="pillbtn">Continue…</button></section>';
const go=()=>{if(this.setUser($('gu').value)){location.hash='';this.route()}else this.toast('Type a username first')};
$('gb').onclick=go;$('gu').onkeydown=e=>{if(e.key==='Enter')go()}},
init(){/* One game per Space press: held-key repeats are ignored, and nothing ever starts a game by itself (no auto-play anywhere). */
document.addEventListener('keydown',e=>{if(e.code!=='Space'||e.repeat||e.defaultPrevented)return;const t=e.target,tg=t&&t.tagName;if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT'||tg==='BUTTON'||tg==='A'||document.querySelector('.mo'))return;
const b=document.querySelector('#gm #go');if(b&&!b.disabled){e.preventDefault();b.click()}});
addEventListener('hashchange',()=>this.route());this.route()}};
