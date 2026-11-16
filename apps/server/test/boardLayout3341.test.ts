import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monsterGridPositions, radialPosition, PLAYER_RING_RADIUS, visibleMonsters } from '../../client/src/boardLayout.js';

const dimensions = [
  {width:1100,height:700}, // wide desktop
  {width:800,height:650},  // laptop
  {width:690,height:650},  // sidebar occupies part of a desktop viewport
  {width:600,height:650},  // tablet
  {width:380,height:650}   // portrait, expanded arena
];

type Rect={x:number;y:number;width:number;height:number};
function collision(a:Rect,b:Rect,gap:number){
  return Math.abs(a.x-b.x)<(a.width+b.width)/2+gap && Math.abs(a.y-b.y)<(a.height+b.height)/2+gap;
}
function footprints(size:{width:number;height:number},playerCount:number){
  const min=Math.min(size.width,size.height);
  if(size.width<=620 || min<440)return {hero:[60,67],monster:[64,59],boss:[92,100],gap:5};
  if(size.width<=700 && playerCount>=5)return {hero:[72,86],monster:[76,70],boss:[112,118],gap:5};
  if(size.width<=700)return {hero:[83,102],monster:[88,79],boss:[122,127],gap:6};
  if(playerCount>=5)return {hero:[86,97],monster:[88,78],boss:[125,131],gap:6};
  if(min<620)return {hero:[83,102],monster:[88,79],boss:[122,127],gap:6};
  return {hero:[110,119],monster:[112,95],boss:[150,153],gap:7};
}

for(const size of dimensions)for(const count of [2,3,4,5,6])for(const taunted of [0,1,2,3]){
  test(`3.3.4.1 layout ${size.width}x${size.height}: ${count} players, ${taunted} taunts`,()=>{
    const players=Array.from({length:count},(_,i)=>`p${i}`);
    const monsters=[...Array.from({length:taunted+1},()=>({ownerId:'p0'})),
      ...players.slice(1).map(ownerId=>({ownerId}))];
    const coords=monsterGridPositions(monsters,players,size);
    assert.equal(coords.length,monsters.length);
    const f=footprints(size,count);
    const toRect=(pos:{left:string;top:string},wh:number[]):Rect=>({
      x:parseFloat(pos.left)*size.width/100,y:parseFloat(pos.top)*size.height/100,
      width:wh[0]!,height:wh[1]!
    });
    const all:Rect[]=[...players.map((_,i)=>toRect(radialPosition(i,count,PLAYER_RING_RADIUS),f.hero)),
      {x:size.width/2,y:size.height/2,width:f.boss[0]!,height:f.boss[1]!},
      ...coords.map(p=>toRect(p,f.monster))];
    all.forEach((a,i)=>{
      assert.ok(a.x>=a.width/2 && a.x<=size.width-a.width/2,`token ${i} crosses horizontal field bounds`);
      assert.ok(a.y>=a.height/2 && a.y<=size.height-a.height/2,`token ${i} crosses vertical field bounds`);
      for(let j=i+1;j<all.length;j++)assert.ok(!collision(a,all[j]!,f.gap),`overlap of tokens ${i} and ${j}`);
    });
  });
}

test('two monsters captured by knight are centred symmetrically in front of him',()=>{
  const players=['knight','warrior','archer'];
  const size={width:1100,height:700};
  const coords=monsterGridPositions([{ownerId:'knight'},{ownerId:'knight'}],players,size);
  const left=coords.map(p=>parseFloat(p.left));
  const top=coords.map(p=>parseFloat(p.top));
  assert.ok(Math.abs((left[0]!+left[1]!)/2-50)<.01,`pair must be centred on knight, got ${left.join(', ')}`);
  assert.ok(Math.abs(top[0]!-top[1]!)<.01,'both monsters are in the same front row');
  assert.ok(Math.abs(left[0]!-left[1]!)>10,'enough gap for readable labels and info buttons');
});

test('death transfers preserve distinct monster positions and remove corpses',()=>{
  const before=[{kind:'monster',alive:true,ownerId:'knight'},{kind:'monster',alive:false,ownerId:'knight'},
    {kind:'monster',alive:true,ownerId:'warrior'}];
  const after=visibleMonsters(before).map(m=>({...m,ownerId:'warrior'}));
  const positions=monsterGridPositions(after,['knight','warrior','archer'],{width:1100,height:700});
  assert.equal(positions.length,2);
  assert.notDeepEqual(positions[0],positions[1]);
});
