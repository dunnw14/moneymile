export type Choice={label:string;hint:string;cash:number;alex:number;heat:number;result:string;reaction:string;lesson:string;staff?:number;shop?:string};
export type Beat={title:string;prompt:string;alex:string;event?:{title:string;text:string;cash:number;alex:number};choices:[Choice,Choice]};
export const beats:Beat[]=[
 {title:'One shop. Your first call.',prompt:'You were dealt Mali and Golden Lotus. This shop is yours. How will you run tonight?',alex:'One shop? Try not to lose it before I get bored.',choices:[
  {label:'KEEP IT STEADY',hint:'+$180 net · low attention',cash:180,alex:220,heat:1,result:'Mali brings the regulars back. A clean first payout.',reaction:'Safe little start. I prefer ambition.',lesson:'Reliable earnings build a reserve.'},
  {label:'GO ALL-IN',hint:'+$320 net · more attention',cash:320,alex:220,heat:3,result:'Mali fills the appointment book. Your first gamble pays.',reaction:'Big night. Now everyone knows where you are.',lesson:'Bigger payouts make your shop more visible.'}]},
 {title:'He noticed your approach.',prompt:'Your earnings unlock one new decision: build your strength or hurt his.',alex:'I’ve seen your opening. Let’s see if you have a second move.',choices:[
  {label:'TRAIN MALI',hint:'$120 training · +$380 bookings',cash:260,alex:240,heat:0,result:'Training costs $120 and tonight brings $380. Mali earns more because you backed her.',reaction:'You’ve got favourites. I’ve got a strategy.',lesson:'Investment can turn a small advantage into repeatable income.'},
  {label:'STEAL HIS CUSTOMERS',hint:'$100 promotion · +$340 bookings · Alex loses $100',cash:240,alex:140,heat:1,result:'Your promotion costs $100 and brings $340. Alex’s expected $240 falls to $140.',reaction:'You want a fight? Good.',lesson:'An attack can change both sides of the score.'}]},
 {title:'Alex reveals a trick.',prompt:'Alex pairs friendly staff beside the hotel. His $480 night looks easy. But your backstreet shop has no hotel traffic.',alex:'Location, talent, timing. You remembered one of those.',choices:[
  {label:'COPY HIS PAIRING',hint:'Recruit Anong $200 · test it here',cash:10,alex:480,heat:0,staff:0,result:'Anong costs $200. Your team earns $210: only $10 net. Good staff cannot conjure hotel traffic.',reaction:'You copied the team. You forgot the street.',lesson:'A combination needs the right location. Anong stays on your team.'},
  {label:'COPY HIS ADVERTISING',hint:'Spend $150 · test it here',cash:90,alex:480,heat:1,result:'The campaign costs $150 and earns $240. Alex’s hotel trade still outperforms you.',reaction:'My customers are already next door. Yours need a reason to come.',lesson:'A tactic that works for Alex can underperform on different ground.'}]},
 {title:'His strength leaves an opening.',prompt:'Alex concentrated on the hotel. A Waterfront parlour is available—and its tourists suit Mali.',alex:'Take the waterfront if you want. I’m busy winning.',choices:[
  {label:'CLAIM BLUE ORCHID',hint:'$350 property · +$950 bookings',cash:600,alex:180,heat:1,shop:'Blue Orchid',result:'You pay $350 for the neglected parlour. Tourist bookings deliver $950. You found the missing ingredient.',reaction:'That property was meant to stay empty.',lesson:'Exploit the opportunity an opponent leaves behind.'},
  {label:'LEASE THE WATERFRONT',hint:'$180 lease · +$720 bookings',cash:540,alex:180,heat:1,shop:'Harbour Rooms',result:'A $180 lease gets your team into Harbour Rooms. The $720 night proves the location works.',reaction:'Enjoy the tourists. They don’t stay forever.',lesson:'A cheaper foothold can beat an expensive imitation.'}]},
 {title:'Your plan starts working.',prompt:'The waterfront is paying. Cash, confidence—and a rival with something to lose.',alex:'One lucky night isn’t an empire.',choices:[
  {label:'PUSH THE HOT STREAK',hint:'+$950 net · +3 attention',cash:950,alex:300,heat:3,result:'Full rooms. Big tips. Another $950 night. Your risk is rising alongside your lead.',reaction:'Keep making noise. Someone will notice.',lesson:'Momentum is tempting. Exposure grows with it.'},
  {label:'BUILD THE COMBINATION',hint:'$180 team investment · +$900 bookings',cash:720,alex:300,heat:1,staff:0,result:'You invest $180 in team coordination and earn $900. A $720 net night makes the plan feel repeatable.',reaction:'Fine. You found a combination. I’ll find its weak point.',lesson:'Chemistry turns location into sustained earning power.'}]},
 {title:'The city pushes back.',prompt:'Golden Lotus is temporarily closed. You still have your waterfront operation. Recover—or strike while Alex is exposed.',alex:'I warned you about being visible.',event:{title:'POLICE STRIKE',text:'Golden Lotus closes temporarily. You lose $450. Staff are safe and your waterfront shop remains open.',cash:-450,alex:-100},choices:[
  {label:'REOPEN THE SHOP',hint:'$150 recovery · +$500 bookings',cash:350,alex:180,heat:-3,result:'You spend $150 to reopen Golden Lotus and earn $500. The setback becomes a manageable cost.',reaction:'Back on your feet? I’ll remember to aim lower.',lesson:'Recovery is a strategic decision, not a restart.'},
  {label:'HIT HIS WEAK SIDE',hint:'$200 attack · +$500 waterfront income · Alex −$450',cash:300,alex:-450,heat:1,result:'Your $200 counterattack cancels Alex’s vulnerable bookings. Your open waterfront shop earns $500.',reaction:'That wasn’t clever. That was personal.',lesson:'An intact second income source gives you room to retaliate.'}]},
 {title:'Make him feel the pressure.',prompt:'A strategy card reveals Alex’s dependence on one star shop. Choose how to break that advantage.',alex:'Touch that shop and I’ll make you regret it.',choices:[
  {label:'PLAY BAD REVIEW',hint:'+$450 income · Alex −$600',cash:450,alex:-600,heat:0,result:'Your card empties Alex’s booking list. You collect $450 while his reserve takes a $600 hit.',reaction:'Those reviews are lies. Everyone knows it.',lesson:'Attack the dependency, rather than every property.'},
  {label:'PLAY BETTER OFFER',hint:'$200 contract · +$650 income · Alex −$500',cash:450,alex:-500,heat:1,staff:9,result:'Chaba accepts your $200 offer. Your income reaches $650; Alex loses $500 of projected business.',reaction:'She was my best operator. You knew that.',lesson:'A recruit can strengthen you and weaken your rival simultaneously.'}]},
 {title:'The second patrol is coming.',prompt:'This time you can read the warning. Alex is desperate, and the police route is visible.',alex:'I’m going All-in. You can hide if you want.',event:{title:'POLICE WARNING',text:'A second inspection is approaching the waterfront. You get to act before it arrives.',cash:0,alex:0},choices:[
  {label:'PLAY TIP-OFF',hint:'Protect the team · +$300 · Alex −$300',cash:300,alex:-300,heat:-3,result:'Your team steps out of the patrol’s path. You keep $300 while Alex loses $300 trying to force a comeback.',reaction:'How did you know they were coming?',lesson:'A visible threat creates an opportunity to plan ahead.'},
  {label:'PUSH ONE MORE NIGHT',hint:'+$600 bookings · $500 police loss',cash:100,alex:-300,heat:2,result:'The night earns $600, but the inspection takes $500. You keep $100. This time the cost was visible.',reaction:'At least you stopped pretending to be cautious.',lesson:'Knowing the risk does not make the risk disappear.'}]},
 {title:'Now you understand the board.',prompt:'Protect your lead with the knowledge you earned. Two good plans, different strengths.',alex:'You’re not making beginner mistakes anymore. Annoying.',choices:[
  {label:'SPREAD THE TEAM',hint:'$100 recovery · +$700 bookings',cash:600,alex:180,heat:-2,result:'Restoring both locations costs $100. They bring $700, so one patrol cannot shut down your whole plan.',reaction:'Pick a shop and stay there. This is getting tedious.',lesson:'Diversification protects against concentrated threats.'},
  {label:'FORTIFY THE WATERFRONT',hint:'$150 security · +$700 bookings',cash:550,alex:180,heat:-3,result:'Security costs $150 and your waterfront team earns $700. You defend the location that makes your strategy work.',reaction:'So that’s your fortress. Fine.',lesson:'Concentration can work when you deliberately defend it.'}]},
 {title:'The card you were waiting for.',prompt:'High Roller arrives. Luck helps—but your position determines what it can do.',alex:'Of course you draw that now.',choices:[
  {label:'CASH OUT THE BONUS',hint:'+$750 final cash',cash:750,alex:120,heat:0,result:'Your protected team converts the lucky booking into $750. The advantage survives the final night.',reaction:'Lucky card. Convenient memory of everything before it.',lesson:'A good position lets you keep a lucky gain.'},
  {label:'TURN IT INTO TERRITORY',hint:'$300 claim · +$850 bookings · new property',cash:550,alex:120,heat:1,shop:'Jade Garden',result:'You spend $300 to claim Jade Garden and earn $850. Luck becomes both income and a lasting asset.',reaction:'You’re taking the street now? Unbelievable.',lesson:'You decide whether a windfall becomes cash or control.'}]},
];
export type StoryState={version:1;screen:'intro'|'draft'|'reveal'|'turn'|'choice'|'result'|'ending';beat:number;cash:number;alexCash:number;heat:number;crew:number[];shops:string[];closed:boolean;history:{beat:number;choice:number;cash:number;alex:number}[];lastChoice:number|null;turnStage?:'placement'|'night'|'carddraw'|'cardplay'|'cash'|'end';assignments?:Record<number,string>;drawnCard?:number;turnNote?:string;nightBonus?:number;trainingBonus?:number;draftBudget?:number;alexCrew?:number[];alexBudget?:number};
export const freshStory=():StoryState=>({version:1,screen:'intro',draftBudget:1800,alexBudget:1800,alexCrew:[],beat:0,cash:600,alexCash:600,heat:0,crew:[1],shops:['Golden Lotus'],closed:false,history:[],lastChoice:null});
export function startStory(g:StoryState):StoryState{return g.screen==='intro'?{...g,screen:'choice'}:g;}
export function chooseStory(g:StoryState,index:number):StoryState{if(g.screen!=='choice'||(index!==0&&index!==1))return g;const c=storyBeat(g).choices[index];return{...g,screen:'result',alexCrew:c.staff!==undefined?(g.alexCrew??[]).filter(i=>i!==c.staff):g.alexCrew,cash:Math.max(0,g.cash+c.cash),alexCash:Math.max(0,g.alexCash+c.alex),heat:Math.max(0,g.heat+c.heat),crew:c.staff!==undefined&&!g.crew.includes(c.staff)?[...g.crew,c.staff]:g.crew,shops:c.shop&&!g.shops.includes(c.shop)?[...g.shops,c.shop]:g.shops,closed:(g.beat===5||g.beat===8)&&index===0?false:g.closed,history:[...g.history,{beat:g.beat,choice:index,cash:c.cash,alex:c.alex}],lastChoice:index};}
export function continueStory(g:StoryState):StoryState{if(g.screen!=='result')return g;if(g.beat===beats.length-1)return{...g,screen:'ending'};const beat=g.beat+1,event=beats[beat].event;return{...g,beat,screen:'choice',lastChoice:null,cash:Math.max(0,g.cash+(event?.cash??0)),alexCash:Math.max(0,g.alexCash+(event?.alex??0)),closed:beat===5?true:g.closed};}

