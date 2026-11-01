import assert from 'node:assert/strict';
import test from 'node:test';
import { createHoleScoreRefresh } from '../lib/hole-score-refresh';
const row=(grossScore:number|null,holeNumber=1)=>({roundId:'r',teamId:'other',playerId:'p',holeNumber,grossScore});
const scope={roundId:'r',holeNumber:1,visibility:'OPEN',enabled:true};
test('a later read shows another phone score; missing gross remains null', async()=>{
 let database=[row(null)];const seen:any[]=[];
 const reader=createHoleScoreRefresh(scope,async()=>({hidden:false,scores:database}),{onData:data=>seen.push(data),onError:()=>assert.fail()});
 await reader.refresh();database=[row(5)];await reader.refresh();
 assert.equal(seen[0].scores[0].grossScore,null);assert.equal(seen[1].scores[0].grossScore,5);
});
test('a stopped hole reader cannot publish an old response into a new hole', async()=>{
 let finish!:(value:any)=>void;const seen:any[]=[];
 const reader=createHoleScoreRefresh(scope,()=>new Promise(resolve=>{finish=resolve}),{onData:data=>seen.push(data),onError:()=>assert.fail()});
 const pending=reader.refresh();reader.stop();finish({hidden:false,scores:[row(4)]});await pending;assert.deepEqual(seen,[]);
});
test('wrong-hole records fail closed instead of showing scores on the wrong hole',async()=>{
 let published=false,failed=false;
 const reader=createHoleScoreRefresh({...scope,holeNumber:2},async()=>({hidden:false,scores:[row(3)]}),{onData:()=>{published=true},onError:()=>{failed=true}});
 await reader.refresh();assert.equal(published,false);assert.equal(failed,true);
});
test('overlapping polls share one read and errors reach the status callback',async()=>{
 let reject!:(e:Error)=>void,calls=0,errors=0;
 const reader=createHoleScoreRefresh(scope,()=>{calls++;return new Promise((_,no)=>{reject=no})},{onData:()=>assert.fail(),onError:()=>{errors++}});
 const first=reader.refresh();await reader.refresh();assert.equal(calls,1);reject(new Error('offline'));await first;assert.equal(errors,1);
});
test('blind, unknown visibility and disabled readers never fetch other groups',async()=>{
 for(const candidate of [{...scope,visibility:'BLIND'},{...scope,visibility:undefined},{...scope,enabled:false}]){
  let calls=0;const reader=createHoleScoreRefresh(candidate,async()=>{calls++;return {hidden:true,scores:[]}},{onData:()=>assert.fail(),onError:()=>assert.fail()});await reader.refresh();assert.equal(calls,0);
 }
});

test('server visibility change clears already displayed scores even when client scope is OPEN', async()=>{
 let response={hidden:false,scores:[row(4)]};let displayed:any;
 const reader=createHoleScoreRefresh(scope,async()=>response,{onData:data=>{displayed=data},onError:()=>assert.fail()});
 await reader.refresh();assert.equal(displayed.scores.length,1);
 response={hidden:true,scores:[row(9)]};await reader.refresh();
 assert.deepEqual(displayed,{hidden:true,scores:[]});
});
