import { useState } from 'react';
import { Portrait } from '@/simple/Portrait';
import { staff } from '@/simple/monopoly';
import type { StoryState } from './story';

type Tile={name:string;district:string;icon:string;corner?:boolean;shop?:string;detail:string};
const ring:Tile[]=[
 {name:'OPENING NIGHT',district:'corner',icon:'🌙',corner:true,detail:'Start with Siriporn and Golden Lotus. Build your team, then run the night.'},
 {name:'Golden Lotus',shop:'Golden Lotus',district:'backstreet',icon:'🏮',detail:'Your home base. Bold earnings bring police attention.'},
 {name:'Night Market',district:'backstreet',icon:'🍜',detail:'Backstreet foot traffic. This city landmark is scenery in the story demo.'},
 {name:'Neon Alley',district:'backstreet',icon:'✨',detail:'High visibility, high exposure. This landmark introduces the district’s character.'},
 {name:'POLICE HQ',district:'corner police',icon:'🚔',corner:true,detail:'Chapter six closes Golden Lotus. Chapter eight gives you warning before the next inspection.'},
 {name:'Imperial House',shop:'Imperial House',district:'hotel',icon:'♜',detail:'Alex’s hotel connection feeds bookings. One strong shop is also one big dependency.'},
 {name:'Grand Hotel',district:'hotel',icon:'🏨',detail:'Hotel traffic is why Alex’s pairing works here and underperforms in the backstreets.'},
 {name:'Hotel Arcade',district:'hotel',icon:'💎',detail:'Premium hotel district. A city landmark rather than a purchasable story property.'},
 {name:'STRATEGY',district:'corner',icon:'🃏',corner:true,detail:'Later chapters unlock attacks, a tip-off and the lucky High Roller card.'},
 {name:'Jade Garden',shop:'Jade Garden',district:'waterfront',icon:'🌿',detail:'The final windfall can become territory here instead of cash.'},
 {name:'Harbour Rooms',shop:'Harbour Rooms',district:'waterfront',icon:'⚓',detail:'A cheaper waterfront lease. Chapter four lets you choose this foothold.'},
 {name:'Blue Orchid',shop:'Blue Orchid',district:'waterfront',icon:'🌊',detail:'An unclaimed waterfront opportunity. Buying here turns your location lesson into income.'},
 {name:'PAYDAY',district:'corner',icon:'💵',corner:true,detail:'Nightly results change both cash scores. Protect your gains and attack Alex’s income.'},
 {name:'Ferry Pier',district:'waterfront',icon:'⛴',detail:'Tourists feed the waterfront. This city landmark explains the district advantage.'},
 {name:'Lantern Street',district:'backstreet',icon:'🏮',detail:'The route back to Golden Lotus. District colour shows the strategic character of each street.'},
 {name:'Team House',district:'backstreet',icon:'♥',detail:'Siriporn manages your drafted team. Staff remain visible inside the properties they work.'},
];
const positions=[[1,1],[1,2],[1,3],[1,4],[1,5],[2,5],[3,5],[4,5],[5,5],[5,4],[5,3],[5,2],[5,1],[4,1],[3,1],[2,1]];
export function MonopolyBoard({game:g}:{game:StoryState}){
 const [selected,setSelected]=useState(1);const tile=ring[selected];
 const owned=(t:Tile)=>!!t.shop&&g.shops.includes(t.shop);
 const team=(t:Tile)=>t.shop&&g.assignments&&t.shop!=='Imperial House'?g.crew.filter(i=>g.assignments?.[i]===t.shop):t.shop==='Imperial House'?(g.alexCrew??[]):!owned(t)?[]:t.shop==='Golden Lotus'?g.crew.filter((_,j)=>g.shops.length===1||j===1):t.shop===g.shops[1]?g.crew.filter((_,j)=>j!==1):[];
 const owner=(t:Tile)=>owned(t)?'♛ YOUR SHOP':t.shop==='Imperial House'?'♜ ALEX':t.shop?'◇ AVAILABLE':t.corner?'LANDMARK':'CITY LOCATION';
 return <div className="mm-ring-board" aria-label="Monopoly-style city board">
 {ring.map((t,i)=><button type="button" key={t.name} onClick={()=>setSelected(i)} aria-pressed={selected===i} className={`mm-ring-tile ${t.district} ${t.corner?'corner':''} ${owned(t)?'owned':t.shop==='Imperial House'?'rival':''} ${selected===i?'selected':''} ${t.shop==='Golden Lotus'&&g.closed?'shut':''}`} style={{gridRow:positions[i][0],gridColumn:positions[i][1]}}><span className="mm-ring-band">{owner(t)}</span><b>{t.name}</b><span className="mm-ring-icon">{t.icon}</span>{team(t).length>0&&<span className="mm-ring-crew">{team(t).map(i=><Portrait key={i} index={i} name={staff[i].name} small/>)}</span>}{t.shop==='Golden Lotus'&&g.closed&&<strong className="mm-ring-closed">CLOSED</strong>}</button>)}
 <section className="mm-ring-centre"><span className="story-eyebrow">MASSAGE MONOPOLY · CITY BOARD</span><h2>The Money Mile</h2><div className="mm-ring-key"><span>● YOUR SHOPS</span><span>● ALEX</span><span>◇ AVAILABLE</span></div><div className="mm-ring-detail"><span className="story-eyebrow">{owner(tile)}</span><h3>{tile.icon} {tile.name}</h3><p>{tile.detail}</p>{tile.shop==='Golden Lotus'&&<div className="story-manager"><Portrait index={11} name="Siriporn" small/><span>Siriporn · your Mamasan<br/><b>{g.closed?'Police closure · staff safe':'Your starting shop'}</b></span></div>}<div className="story-room">{team(tile).map(i=><div key={i}><Portrait index={i} name={staff[i].name}/><b>{staff[i].name}</b></div>)}</div></div><small>Tap a space to inspect it. Make your move using the two choices below.</small><div className="mm-ring-risk">🚔 {g.closed?'Golden Lotus closed':g.beat>=7?'Waterfront patrol warning':`Attention: ${g.heat}`}</div></section>
 </div>;
}
