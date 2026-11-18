/* Shared economy. EVERY game settles through App.settle -> Econ.settle (once).
   v3.1: there is no wagering, no balance and no currency spent on a round. Every round is worth Econ.unit() points at 1x (a game's multiplier scales it);
   points feed the Rank-Up bar, the points quests and lifetime statistics. Separate buckets (never mixed): rank points / quests (Econ.settle) | Gems | cosmetics | Daily Spin.
   Every Gem mutator calls Store.check() BEFORE and Store.sync() AFTER touching Gems (shadow ledger, see storage.js). */
const Econ={
r2:x=>Math.round(x*100)/100,
fmt:n=>(+n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),
fi:n=>Econ.fmt(n).replace(/\.00$/,''),
rnd(){try{return crypto.getRandomValues(new Uint32Array(1))[0]/4294967296}catch(e){return Math.random()}},
/* anti-farming: minimum delay between rounds of the slower games (shared by every tab via localStorage). Returns ms left to wait, or 0 and stamps the round. */
cool(game,now=Date.now()){const gap=CFG.GAP_MS[game];if(!gap)return 0;const k='steak_gap_'+game;let last=0;try{last=+localStorage.getItem(k)||0}catch(e){}
if(last>now)last=0;const left=last+gap-now;if(left>0)return left;try{localStorage.setItem(k,String(now))}catch(e){}return 0},
/* points one round is worth at 1x for a rank: the rank-up point requirement spread over the rank-up round requirement (the top rank reuses the previous one), so points and rounds fill the Rank-Up bars together. */
unit(rk=Store.d?Store.d.rk:0){const R=CFG.RANKS,q=R[rk].req||R[Math.max(0,rk-1)].req;return Math.max(1,Econ.r2(q.c/q.r*CFG.ROUND.SCALE))},
bonusActive:(now=Date.now())=>now<Store.d.bx,
effMult:(now)=>Econ.bonusActive(now)?CFG.DAILY.BONUS_MULT:1,                  // only the Daily Spin 2X bonus can multiply points
summary:()=>Econ.bonusActive()?`2X points bonus active (x${CFG.DAILY.BONUS_MULT})`:'No active points bonus',
/* gross = the round's result in points = round value x the multiplier the game landed (0 for a miss). Points earned = gross / plays-per-round, doubled while the 2X bonus runs. 4 decimals so 1/2000 of a round (Plinko) is not rounded away. */
points(gross,game,now){return Math.round(gross/(CFG.CONV[game]||1)*Econ.effMult(now)*1e4)/1e4},
settle(game,unit,gross,opts){Store.check();const pts=Econ.points(gross,game);Stats.record(game,pts);Life.round(unit,gross,pts,opts);Rank.onRound(game,pts,unit,!(opts&&opts.noCount));Store.save();return pts}};
/* v2.25 cross-tab round lock: the first tab to start a round on a game owns it until it releases (resolved/cancelled). Stored in localStorage (the shared state);
   the owner refreshes t via beat(), so a lock whose owner crashed/closed goes stale after CFG.LOCK_TTL_MS and no longer blocks play. */
