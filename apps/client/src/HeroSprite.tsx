import type { HeroId } from '@samopalka/shared';
const SPRITE_PALETTE: Record<string, string> = {
  o: '#222c33', m: '#d8ded9', s: '#e4b38a', h: '#f3d79a',
  g: '#b99552', b: '#688da5', B: '#93b9c9', r: '#bd615b',
  R: '#e99b77', n: '#729b70', N: '#a8cc8b', p: '#8767ae',
  P: '#c49bdc', t: '#4e9f94', T: '#9ccfbc', w: '#ece5d3',
};
const HERO_SPRITES: Record<HeroId, readonly string[]> = {
  warrior: [
    '............','....gggg....','...gmmmmg...','...mBmmBm...','...mssssm...','....soos....',
    '...bbbbbb...','..bbBbbBbb..','..bmbbbbmb..','..bmbbbbmb..','...oo..oo...','............',
  ],
  berserker: [
    '............','...rr..rr...','..rRRrrRRr..','..RRRRRRRR..','...RssssR...','...soosss...',
    '...rRRRRr...','..rrrrrrrr..','..rrsrrsrr..','..rrr..rrr..','...oo..oo...','............',
  ],
  knight: [
    '............','....mmmm....','...mBBBBm...','..mBBmmBBm..','..mBooooBm..','..mBBssBBm..',
    '..BBBBBBBB..','..BmmBBmmB..','..BBBmmBBB..','..BBmBBmBB..','...oo..oo...','............',
  ],
  healer: [
    '............','....nNNn....','...nNwwNn...','..nNwNNwNn..','..nnssssnn..','...soosss...',
    '...NNNNNN...','..NNNwwNNN..','..NNNwwNNN..','..nnNNNNnn..','...oo..oo...','............',
  ],
  adept: [
    '............','.....pp.....','....pPPp....','...pPPPPp...','..ppPPPPpp..','..pPssssPp..',
    '...sossso...','..ppPPPPpp..','..pPPwwPPp..','..pppPPppp..','...oo..oo...','............',
  ],
  archer: [
    '............','....tTTt....','...tTTTTt...','..tTssssTt..','..ttsoostt..','...tsssst...',
    '..tTTTTTTt..','..ttTttTtt..','..tTt..tTt..','..ttt..ttt..','...oo..oo...','............',
  ],
};
export function HeroSprite({id, compact = false}: {id: HeroId; compact?: boolean}) {
  const rows = HERO_SPRITES[id];
  return <svg className={compact ? 'pixel-portrait small' : 'pixel-portrait'} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
    {rows.flatMap((row, y) => [...row.trimEnd()].map((pixel, x) => pixel === '.' || !SPRITE_PALETTE[pixel] ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={SPRITE_PALETTE[pixel]}/>))}
  </svg>;
}

