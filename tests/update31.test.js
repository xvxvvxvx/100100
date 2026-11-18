// Update 3.1 tests (no wagering / no balance, round values, points, removed features). Run: node tests/update31.test.js   (no browser needed)
const fs=require('fs'),vm=require('vm'),path=require('path'),R=p=>path.join(__dirname,'..',p),J=f=>R('js/'+f+'.js');
const store={};global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>{delete store[k]}};global.window=global;global.Games={};global.addEventListener=()=>{};
const toasts=[];global.App={toast:m=>toasts.push(m),refresh(){}};
for(const f of ['config','cosmetics','cosfx','storage','stats','economy'])vm.runInThisContext(fs.readFileSync(J(f),'utf8'),{filename:f});
const realLoad=Store.load.bind(Store);Store.load=()=>Store.d;
let pass=0,fail=0;const t=(n,ok,x='')=>{ok?pass++:fail++;console.log((ok?'PASS ':'FAIL ')+n+(x?'  '+x:''))};
const fresh=()=>{for(const k in store)delete store[k];Store.d=Store.def();Store.d.user='t';Store.sync();toasts.length=0};
const src=f=>fs.readFileSync(R(f),'utf8'),RK=CFG.RANKS;
// ---- no wagering
fresh();t('a new save has no balance / wager fields',!('balance' in Store.d)&&!('paid' in Store.d)&&!('shop' in Store.d)&&!('ndp' in Store.d));
t('wager / balance / selling APIs are gone',typeof Econ.checkBet==='undefined'&&typeof Econ.parseAmt==='undefined'&&typeof Econ.resetBalance==='undefined'&&typeof Econ.addCoins==='undefined'&&typeof Gems==='undefined'&&typeof Shop==='undefined'&&typeof Inv.sell==='undefined'&&typeof Inv.buy==='undefined'&&typeof Cos.sellValue==='undefined');
t('config has no currency / wager settings',!('UNRANKED_START' in CFG)&&!('GEM' in CFG)&&!('MIN_BET' in CFG)&&!('ROUND_MIN_BET' in CFG)&&!('SHOP' in CFG)&&RK.every(r=>!('c' in r.rw)&&r.rw.g>=0));
// ---- round value
t('round value = rank points / rank rounds (Unranked 225/40 = 5.63, Copper 725/50 = 14.5)',Econ.unit(0)===5.63&&Econ.unit(1)===14.5);
t('round value rises with rank and the top rank reuses the previous one',RK.every((r,i)=>i===0||Econ.unit(i)>0)&&Econ.unit(RK.length-1)===Econ.unit(RK.length-2));
// ---- settle
fresh();const u=Econ.unit();let p=Econ.settle('MINES',u,u*2.5);
t('a 2.5x round awards 2.5 round values (rank points, 1 qualified round)',Math.abs(p-2.5*u)<1e-3&&Math.abs(Store.d.rc-p)<1e-3&&Store.d.rq===1&&Store.d.lq===1);
p=Econ.settle('MINES',u,0);t('a miss awards 0 points but still counts as a round',p===0&&Store.d.rq===2);
fresh();t('Plinko 2,000 balls = 1 round, each ball earns 1/2000 of a round',(()=>{for(let i=0;i<1999;i++)Econ.settle('PLINKO',u,u);const a=Store.d.rq;Econ.settle('PLINKO',u,u);return a===0&&Store.d.rq===1&&Math.abs(Store.d.rc-u)<.05})());
fresh();Econ.settle('CASES',u,u*3);Econ.settle('CASES',u,u*3);Econ.settle('CASES',u,u*3);t('Cases: 3 plays = 1 round and ~3 round values/3',Store.d.rq===1&&Math.abs(Store.d.rc-3*u)<.01);
fresh();Store.d.bx=Date.now()+60000;t('the 2X bonus doubles points',Math.abs(Econ.settle('MINES',u,u)-2*u)<1e-3);
fresh();Econ.settle('MINES',u,u*4);t('lifetime stats: points earned, rounds, highest multiplier',Math.abs(Store.d.ls.lp-4*u)<.01&&Store.d.ls.lc===Store.d.ls.lp&&Store.d.ls.lm===1&&Store.d.ls.hm===4);
Econ.settle('MINES',u,u,{noCount:true});t('noCount rounds earn points but are not counted',Store.d.ls.lm===1&&Store.d.rq===1);
fresh();Econ.settle('FLIP',u,u*2);t('per-game stats track rounds and points',Store.d.g.FLIP.n===1&&Store.d.g.FLIP.x>0&&Store.d.bp&&Store.d.bp.g==='FLIP');
// ---- quests
fresh();for(let i=0;i<500;i++)Econ.settle('MINES',u,u);t('points quests count round-equivalents: 500 rounds at 1x = 2,500 points-quest units',Math.abs(Store.d.q.d.p.profit-2500)<1)
t('500 rounds completes the daily rounds quest and the points quest',Quests.done('d',CFG.QUEST.daily[0])&&Quests.done('d',CFG.QUEST.daily[1])&&toasts.includes('Quest completed! Claim reward at Quests page.'));
t('quest text uses points, not coins',CFG.QUEST.daily[1].name==='Earn 2,500 points from minigames'&&Quests.nameOf('profit',100)==='Earn 100 points from minigames');
// ---- ranks
fresh();Store.d.rc=1e9;Store.d.rq=1e9;const g0=Store.d.gems,rw=Rank.rankUp();t('rank-up grants Gems only and resets rank progress',rw&&Store.d.rk===1&&Store.d.gems===g0+RK[1].rw.g&&Store.d.rc===0&&Store.d.rq===0&&!('c' in rw));
fresh();Store.d.rc=224.99;Store.d.rq=40;t('not eligible at 224.99 points',!Rank.status().ready);Store.d.rc=225;Store.d.rq=39;t('not eligible at 39 rounds',!Rank.status().ready);Store.d.rq=40;t('eligible at 225 points + 40 rounds',Rank.status().ready&&Rank.status().pts===225);
fresh();Store.d.rk=RK.length-1;Store.d.rc=1e9;Store.d.rq=1e9;t('the top rank cannot rank up',Rank.rankUp()===null);
// ---- daily
fresh();Store.d.dr={id:'low',amount:400};Store.d.dc=false;Daily.credit();Daily.credit();t('Daily points reward feeds rank points exactly once',Store.d.rc===400&&Store.d.ls.lc===400);
fresh();Store.d.dr={id:'gem',amount:3};Store.d.dc=false;Daily.credit();Daily.credit();t('Daily Gem reward adds Gems once, no points',Store.d.gems===3&&Store.d.rc===0);
fresh();const n0=Date.now();Store.d.dr={id:'x2',amount:0};Store.d.dc=false;Daily.credit(n0);Daily.credit(n0+5000);t('2X potion lasts 15 minutes and does not stack',Store.d.bx===n0+900000);
// ---- gems ledger
fresh();Store.armed=true;Store.d.gems=999;Store.check();Store.armed=false;t('console-style Gem edits are still clamped',Store.d.gems===0&&Store.tamper>=0);
// ---- persistence + legacy migration
Store.armed=true;fresh();Store.d.rk=3;Store.d.rc=12.5;Store.d.gems=4;Store.d.inv=['t_larper'];Store.sync();Store.save();realLoad();t('save -> load keeps rank, points, Gems, inventory',Store.d.rk===3&&Store.d.rc===12.5&&Store.d.gems===4&&Store.d.inv.includes('t_larper')&&!('balance' in Store.d));
const legacy={user:'old',balance:99999,gems:7,rk:5,rc:100,rq:3,lq:44,inv:['t_larper'],eq:{tag:'t_larper',grad:null},g:{MINES:{w:900,l:10,x:50},FLIP:{w:0,l:0,x:0}},paid:{t_larper:1},shop:{id:1,salt:0,offers:[]},ndp:true};
Store.armed=false;localStorage.setItem(Store.key,JSON.stringify(legacy));realLoad();Store.armed=true;
t('an older save keeps rank, rank progress, Gems, cosmetics, lifetime rounds and drops balance / shop / paid',Store.d.user==='old'&&Store.d.rk===5&&Store.d.rc===100&&Store.d.rq===3&&Store.d.gems===7&&Store.d.lq===44&&Store.d.inv.includes('t_larper')&&!('balance' in Store.d)&&!('paid' in Store.d)&&!('shop' in Store.d));
t('older per-game stats convert (played games stay "played" for Game Variety)',Store.d.g.MINES.n===1&&Store.d.g.FLIP.n===0&&Store.d.g.MINES.x===50);
// ---- removed features / wiring
const gh=src('game.html'),ix=src('index.html'),ld=src('js/loader.js'),sw=src('sw.js');
t('index.html only redirects to game.html (no calculator)',/url=game\.html/.test(ix)&&/location\.replace\('game\.html'/.test(ix)&&!/calc|ptable|toggle|periodic/i.test(ix));
t('game.html: no right-shift tip, no toggle script, no disclaimer text, version 3.1',!/toggle\.js|right shift|fictional|Coin Balance/i.test(gh)&&/Update 3\.1/.test(gh)&&/update31\.css/.test(gh)&&/id="hb-pts"/.test(gh));
t('loader no longer allows the about:blank host',!/about:blank/.test(ld));
t('service worker: new cache, removed files gone, update31.css cached',/gold-offline-v3\.1/.test(sw)&&!/calc\.js|ptable\.js|toggle\.js/.test(sw)&&sw.includes("'css/update31.css'"));
{const bad=[];for(const f of fs.readdirSync(R('js')).concat(fs.readdirSync(R('js/games')).map(x=>'games/'+x)).filter(x=>/\.js$/.test(x)&&!/^(calc|ptable|toggle)\.js$/.test(x)&&x!=='games/lockpick.js')){const s=src('js/'+f);if(/App\.bet\b|betHTML|Econ\.checkBet|Econ\.parseAmt|Store\.d\.balance|addCoins|sellValue|Gems\.convert|[\w)]\.coin\b|App\.bal\(/.test(s))bad.push(f)}t('no code references the removed betting / balance / selling APIs'+(bad.length?' ('+bad.join(',')+')':''),!bad.length)}
{const bad=[];for(const f of fs.readdirSync(R('js/games')).filter(x=>/\.js$/.test(x)&&x!=='lockpick.js')){const s=src('js/games/'+f);const vis=s.replace(/\/\*.*?\*\//gs,'').split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');if(/Place bet|Lock Bet|>Bet<|Cash out|01O0|Steakcoin|Place Wager|Lost \$|Wager:/.test(vis))bad.push(f)}t('minigame UI text has no wager / bet / cash-out / coin wording'+(bad.length?' ('+bad.join(',')+')':''),!bad.length)}
t('every JS file parses',(()=>{try{for(const f of ld.match(/const F=\[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g))new Function(src('js/'+f[1]+'.js'));return true}catch(e){console.log(e.message);return false}})());
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