const Lock={id:Math.random().toString(36).slice(2)+Date.now().toString(36),key:g=>'steak_lock_'+g,
read(g){try{const o=JSON.parse(localStorage.getItem(Lock.key(g)));return o&&typeof o.id==='string'&&Number.isFinite(o.t)?o:null}catch(e){return null}},
mine(g){const o=Lock.read(g);return !!o&&o.id===Lock.id},
heldByOther(g,now=Date.now()){const o=Lock.read(g);return !!o&&o.id!==Lock.id&&Math.abs(now-o.t)<CFG.LOCK_TTL_MS},
acquire(g,now=Date.now()){if(Lock.heldByOther(g,now))return false;try{localStorage.setItem(Lock.key(g),JSON.stringify({id:Lock.id,t:now}))}catch(e){return true}return Lock.mine(g)},
beat(g,now=Date.now()){if(!Lock.mine(g))return false;try{localStorage.setItem(Lock.key(g),JSON.stringify({id:Lock.id,t:now}))}catch(e){}return true},
release(g){if(Lock.mine(g))try{localStorage.removeItem(Lock.key(g))}catch(e){}}};
const Rank={
status(){const d=Store.d,cur=CFG.RANKS[d.rk],next=CFG.RANKS[d.rk+1]||null,req=cur.req,pts=Math.max(0,Econ.r2(d.rc)),rounds=d.rq;
return{idx:d.rk,cur,next,req,pts,rounds,max:!req,ready:!!req&&pts>=req.c&&rounds>=req.r}},
/* Once per settled round: qualified-round conversion + points + quest progress. unit = the round value, so points quests count rounds-worth, not raw points. */
onRound(game,pts,unit,count=true){const d=Store.d,n=CFG.CONV[game]||1;if(count){d.pt[game]=(d.pt[game]||0)+1;if(d.pt[game]>=n){d.pt[game]-=n;d.rq++;d.lq++;Quests.add('rounds',1)}}
if(pts>0){d.rc=Math.round((d.rc+pts)*1e4)/1e4;Quests.add('profit',pts/unit*CFG.ROUND.QUEST_BASE)}},
addPoints(n){Store.d.rc=Math.round((Store.d.rc+n)*1e4)/1e4;Life.points(n)},      // Daily Spin point rewards count toward the Rank-Up bar
/* Single reviewable rank-up: validates again; Gems granted; rank counters reset; lifetime stats/cosmetics kept. */
rankUp(){Store.load();const s=Rank.status();if(!s.ready)return null;const d=Store.d;d.rk++;Life.rank();const rw=CFG.RANKS[d.rk].rw;d.rc=0;d.rq=0;d.pt={};d.gems+=rw.g;Store.sync();Quests.add('rank',1);Store.save();return rw}};
const Daily={
readyIn:(now=Date.now())=>Math.max(0,Store.d.dl+CFG.DAILY.COOLDOWN_MS-now),
ready:(now)=>Daily.readyIn(now)===0,
/* v2.95: cash + gem rewards scale with rank (x1 at Unranked, +CFG.DAILY_RANK_SCALE of base per rank index). Applied at roll time. */
scale:(rk=Store.d?Store.d.rk:0)=>1+CFG.DAILY_RANK_SCALE*Math.max(0,rk|0),
roll(rnd=Econ.rnd,rk=0){const R=CFG.DAILY.REWARDS,t=R.reduce((a,r)=>a+r.p,0);let x=rnd()*t,r=R[R.length-1];for(const c of R){if(x<c.p){r=c;break}x-=c.p}
if(r.id==='x2')return{id:'x2',amount:0};const k=Daily.scale(rk),a=r.min+Math.floor(rnd()*(r.max-r.min+1));return{id:r.id,amount:r.id==='gem'?Math.max(1,Math.round(a*k)):Econ.r2(Math.round(a*k))}},
claim(now=Date.now()){Store.load();Daily.credit(now);if(!Daily.ready(now))return null;const d=Store.d,rw=Daily.roll(Econ.rnd,d.rk);d.dl=now;d.dr=rw;d.dc=false;Life.touch(now);Store.save();return rw},
/* Idempotent payout. Points reward -> Rank-Up points (once). Gem reward -> Gems only. 2X -> 15 min points bonus (no stacking). */
credit(now=Date.now()){Store.check();const d=Store.d;if(!d.dr||d.dc)return false;d.dc=true;
if(d.dr.id==='x2')d.bx=now+CFG.DAILY.BONUS_MS;else if(d.dr.id==='gem')d.gems+=d.dr.amount;else Rank.addPoints(d.dr.amount)
Store.sync();Store.save();return true}};
const Quests={
win(now=Date.now()){return{d:Math.floor(now/CFG.QUEST.DAILY_MS),w:Math.floor((now-CFG.QUEST.WEEK_OFFSET_MS)/CFG.QUEST.WEEKLY_MS)}},
nextReset(scope,now=Date.now()){const w=Quests.win(now);return scope==='d'?(w.d+1)*CFG.QUEST.DAILY_MS:(w.w+1)*CFG.QUEST.WEEKLY_MS+CFG.QUEST.WEEK_OFFSET_MS},
sync(now=Date.now()){const q=Store.d.q,w=Quests.win(now);let ch=false;if(q.dw!==w.d){q.dw=w.d;q.d=Store.scope(null);ch=true}if(q.ww!==w.w){q.ww=w.w;q.w=Store.scope(null);ch=true}if(ch)Store.save()},
/* v2.5b: weekly quests level up. lvOf = current level of a base quest; at() = that level's quest (same id, harder target, more Gems, lv>0). */
nameOf(kind,t){return kind==='rounds'?`Play ${Econ.fi(t)} minigame rounds`:kind==='profit'?`Earn ${Econ.fi(t)} points from minigames`:kind==='time'?`Play for ${+(t/3600000).toFixed(1)} hours`:`Rank up ${t} times`},
lvOf(b){const l=(Store.d.q.w.l&&Store.d.q.w.l[b.kind])|0;return Math.min(l,b.up?b.up.length:0)},
at(b,lv){if(!lv)return b;const u=b.up[lv-1];return{id:b.id,kind:b.kind,target:u[0],gems:u[1],lv,name:Quests.nameOf(b.kind,u[0])}},
list(scope){return scope==='d'?CFG.QUEST.daily:CFG.QUEST.weekly.map(b=>Quests.at(b,Quests.lvOf(b)))},
prog(scope,qs){const s=Store.d.q[scope],p=Math.max(0,(s.p[qs.kind]||0)-((s.b&&s.b[qs.kind])||0));return Math.min(qs.target,qs.kind==='profit'?Econ.r2(p):Math.floor(p))},
done:(scope,qs)=>Quests.prog(scope,qs)>=qs.target,
claimed:(scope,qs)=>!!Store.d.q[scope].c[qs.id],
add(kind,n){Quests.sync();for(const sc of['d','w']){const s=Store.d.q[sc];s.p[kind]=(s.p[kind]||0)+n;for(const qs of Quests.list(sc))if(qs.kind===kind&&!s.n[qs.id]&&Quests.done(sc,qs)){s.n[qs.id]=1;if(typeof App!=='undefined'&&App.toast)App.toast('Quest completed! Claim reward at Quests page.')}}},
claim(scope,id){Store.load();Quests.sync();const qs=Quests.list(scope).find(x=>x.id===id);if(!qs||!Quests.done(scope,qs)||Quests.claimed(scope,qs))return null;
const s=Store.d.q[scope],base=scope==='w'?CFG.QUEST.weekly.find(b=>b.id===id):null;
if(base&&base.up&&Quests.lvOf(base)<base.up.length){s.l[base.kind]=Quests.lvOf(base)+1;s.b[base.kind]=s.p[base.kind]||0;delete s.n[id]}   // weekly: a harder quest replaces it at once, progress restarts from 0
else s.c[id]=1;
Store.d.gems+=qs.gems;Store.sync();Store.save();return qs.gems}};
const Inv={
owned:id=>Store.d.inv.includes(id),
apply(tag,grad){Store.load();const d=Store.d,ok=(id,t)=>id==null||(Cos.by(id)&&Cos.by(id).type===t&&d.inv.includes(id));if(!ok(tag,'tag')||!ok(grad,'grad'))return false;d.eq={tag:tag||null,grad:grad||null};Store.save();return true}};
