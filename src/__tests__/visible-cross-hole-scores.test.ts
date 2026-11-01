import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function loadAction(visibility:string|null) {
 let scoreReads=0,transactionIsolation='';
 const actionModule={exports:{} as any};
 const source=readFileSync(new URL('../actions/visible-cross-hole-scores.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const prisma={$transaction:async(callback:any,options:any)=>{
  transactionIsolation=options.isolationLevel;
  return callback({round:{findUnique:async()=>visibility===null?null:{visibility}},playerScore:{findMany:async()=>{scoreReads++;return [{roundId:'r',teamId:'t',playerId:'p',holeNumber:1,grossScore:4}]}}});
 }};
 new Function('require','module','exports',code)((name:string)=>name==='@prisma/client'?{Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}}}:{prisma},actionModule,actionModule.exports);
 return {read:actionModule.exports.getVisibleCrossHoleScores,reads:()=>scoreReads,isolation:()=>transactionIsolation};
}
test('server refuses blind and missing rounds before reading any individual scores',async()=>{
 for(const visibility of ['BLIND',null]){const action=loadAction(visibility);assert.deepEqual(await action.read('r',1),{hidden:true,scores:[]});assert.equal(action.reads(),0);}
});
test('OPEN score data is read in a serializable visibility-check transaction',async()=>{
 const action=loadAction('OPEN');const result=await action.read('r',1);assert.equal(result.hidden,false);assert.equal(result.scores[0].grossScore,4);assert.equal(action.isolation(),'Serializable');
});
test('invalid holes fail before entering score reads',async()=>{
 const action=loadAction('OPEN');await assert.rejects(()=>action.read('r',19));assert.equal(action.reads(),0);
});
