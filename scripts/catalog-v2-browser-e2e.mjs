/* global document, window */
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const remote=process.env.DEMO_URL;
const server=remote?null:createServer((req,res)=>{const p=resolve('dist','.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(resolve('dist')+'/')){res.end(readFileSync('dist/index.html'));return;}const file=existsSync(p)?p:resolve('dist/index.html');res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg'})[extname(file)]??'text/html');res.end(readFileSync(file));});
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=remote??`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox'],...(remote&&process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
mkdirSync('artifacts/v8',{recursive:true});
try{for(const [name,width,height]of [['mobile',390,844],['desktop',1440,1000]]){
 const context=await browser.newContext({viewport:{width,height},ignoreHTTPSErrors:!!remote});const page=await context.newPage();const errors=[],api=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api'))api.push(r.url());});
 await page.goto(url);await page.locator('#tea-search').waitFor();assert.equal(await page.locator('.store-grid article').count(),56);assert.equal(await page.locator('.product-buy button:enabled').count(),0);
 await page.locator('#tea-search').fill('LIST-013');assert.equal(await page.locator('.store-grid article').count(),1);await page.locator('.product-open').click();await page.getByRole('heading',{name:'Як заварювати',exact:true}).waitFor();assert.ok((await page.locator('.catalogue-content').innerText()).includes('не підтверджені'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:`artifacts/v8/${name}-product.png`,fullPage:true});
 await page.getByRole('button',{name:'Назад до каталогу',exact:true}).click();await page.locator('#tea-search').fill('PHOTO-014');await page.locator('.product-open').click();assert.ok((await page.locator('.store-detail').innerText()).includes('Червоний чай'));
 assert.deepEqual(errors,[]);assert.deepEqual(api,[]);await context.close();console.log(`${name}: PASS — 56 records, disabled commerce, search, details, brewing, taxonomy, no overflow/errors/API calls`);
}}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
