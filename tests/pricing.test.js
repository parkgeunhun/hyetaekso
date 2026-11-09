import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { calculate,pickSupport,supportSignature } from '../backend/src/catalog.js';

const row={id:'one',carrier_id:'skt',plan_id:'5g',price:1000001,fee:69001,extra:180000,support:310000,support_known:true};
test('legacy support and contract preserve ceil installment and floor plan discount',()=>{
  assert.deepEqual(calculate(row,'support',24),{principal:510001,discount:0,installment:21251,monthly:90252,support:310000,pending:false,months:24,mode:'support'});
  assert.equal(calculate(row,'contract',30).monthly,79085);
  assert.equal(calculate({...row,extra:800000},'support',36).principal,0);
  assert.throws(()=>calculate(row,'support',12),/할부/);
});
test('known zero differs from unknown and expired manual overrides fall back to source',()=>{
  const now=10000000,signature=supportSignature(row),make=(mode,amount,expires_at)=>({mode,amount,source:mode,expires_at,updated_at:now-1,signature});
  const feed=make('feed',220000,now+100);
  assert.deepEqual(pickSupport(row,[feed,make('manual',0,now+1)],now),{support:0,support_known:true,support_source:'manual'});
  assert.equal(pickSupport(row,[feed,make('manual',1,now)],now).support,220000);
  assert.equal(pickSupport({...row,fee:70000},[feed],now).support_known,false);
});
test('matches WordPress PHP for support/contract and 24/30/36 months',{skip:!process.env.LEGACY_PHP},()=>{
  const php=process.env.LEGACY_PHP;
  const code=`function ps_quote($row,$mode='support',$months=24) {
    $price=(int)($row['price']??0); $extra=(int)($row['extra']??0); $support=$mode==='support'&&!empty($row['support_known'])?(int)($row['support']??0):0;
    $principal=max(0,$price-$extra-$support); $fee=(int)($row['fee']??0); $discount=$mode==='contract'?(int)floor($fee*0.25):0;
    $pending=$mode==='support' && empty($row['support_known']);
    return ['support'=>$support,'pending'=>$pending,'principal'=>$principal,'discount'=>$discount,'monthly'=>(int)ceil($principal/$months)+$fee-$discount,'months'=>$months];
  } $rows=json_decode(file_get_contents('php://stdin'),true); echo json_encode(array_map(fn($r)=>ps_quote(...$r),$rows));`;
  const inputs=[row,{...row,support_known:false},{...row,extra:950000},{...row,support:0}].flatMap(r=>['support','contract'].flatMap(mode=>[24,30,36].map(months=>[r,mode,months])));
  const result=spawnSync(php,['-n','-r',code],{input:JSON.stringify(inputs),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const actual=inputs.map(input=>{const {installment,mode,...legacy}=calculate(...input);return legacy;});
  assert.deepEqual(actual,JSON.parse(result.stdout));
});