export const draftPool=[1,0,2,3,6,9];
const draftPrices:Record<number,number>={1:700,0:450,2:650,3:1800,6:950,9:800};
export function openDraft(g:StoryState):StoryState{return g.screen==='intro'?{...g,screen:'draft',crew:[]}:g;}
export function recruitDraft(g:StoryState,index:number):StoryState {
 if(g.screen!=='draft'||!draftPool.includes(index)||g.crew.length>=3||g.crew.includes(index)||g.alexCrew?.includes(index)||(g.draftBudget??0)<draftPrices[index])return g;
 const crew=[...g.crew,index],draftBudget=(g.draftBudget??0)-draftPrices[index];
 const alexCrew=[...(g.alexCrew??[])];let alexBudget=g.alexBudget??1800;
 const reply=[6,2,9,0,1,3].find(i=>!crew.includes(i)&&!alexCrew.includes(i)&&draftPrices[i]<=alexBudget);
 if(reply!==undefined&&alexCrew.length<3){alexCrew.push(reply);alexBudget-=draftPrices[reply];}
 return {...g,crew,draftBudget,alexCrew,alexBudget};
}
export function finishDraft(g:StoryState):StoryState{return g.screen==='draft'&&g.crew.length>0?{...g,screen:'reveal'}:g;}

