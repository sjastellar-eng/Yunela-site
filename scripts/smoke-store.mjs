// Built-runtime smoke. Refuses any environment that isn't the explicit offline simulator.
const base=process.env.YUNELA_SMOKE_URL??'http://127.0.0.1:3000';
async function call(path,token,method='GET',data){const r=await fetch(base+'/api/store'+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data)});const b=await r.json();if(!r.ok)throw new Error(`${path}: ${r.status} ${b.error?.message}`);return b;}
const health=await (await fetch(base+'/health')).json();
if(health.paymentMode!=='offline-test'||health.partnerDispatch!=='disabled')throw new Error('Unsafe smoke target');
const html=await (await fetch(base)).text();if(!html.includes('id="root"'))throw new Error('Static UI missing');
const catalogue=await call('/catalog');const fixture=catalogue.items.find(p=>p.sku==='TEST-ONLY'&&p.testFixture);
if(!fixture)throw new Error('Explicit TEST-ONLY fixture required');
const guest=await call('/session',undefined,'POST',{}), token=guest.token;
await call('/cart/items',token,'POST',{sku:fixture.sku,quantity:1});
const quote=await call('/quote',token,'POST',{});
const created=await call('/orders',token,'POST',{idempotencyKey:crypto.randomUUID(),quoteId:quote.id,shipping:{recipientName:'Synthetic test',phone:'+380000000000',city:'Test city',addressLine1:'Test address',postalCode:'00000'},brandingRequested:true});
const attempt=await call(`/orders/${created.order.id}/payment`,token,'POST',{idempotencyKey:crypto.randomUUID()});
await call(`/payments/${attempt.id}/test-result`,token,'POST',{result:'success'});
const login=await call('/operator/login',undefined,'POST',{email:process.env.YUNELA_SMOKE_OPERATOR_EMAIL??'operator@example.test',password:process.env.YUNELA_SMOKE_OPERATOR_PASSWORD??'local-operator-test-123'});
for(const status of ['QUEUED_TEST','PACKING','SHIPPED','DELIVERED'])await call(`/operator/orders/${created.order.id}/task`,login.token,'PATCH',{status,tracking:'TEST-SMOKE-TRACK',brandingConfirmed:true});
const view=await call(`/orders/${created.order.id}`,token);
if(view.task.status!=='DELIVERED'||view.payment.state!=='SUCCEEDED')throw new Error('Final state mismatch');
console.log(JSON.stringify({result:'PASS',catalogueEntries:catalogue.items.length,sourceCandidates:catalogue.items.filter(x=>!x.testFixture).length,staticUI:true,offlinePayment:true,dispatchDisabled:true,finalStatus:view.task.status,orderId:view.order.id}));
