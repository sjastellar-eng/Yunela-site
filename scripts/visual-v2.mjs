import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
/* global document, window, innerWidth */
const out=resolve('artifacts/visual-v2');mkdirSync(out,{recursive:true});
const password=randomBytes(20).toString('hex'),base='http://127.0.0.1:3093';
const server=spawn(process.execPath,['dist-server/f3-runtime.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:'3093',NODE_ENV:'staging',YUNELA_STAGE_MODE:'1',YUNELA_PUBLIC_ORIGIN:base,YUNELA_STAGE_PASSWORD:password,YUNELA_AUTH_SECRET:randomBytes(32).toString('hex'),YUNELA_OPERATOR_EMAIL:'operator@example.test',YUNELA_OPERATOR_PASSWORD:randomBytes(20).toString('hex'),YUNELA_TEST_FIXTURES:'1',YUNELA_DB_FILE:join(mkdtempSync(join(tmpdir(),'yunela-v2-')),'test.sqlite')},stdio:['ignore','pipe','pipe']});
let browser;const results=[],logs=[];server.stdout.on('data',x=>logs.push(x.toString()));server.stderr.on('data',x=>logs.push(x.toString()));
async function overflow(p){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');}
async function capture(p,name){console.log('capture',name);await p.mouse.move(0,0);await p.screenshot({path:join(out,name+'.png')});}
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{/* startup */}if(server.exitCode!==null)throw Error(logs.join(''));await new Promise(r=>setTimeout(r,100));}
 assert.equal((await fetch(base+'/api/store/catalog')).status,401);
 browser=await chromium.launch({executablePath:process.env.YUNELA_CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['narrow',360,800],['tablet',768,1024]]){
  const c=await browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:width<700,reducedMotion:'reduce'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(30000);
  await p.goto(base);await p.getByLabel('Пароль стенда').fill(password);await p.getByRole('button',{name:'Відкрити тестовий магазин'}).click();await p.locator('.store-grid article').first().waitFor();await p.evaluate(()=>document.fonts.ready);await p.locator('.hero-photo').evaluate(async img=>{img.loading='eager';await img.decode();});
  assert.equal(await p.locator('.store-hero button').count(),1);assert.equal(await p.locator('#hero-title').innerText(),'БІЛЬШЕ\nНІЖ ЧАЙ');await overflow(p);
  await capture(p,name+'-hero');
  await p.locator('.category-section').scrollIntoViewIfNeeded();await p.evaluate(()=>window.scrollTo({top:document.querySelector('.category-section').offsetTop-78,behavior:'instant'}));await capture(p,name+'-categories');
  await p.getByRole('button',{name:/02.*Улун/}).click();assert(await p.locator('.store-grid article').count()>0);assert.equal(await p.getByRole('button',{name:'Улун',exact:true}).getAttribute('aria-pressed'),'true');
  await p.getByRole('button',{name:'Усі чаї',exact:true}).click();await p.evaluate(()=>document.getElementById('catalog').scrollIntoView({block:'start',behavior:'instant'}));await p.locator('.store-grid img').first().evaluate(async img=>{img.loading='eager';await img.decode();});await capture(p,name+'-catalog');await overflow(p);
  await p.getByLabel('Пошук чаю').fill('млинець');assert.equal(await p.locator('.store-grid article').count(),30);await p.getByLabel('Пошук чаю').fill('неіснуючий-запит');assert.equal(await p.locator('.store-grid article').count(),0);await p.getByLabel('Пошук чаю').fill('PHOTO-');assert.equal(await p.locator('.store-grid article').count(),30);
  await p.locator('.product-open').first().click();assert.equal(await p.locator('.visual-v2').count(),0);assert(await p.getByRole('button',{name:'До кошика',exact:true}).isDisabled());
  const tea=p.getByRole('button',{name:'Чай',exact:true});if(!await tea.isVisible())await p.getByRole('button',{name:'Відкрити меню'}).click();await tea.click();await p.getByLabel('Пошук чаю').fill('TEST-ONLY');await p.getByRole('button',{name:'До кошика',exact:true}).click();await p.getByLabel('Кількість TEST-ONLY').fill('2');await p.getByRole('heading',{name:/Разом: 200/}).waitFor();await p.getByRole('button',{name:'Оформити тестове замовлення'}).click();assert.equal(await p.locator('.visual-v2').count(),0);await p.getByRole('button',{name:'Зберегти тестове замовлення'}).waitFor();await overflow(p);assert.deepEqual(errors,[]);
  results.push({viewport:name,width,height,status:'PASS',checks:'hero / one CTA / loaded fonts-image / categories / search / unavailable product / cart quantity / checkout entry / staging / no overflow / no JS errors'});await c.close();
 }
 // Visual comparison: same Ukrainian text, same font size and container.
 const p=await browser.newPage({viewport:{width:1440,height:1100},bypassCSP:true});await p.goto(base);await p.getByLabel('Пароль стенда').fill(password);await p.getByRole('button',{name:'Відкрити тестовий магазин'}).click();await p.locator('.store-grid article').first().waitFor();
 await p.setContent(`<style>@font-face{font-family:Manrope;src:url('${base}/fonts/manrope-800.woff2')}@font-face{font-family:Onest;src:url('${base}/fonts/onest-800.woff2')}@font-face{font-family:Unbounded;src:url('${base}/fonts/unbounded-800.woff2')}body{background:#050505;color:#eee;margin:45px}section{border-top:1px solid #333;padding:20px 0}small{font:13px Arial;color:#aaa}h1{font-size:90px;line-height:1.1;font-weight:800;letter-spacing:-.05em;margin:20px 0}p{font-size:26px;margin:0}</style>${['Manrope','Onest','Unbounded'].map(f=>`<section style="font-family:${f}"><small>${f} / 800</small><h1>БІЛЬШЕ НІЖ ЧАЙ</h1><p>Відкривай своє · Є І Ї Ґ · є і ї ґ</p></section>`).join('')}`);await p.evaluate(()=>document.fonts.ready);assert(await p.evaluate(()=>document.fonts.check('800 90px Unbounded')));await capture(p,'typography-comparison');await p.close();
 writeFileSync(join(out,'results.json'),JSON.stringify({result:'PASS',browser:await browser.version(),results},null,2));console.log(JSON.stringify(results,null,2));
}finally{if(browser)await browser.close();server.kill('SIGTERM');writeFileSync(join(out,'server.log'),logs.join(''));}