export function beginNight(g:StoryState):StoryState{return g.screen==='reveal'?{...g,screen:'choice'}:g;}
export function storyBeat(g:StoryState):Beat {
 const leader=staffName[g.crew[0]??1]??'Your captain';
 const b=JSON.parse(JSON.stringify(beats[g.beat]).replaceAll('Mali',leader)) as Beat;
 if(g.beat===0)b.prompt='Siriporn has your team ready at Golden Lotus. Your first call: steady bookings or a bigger, louder night?';
 for(const c of b.choices){
  if(c.staff!==undefined&&g.crew.includes(c.staff)){
   const name=staffName[c.staff];
   c.result=c.staff===0?(g.beat===2?name+' is already on your team. A $200 pairing workshop earns $210 here: only $10 net. Without hotel traffic, copying Alex underperforms.':name+' coordinates your existing team. The $180 investment delivers $900 in bookings.'):'Chaba is already yours. You invest $200 in her campaign, earn $650, and take $500 of business from Alex.';
   if(g.beat===2){c.label='COPY HIS TEAMWORK';c.hint='$200 pairing workshop · test it here';}
   if(g.beat===6){c.label='PLAY STAR CAMPAIGN';c.hint='$200 campaign · +$650 income · Alex −$500';}
   delete c.staff;
  } else if(c.staff!==undefined&&g.alexCrew?.includes(c.staff)){
   c.result=c.result.replace('Anong costs $200.','Anong accepts your $200 counteroffer and leaves Alex.').replace('Chaba accepts your $200 offer.','Chaba leaves Alex for your $200 offer.');
  }
 }
 return b;
}
const staffName:Record<number,string>={0:'Anong',1:'Mali',2:'Dao',3:'Nok',6:'Kanya',9:'Chaba'};

