import { describe, expect, it } from 'vitest';
import { enterTurn,placeWorker,lockPlacement,resolveTurnNight,drawTurnCard,playTurnCard,allocateTurnCash,endTurn,beginNight, storyBeat, openDraft, recruitDraft, finishDraft, beats, chooseStory, continueStory, freshStory, startStory } from '../demo/story';

describe('authored rivalry demo', () => {
  it('finishes every possible choice route with a player victory', () => {
    for (let route = 0; route < 2 ** beats.length; route++) {
      let g = startStory(freshStory());
      for (let turn = 0; turn < beats.length; turn++) {
        g = continueStory(chooseStory(g, (route >> turn) & 1));
        expect(g.cash).toBeGreaterThanOrEqual(0);
        expect(g.alexCash).toBeGreaterThanOrEqual(0);
        expect(g.heat).toBeGreaterThanOrEqual(0);
      }
      expect(g.screen).toBe('ending');
      expect(g.history).toHaveLength(10);
      expect(g.cash).toBeGreaterThan(g.alexCash);
      expect(new Set(g.crew).size).toBe(g.crew.length);
      expect(new Set(g.shops).size).toBe(g.shops.length);
    }
  });
  it('rejects repeated choices, skips and invalid input', () => {
    const intro = freshStory();
    expect(chooseStory(intro, 0)).toBe(intro);
    const opening = startStory(intro);
    expect(continueStory(opening)).toBe(opening);
    expect(chooseStory(opening, 2)).toBe(opening);
    const result = chooseStory(opening, 0);
    expect(chooseStory(result, 1)).toBe(result);
    expect(result.cash).toBe(780);
    expect(chooseStory(opening, 1).cash).toBe(920);
  });
  it('applies the police loss once and preserves a recovery decision', () => {
    let g = startStory(freshStory());
    for (let i = 0; i < 4; i++) g = continueStory(chooseStory(g, 0));
    const before = chooseStory(g, 0);
    g = continueStory(before);
    expect(g.cash).toBe(before.cash - 450);
    expect(g.closed).toBe(true);
    expect(continueStory(g)).toBe(g);
    expect(chooseStory(g, 0).closed).toBe(false);
    expect(chooseStory(g, 1).closed).toBe(true);
    expect(g.shops).toContain('Blue Orchid');
  });
});

describe('opening team draft',()=>{
 it('shares recruits with Alex, enforces budgets and requires a team',()=>{
 const g=openDraft(freshStory());expect(g.screen).toBe('draft');expect(g.crew).toEqual([]);expect(finishDraft(g)).toBe(g);
 const n=recruitDraft(g,1);expect(n.draftBudget).toBe(1100);expect(n.alexCrew).toEqual([6]);expect(recruitDraft(n,6)).toBe(n);expect(recruitDraft(n,1)).toBe(n);expect(finishDraft(n).screen).toBe('reveal');expect(beginNight(finishDraft(n)).screen).toBe('choice');
 const star=recruitDraft(g,3);expect(star.draftBudget).toBe(0);expect(recruitDraft(star,0)).toBe(star);expect(star.cash).toBe(600);
 });
});

describe('draft-aware emotional arc',()=>{
 it('completes every story route after each possible first recruit',()=>{
 for(const recruit of [0,1,2,3,6,9])for(let route=0;route<1024;route++){
 let g=beginNight(finishDraft(recruitDraft(openDraft(freshStory()),recruit)));
 for(let turn=0;turn<10;turn++){g=continueStory(chooseStory(g,(route>>turn)&1));expect(g.crew.some(i=>g.alexCrew?.includes(i))).toBe(false);}
 expect(g.screen).toBe('ending');expect(g.cash).toBeGreaterThan(g.alexCash);
 }
 });
 it('turns an existing recruit into training instead of a duplicate hire',()=>{
 let g=beginNight(finishDraft(recruitDraft(openDraft(freshStory()),0)));
 g=continueStory(chooseStory(g,0));g=continueStory(chooseStory(g,0));
 expect(storyBeat(g).choices[0].staff).toBeUndefined();expect(storyBeat(g).choices[0].label).toBe('COPY HIS TEAMWORK');
 });
});

describe('full playable turn sequence',()=>{
 it('requires placement, spin, draw, card play and cash allocation before ending',()=>{
 let g=enterTurn(beginNight(finishDraft(recruitDraft(openDraft(freshStory()),1))));
 expect(endTurn(g)).toBe(g);expect(lockPlacement(g)).toBe(g);
 g=placeWorker(g,1,'Golden Lotus');g=lockPlacement(g);
 expect(g.turnStage).toBe('night');g=resolveTurnNight(g,0);
 expect(g.turnStage).toBe('carddraw');const payout=g.cash;
 expect(playTurnCard(g)).toBe(g);g=drawTurnCard(g);g=playTurnCard(g);
 expect(g.cash).toBe(payout+150);expect(playTurnCard(g)).toBe(g);
 g=allocateTurnCash(g,'train');expect(g.trainingBonus).toBe(50);
 expect(g.turnStage).toBe('end');g=endTurn(g);
 expect(g.beat).toBe(1);expect(g.turnStage).toBe('placement');
 });
 it('completes all ten full turns, including both police chapters',()=>{
 let g=enterTurn(beginNight(finishDraft(recruitDraft(openDraft(freshStory()),3))));
 for(let turn=0;turn<10;turn++){
 const shop=g.shops.find(s=>!(g.closed&&s==='Golden Lotus'))!;
 for(const worker of g.crew)g=placeWorker(g,worker,shop);
 g=lockPlacement(g);g=resolveTurnNight(g,turn%2);g=drawTurnCard(g);g=playTurnCard(g);g=allocateTurnCash(g,'save');g=endTurn(g);
 }
 expect(g.screen).toBe('ending');expect(g.history).toHaveLength(10);expect(g.cash).toBeGreaterThan(g.alexCash);
 });
});
