import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CrossHolePanel} from '../components/cross-hole-panel';
const props={holeNumber:8,par:4,handicapRank:2,netScoring:true,handicapMode:'full' as const,players:[{playerId:'a',name:'Alex',group:'Red Cart'},{playerId:'b',name:'Sam',group:'Blue Cart'}],ownPlayerIds:['a'],handicapIndexes:{a:10,b:2},grossScores:{a:5,b:null},games:[{id:'first6',label:'First 6',holeNumbers:[1,2,3,4,5,6],pairs:[{virtualTeamId:'1',playerIds:['a','b']}]},{id:'second6',label:'Second 6',holeNumbers:[7,8,9,10,11,12],pairs:[{virtualTeamId:'2',playerIds:['a','b']}]},{id:'third6',label:'Third 6',holeNumbers:[13,14,15,16,17,18],pairs:[{virtualTeamId:'3',playerIds:['a','b']}]},{id:'overall18',label:'Overall 18',holeNumbers:Array.from({length:18},(_,i)=>i+1),pairs:[{virtualTeamId:'4',playerIds:['a','b']}]}],hidden:false,loading:false,error:null,lastUpdated:null,onRefresh:()=>{}};
test('shows all four partner assignments and marks only applicable segments active',()=>{const html=renderToStaticMarkup(<CrossHolePanel {...props}/>);for(const label of ['First 6','Second 6','Third 6','Overall 18'])assert.match(html,new RegExp(label));assert.equal((html.match(/Counts on this hole/g)||[]).length,2);});
test('shows strokes, saved gross and net, partner physical group and missing score as pending',()=>{const html=renderToStaticMarkup(<CrossHolePanel {...props}/>);assert.match(html,/Gets 1 shot/);assert.match(html,/Gross 5/);assert.match(html,/Net 4/);assert.match(html,/Blue Cart/);assert.match(html,/Waiting for both scores/);assert.doesNotMatch(html,/Best ball 4/);});
test('blind rounds never display supplied opponent numbers',()=>{const html=renderToStaticMarkup(<CrossHolePanel {...props} hidden={true} grossScores={{a:5,b:2}}/>);assert.match(html,/Scores hidden/);assert.doesNotMatch(html,/Gross [25]/);});
test('complete pair shows best ball but not a winner claim',()=>{const html=renderToStaticMarkup(<CrossHolePanel {...props} grossScores={{a:5,b:4}}/>);assert.match(html,/Best net ball 3/);assert.doesNotMatch(html,/Winner/);});
test('integration reads current course hole metadata rather than a potentially old fetched hole',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../app/rounds/[id]/scoring/page.tsx',import.meta.url),'utf8');
 const panel=source.slice(source.indexOf('<CrossHolePanel'),source.indexOf('/>',source.indexOf('<CrossHolePanel')));
 assert.match(panel,/par=\{holeInfo\.par\}/);assert.match(panel,/handicapRank=\{holeInfo\.handicapRank\}/);
});
test('unknown handicap never invents net score and plus handicaps show given shots',()=>{
 const unknown=renderToStaticMarkup(<CrossHolePanel {...props} handicapIndexes={{a:null,b:2}} grossScores={{a:5,b:4}}/>);
 assert.match(unknown,/Handicap unavailable/);assert.match(unknown,/Net pending/);assert.match(unknown,/Waiting for both scores/);
 const plus=renderToStaticMarkup(<CrossHolePanel {...props} handicapRank={18} handicapIndexes={{a:-1,b:2}} grossScores={{a:5,b:4}}/>);
 assert.match(plus,/Gives 1 shot/);assert.match(plus,/Net 6/);
});
test('gross games do not claim handicap adjustments or turn empty scores into zero',()=>{
 const html=renderToStaticMarkup(<CrossHolePanel {...props} netScoring={false} grossScores={{a:0,b:4}}/>);
 assert.doesNotMatch(html,/Gross 0|Net 4|Gets 1 shot/);assert.match(html,/Pending/);assert.match(html,/Waiting for both scores/);
});
test('offers a direct path back to score entry above partner detail',()=>{
 const html=renderToStaticMarkup(<CrossHolePanel {...props}/>);assert.match(html,/href="#current-hole-score-entry"/);assert.match(html,/Enter this hole/);
});
test('phone layout provides a compact shot grid and wrapping names',()=>{
 const html=renderToStaticMarkup(<CrossHolePanel {...props}/>);assert.match(html,/grid grid-cols-2/);assert.match(html,/break-words/);assert.match(html,/text-2xl font-bold/);
});
test('phone entry uses large numeric targets and collapses the full stroke table',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../app/rounds/[id]/scoring/page.tsx',import.meta.url),'utf8');
 assert.match(source,/Full stroke allocation/);assert.match(source,/min-h-12 w-24 shrink-0/);
});