export const turnCards=[{name:'VIP Booking',text:'Play on your shop: collect $150 extra income.',cash:150,alex:0,heat:1},{name:'Bad Review',text:'Play on Imperial House: Alex loses $200 immediately.',cash:0,alex:-200,heat:0},{name:'Tip-Off',text:'Protect your team: remove 3 attention and collect $100.',cash:100,alex:0,heat:-3}];
export function enterTurn(g:StoryState):StoryState{return {...g,screen:'turn',turnStage:'placement',assignments:{},turnNote:'',nightBonus:0};}
export function placeWorker(g:StoryState,worker:number,shop:string):StoryState{if(g.screen!=='turn'||g.turnStage!=='placement'||!g.crew.includes(worker)||!g.shops.includes(shop)||(shop==='Golden Lotus'&&g.closed))return g;return {...g,assignments:{...g.assignments,[worker]:shop}};}
export function lockPlacement(g:StoryState):StoryState{if(g.turnStage!=='placement'||!g.crew.every(i=>g.assignments?.[i]&&g.shops.includes(g.assignments[i])&&!(g.closed&&g.assignments[i]==='Golden Lotus')))return g;return {...g,turnStage:'night'};}
export function resolveTurnNight(g:StoryState,index:number):StoryState{if(g.screen!=='turn'||g.turnStage!=='night'||(index!==0&&index!==1))return g;const bonus=g.crew.reduce((n,i)=>n+(g.assignments?.[i]!=='Golden Lotus'?25:0),0)+(g.trainingBonus??0);const next=chooseStory({...g,screen:'choice'},index);return {...next,screen:'turn',turnStage:'carddraw',cash:next.cash+bonus,nightBonus:bonus,turnNote:storyBeat(g).choices[index].result};}
export function drawTurnCard(g:StoryState):StoryState{return g.screen==='turn'&&g.turnStage==='carddraw'?{...g,turnStage:'cardplay',drawnCard:g.beat%turnCards.length}:g;}
export function playTurnCard(g:StoryState):StoryState{if(g.screen!=='turn'||g.turnStage!=='cardplay'||g.drawnCard===undefined)return g;const c=turnCards[g.drawnCard];return {...g,turnStage:'cash',cash:g.cash+c.cash,alexCash:Math.max(0,g.alexCash+c.alex),heat:Math.max(0,g.heat+c.heat),turnNote:c.name+' played. '+c.text};}
export function allocateTurnCash(g:StoryState,action:'save'|'train'|'property'):StoryState{if(g.screen!=='turn'||g.turnStage!=='cash')return g;if(action==='train'&&g.cash<150)return g;if(action==='property'&&(g.cash<500||g.shops.includes('Jade Garden')))return g;return {...g,turnStage:'end',cash:g.cash-(action==='train'?150:action==='property'?500:0),trainingBonus:(g.trainingBonus??0)+(action==='train'?50:0),shops:action==='property'?[...g.shops,'Jade Garden']:g.shops,turnNote:action==='save'?'Cash banked. Your reserve is ready for the next turn.':action==='train'?'Training funded: every future night earns an extra $50.':'Jade Garden purchased for $500. You can assign staff there next turn.'};}
export function endTurn(g:StoryState):StoryState{if(g.screen!=='turn'||g.turnStage!=='end')return g;const next=continueStory({...g,screen:'result'});return next.screen==='ending'?next:enterTurn(next);}
