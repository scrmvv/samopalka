/** Player seats are anchored to the arena; monster slots are laid out in pixels. */
export const PLAYER_RING_RADIUS = 38.5;
export const MONSTER_RING_RADIUS = 21;

export function radialPosition(index: number, total: number, radiusPercent: number) {
  const angle = (-90 + (360 / Math.max(1, total)) * index) * Math.PI / 180;
  return {
    left: `${50 + Math.cos(angle) * radiusPercent}%`,
    top: `${50 + Math.sin(angle) * radiusPercent}%`,
    transform: 'translate(-50%, -50%)'
  };
}

/** Dead enemies must not reserve space or intercept clicks. */
export function visibleMonsters<T extends { kind: string; alive: boolean }>(combatants: readonly T[]): T[] {
  return combatants.filter(c => c.kind === 'monster' && c.alive);
}

/** Kept for compatibility with existing stage 3.3.3 geometry tests. */
export function monsterRingPositions<T extends {ownerId: string | null}>(
  monsters: readonly T[], playerIds: readonly string[], radiusPercent = MONSTER_RING_RADIUS
) {
  const positions: ReturnType<typeof radialPosition>[] = [];
  if (!monsters.length) return positions;
  const ownerIndices = monsters.map(m => playerIds.indexOf(m.ownerId ?? ''));
  const hasRepeat = ownerIndices.some((owner, i) => owner >= 0 && ownerIndices.indexOf(owner) !== i);
  if (!hasRepeat) return monsters.map((_, i) => radialPosition(ownerIndices[i]! >= 0 ? ownerIndices[i]! : i, playerIds.length, radiusPercent));
  const indices = monsters.map((_, i) => i).sort((a,b) => {
    const ao = ownerIndices[a]! < 0 ? playerIds.length : ownerIndices[a]!;
    const bo = ownerIndices[b]! < 0 ? playerIds.length : ownerIndices[b]!;
    return ao-bo || a-b;
  });
  const step = 360 / monsters.length;
  const startOptions: number[] = [];
  for (const owner of [...new Set(ownerIndices.filter(n => n >= 0))]) {
    const slots = indices.map((id, idx) => ownerIndices[id] === owner ? idx : -1).filter(v => v >= 0);
    const slotMid=(slots[0]!+slots[slots.length-1]!)/2;
    startOptions.push(-90+360*owner/playerIds.length-step*slotMid);
  }
  const start = startOptions.length ? startOptions.reduce((sum,n)=>sum+n,0)/startOptions.length : -90;
  const wideRadius = Math.min(29, Math.max(radiusPercent, monsters.length > 5 ? 25 : 24));
  for (let rank=0; rank<indices.length; rank++) {
    const angle=(start+rank*step)*Math.PI/180;
    positions[indices[rank]!] = {
      left:`${50+Math.cos(angle)*wideRadius}%`,top:`${50+Math.sin(angle)*wideRadius}%`,
      transform:'translate(-50%, -50%)'
    };
  }
  return positions;
}

type Point = {x:number;y:number};
type Rect = Point & {width:number;height:number};
export type BoardDimensions = {width:number;height:number};
const asStyle = (p:Point, size:BoardDimensions) => ({
  left: `${100 * p.x / size.width}%`, top: `${100 * p.y / size.height}%`,
  transform: 'translate(-50%, -50%)'
});

/** Approximate complete sprite + title + HP hitboxes, including labels.
 * These sizes correspond to the responsive CSS token widths below. */
function tokenSize(size:BoardDimensions, playerCount:number) {
  const min = Math.min(size.width,size.height);
  if(size.width <= 620 || min < 440) return {hero:{width:60,height:67},monster:{width:64,height:59},boss:{width:92,height:100},gap:5};
  if(size.width<=700 && playerCount>=5) return {hero:{width:72,height:86},monster:{width:76,height:70},boss:{width:112,height:118},gap:5};
  if(size.width<=700) return {hero:{width:83,height:102},monster:{width:88,height:79},boss:{width:122,height:127},gap:6};
  if(playerCount>=5) return {hero:{width:86,height:97},monster:{width:88,height:78},boss:{width:125,height:131},gap:6};
  return min < 440
    ? {hero:{width:60,height:67},monster:{width:64,height:59},boss:{width:92,height:100},gap:5}
    : min < 620
    ? {hero:{width:83,height:102},monster:{width:88,height:79},boss:{width:122,height:127},gap:6}
    : {hero:{width:110,height:119},monster:{width:112,height:95},boss:{width:150,height:153},gap:7};
}

function overlapPenalty(a:Rect,b:Rect, gap:number) {
  const x = (a.width+b.width)/2+gap-Math.abs(a.x-b.x);
  const y = (a.height+b.height)/2+gap-Math.abs(a.y-b.y);
  return x>0 && y>0 ? 1 + x*y : 0;
}

function layouts(count:number, stepX:number, stepY:number): Point[][] {
  // Always try a single centred row first: two taunted monsters must straddle
  // their owner symmetrically. Only use staggered grids when a row cannot fit.
  const layouts:Point[][]=[];
  for(let rowCount=1;rowCount<=Math.min(3,count);rowCount++) {
    const rows=Array.from({length:rowCount},(_,i)=>Math.floor(count/rowCount)+(i<count%rowCount?1:0));
    const cells:Point[]=[];
    rows.forEach((cols,row)=>{
      for(let col=0;col<cols;col++)cells.push({x:(col-(cols-1)/2)*stepX,y:(row-(rowCount-1)/2)*stepY});
    });
    layouts.push(cells);
  }
  return layouts;
}

