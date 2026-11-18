/* v3.1 per-game statistics: Store.d.g[game] = {n: rounds played, x: points earned}; best round kept in Store.d.bp. */
const Stats={
record(g,p){const s=Store.d.g[g]=Store.d.g[g]||{n:0,x:0};const pts=Math.round(p*100)/100;s.n=(s.n||0)+1;
if(pts>0){s.x=Math.round((s.x+pts)*100)/100;Store.d.pw++;if(!Store.d.bp||pts>Store.d.bp.v)Store.d.bp={v:pts,g}}Store.save()},
top(k){let b='___',v=0;for(const g in Store.d.g)if(Store.d.g[g][k]>v){v=Store.d.g[g][k];b=g}return b},
html(){const d=Store.d,be=o=>o?`${o.v.toFixed(2)} pts in ${o.g}`:'___';
return `<div>Lifetime mini-game rounds played: <b>${d.lq}</b></div><div>Most rounds played in: <b>${this.top('n')}</b></div><div>Most points earned in: <b>${this.top('x')}</b></div><div>Best single round: <b>${be(d.bp)}</b></div>`}};
