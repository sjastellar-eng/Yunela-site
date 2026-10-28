/* global document, innerWidth, scrollTo, process, URL, console */
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const phase=process.argv[2]??'after';
const out=`docs/list-batch-04-staging-13/${phase}`;
mkdirSync(out,{recursive:true});
const gallery=JSON.parse(readFileSync('content/creative-gallery.v1.json','utf8'));
const browser=await chromium.launch({executablePath:'/tmp/yunela-headless/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
const report=[];
try {
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},ignoreHTTPSErrors:true,reducedMotion:'reduce',deviceScaleFactor:1});
  const p=await context.newPage(); p.setDefaultTimeout(45000);
  const errors=[],consoleErrors=[],failed=[],badResponses=[],api=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  p.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()}));
  p.on('response',r=>{if(r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
  p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
  await p.goto('https://yunela-v92-demo.onrender.com');
  await p.locator('.store-grid article').nth(55).waitFor();
  assert.equal(await p.getByRole('button',{name:'До кошика',exact:true}).count(),0);
  const checks=[];
  async function decodeVisible(){
   await p.evaluate(async()=>{await document.fonts.ready;for(const img of [...document.images]){const r=img.getBoundingClientRect();if(r.width&&r.height&&r.top<1000&&r.bottom>0)await img.decode();}});
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
  }
  for(let i=17;i<=21;i++){
   const sku=`LIST-${String(i).padStart(3,'0')}`;
   await p.locator('#tea-search').fill(sku);
   assert.equal(await p.locator('.store-grid article').count(),1);
   await p.locator('.store-grid article').scrollIntoViewIfNeeded();
   await decodeVisible();
   await p.screenshot({path:`${out}/${width}-${sku}-catalog.png`});
   await p.locator('.product-open').click();
   assert.equal(await p.locator('.product-page').getAttribute('data-source-sku'),sku);
   await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   await decodeVisible();
   const assets=gallery.products.find(x=>x.sourceSku===sku).images;
   const stages=[];
   for(let j=0;j<assets.length;j++){
    if(j>0)await p.locator('.gallery-thumbnails button').nth(j).click();
    const img=p.locator('.gallery-stage img');
    await img.evaluate(async e=>{await e.decode();});
    const actual=await img.evaluate(e=>({src:e.currentSrc,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,srcset:e.srcset,sizes:e.sizes,rect:{width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}}));
    assert.equal(new URL(actual.src).pathname.startsWith('/creative/'+sku),true);
    if(phase==='after'){const u=new URL(actual.src), expected=[assets[j],...(assets[j].variants??[])].find(a=>a.path===u.pathname);assert(expected,'Unexpected image assignment');assert.equal(u.searchParams.get('v'),expected.sha256.slice(0,16));}
    assert(actual.naturalWidth>0&&actual.naturalHeight>0);
    await decodeVisible();
    await p.screenshot({path:`${out}/${width}-${sku}-gallery-${j+1}.png`});
    stages.push({...actual,role:assets[j].role});
   }
   if(assets.length>1)await p.locator('.gallery-thumbnails button').first().click();
   await decodeVisible();
   await p.screenshot({path:`${out}/${width}-${sku}-product.png`,fullPage:true});
   checks.push({sku,status:'PASS',galleryImages:stages});
   await p.getByRole('button',{name:'Назад до каталогу',exact:true}).click();
  }
  assert.deepEqual(errors,[]); assert.deepEqual(consoleErrors,[]); assert.deepEqual(failed,[]); assert.deepEqual(badResponses,[]); assert.deepEqual(api,[]);
  report.push({width,checks,errors,consoleErrors,failed,badResponses,api,status:'PASS'});
  await context.close(); console.log(`${phase} ${width}px PASS`);
 }
 writeFileSync(`${out}/browser-results.json`,JSON.stringify({browser:await browser.version(),phase,report},null,2)+'\n');
}finally{await browser.close();}