/**
 * Invisible grid, stage 3.3.4.1. The centre of every group lies on the lane
 * connecting its living owner to the boss. Two taunted enemies appear at equal
 * distances to either side of that centre, not stacked on the owner.
 *
 * Actual board dimensions are used so wide desktop arenas have useful side
 * space, unlike the previous square-only coordinate system. Candidate layouts
 * are checked against every player, the boss and already placed monsters.
 */
export function monsterGridPositions<T extends {ownerId:string|null;behind?:boolean}>(
  monsters:readonly T[], players:readonly string[], size:BoardDimensions={width:1050,height:700}
) {
  if(!monsters.length)return [];
  const dims={width:Math.max(1,size.width),height:Math.max(1,size.height)};
  const unit=tokenSize(dims,players.length);
  const center={x:dims.width/2,y:dims.height/2};
  const playersRects:Rect[]=players.map((_,i)=>{
    const p=radialPosition(i,players.length,PLAYER_RING_RADIUS);
    return {x:parseFloat(p.left)*dims.width/100,y:parseFloat(p.top)*dims.height/100,...unit.hero};
  });
  const occupied:Rect[]=[...playersRects,{...center,...unit.boss}];
  const positions:Point[]=Array(monsters.length);
  const groups=new Map<number,number[]>();
  monsters.forEach((m,index)=>{
    const ownerIndex=Math.max(0,players.indexOf(m.ownerId??''));
    const group=groups.get(ownerIndex)??[];
    group.push(index); groups.set(ownerIndex,group);
  });
  // Larger transferred groups are placed before isolated monsters.
  const ordered=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length||a[0]-b[0]);
  for(const [ownerIndex,indices] of ordered) {
    // Front figures form the first rank. «Позади» figures go behind them, closer to the boss.
    indices.sort((a,b)=>Number(Boolean(monsters[a]?.behind))-Number(Boolean(monsters[b]?.behind))||a-b);
    const owner=playersRects[ownerIndex]??playersRects[0]??{...center,...unit.hero};
    const direction={x:center.x-owner.x,y:center.y-owner.y};
    const magnitude=Math.max(1,Math.hypot(direction.x,direction.y));
    const inward={x:direction.x/magnitude,y:direction.y/magnitude};
    const side={x:-inward.y,y:inward.x};
    const anchor={x:owner.x+direction.x*.475,y:owner.y+direction.y*.475};
    let best:Point[]=[];
    let bestScore=Infinity;
    const fronts=indices.filter(idx=>!monsters[idx]?.behind).length;
    const rears=indices.length-fronts;
    const stepX=unit.monster.width+unit.gap+12;
    const stepY=unit.monster.height+unit.gap+8;
    const twoRanks=fronts>0&&rears>0;
    const rankPattern=twoRanks?indices.map((_,i)=>{
      const front=i<fronts;
      const count=front?fronts:rears;
      const col=front?i:i-fronts;
      return {x:(col-(count-1)/2)*stepX,y:front?-stepY/2:stepY/2};
    }):null;
    const patterns=rankPattern?[rankPattern]:layouts(indices.length,stepX,stepY);
    for(let p=0;p<patterns.length;p++) {
      const pattern=patterns[p]!;
      for(const shiftIn of [0,-35,35,-70,70,-110,110])for(const shiftSide of [0,-35,35,-70,70]) {
        const points=pattern.map(slot=>({
          x:anchor.x+side.x*(slot.x+shiftSide)+inward.x*(slot.y+shiftIn),
          y:anchor.y+side.y*(slot.x+shiftSide)+inward.y*(slot.y+shiftIn)
        }));
        const tokenRects=points.map(point=>({...point,...unit.monster}));
        let penalty=0;
        for(let k=0;k<tokenRects.length;k++) {
          const a=tokenRects[k]!;
          const pad=unit.gap;
          if(a.x-a.width/2<pad)penalty+=10000+(pad-(a.x-a.width/2))*250;
          if(a.x+a.width/2>dims.width-pad)penalty+=10000+(a.x+a.width/2-dims.width+pad)*250;
          if(a.y-a.height/2<pad)penalty+=10000+(pad-(a.y-a.height/2))*250;
          if(a.y+a.height/2>dims.height-pad)penalty+=10000+(a.y+a.height/2-dims.height+pad)*250;
          for(const b of occupied)penalty+=overlapPenalty(a,b,pad)*500;
          for(let j=0;j<k;j++)penalty+=overlapPenalty(a,tokenRects[j]!,pad)*500;
        }
        // Prefer centred rows, preserving symmetry when two foes are taunted.
        const score=penalty+Math.abs(shiftIn)*2+Math.abs(shiftSide)*3+p*95+
          pattern.reduce((sum,slot)=>sum+Math.abs(slot.x)*.025+Math.abs(slot.y)*.07,0);
        if(score<bestScore){bestScore=score;best=points;}
      }
    }
    indices.forEach((index,i)=>{
      const point=best[i]??anchor;
      positions[index]=point;
      occupied.push({...point,...unit.monster});
    });
  }
  return positions.map(p=>asStyle(p,dims));
}
