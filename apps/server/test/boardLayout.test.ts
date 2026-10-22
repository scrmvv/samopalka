import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radialPosition, PLAYER_RING_RADIUS, MONSTER_RING_RADIUS } from '../../client/src/boardLayout.js';

for (const count of [2, 3, 4, 5, 6]) {
  test(`positions of ${count} players/monsters form two distinct rings`, () => {
    const outer = Array.from({ length: count }, (_, i) => radialPosition(i, count, PLAYER_RING_RADIUS));
    const inner = Array.from({ length: count }, (_, i) => radialPosition(i, count, MONSTER_RING_RADIUS));
    const coords = (v: { left: string; top: string }) => [parseFloat(v.left),parseFloat(v.top)];
    const unique = new Set(outer.map(v => `${v.left}|${v.top}`));
    assert.equal(unique.size, count, 'no overlapping token centres');
    outer.forEach((p,i) => {
      const [x,y] = coords(p);
      const [mx,my] = coords(inner[i]!);
      assert.ok(Math.abs(Math.hypot(x - 50, y - 50) - PLAYER_RING_RADIUS) < 0.00001);
      assert.ok(Math.abs(Math.hypot(mx - 50, my - 50) - MONSTER_RING_RADIUS) < 0.00001);
      // Monster and player share a radial lane from the boss outward.
      assert.ok(Math.abs((x-50)*(my-50) - (y-50)*(mx-50)) < 0.00001);
      assert.ok((x-50)*(mx-50) + (y-50)*(my-50) > 0);
    });
    // The borderless sprite+label groups must not collide at common desktop/tablet sizes.
    for (const {size,playerW,monsterW,bossW} of [
      {size:655,playerW:88,monsterW:76,bossW:140},
      {size:535,playerW:65,monsterW:60,bossW:100},
      {size:400,playerW:52,monsterW:46,bossW:78},
      {size:346,playerW:40,monsterW:36,bossW:58},
    ]) {
      const objects = [
        ...outer.map(p=>({ x: parseFloat(p.left)*size/100, y: parseFloat(p.top)*size/100, w: playerW, h: playerW })),
        ...inner.map(p=>({ x: parseFloat(p.left)*size/100, y: parseFloat(p.top)*size/100, w: monsterW, h: monsterW })),
        {x:size/2,y:size/2,w:bossW,h:bossW},
      ];
      for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
        const a=objects[i]!; const b=objects[j]!;
        assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2 || Math.abs(a.y-b.y)>=(a.h+b.h)/2, `collision between ${i} and ${j}, ${count} players, size ${size}`);
      }
    }
  });
}
