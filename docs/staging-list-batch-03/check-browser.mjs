/* global document, innerWidth, scrollTo, getComputedStyle, process, URL, console */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const out='docs/staging-list-batch-03';mkdirSync(out,{recursive:true});
const targets=['LIST-012','LIST-013','LIST-014','LIST-015','LIST-016'];
const previous=['LIST-001', 'LIST-002', 'LIST-003', 'LIST-004', 'LIST-005', 'LIST-006', 'LIST-007', 'LIST-008', 'LIST-009', 'LIST-010', 'LIST-011', 'PHOTO-001', 'PHOTO-008', 'PHOTO-010'];
const gallery=JSON.parse(readFileSync('content/creative-gallery.v1.json'));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox'],...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
const results=[];
async function decode(locator){await locator.evaluate(async im=>{await im.decode();if(!im.complete||!im.naturalWidth)throw Error('Broken image');});}
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},deviceScaleFactor:1,isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce',ignoreHTTPSErrors:!!process.env.HTTPS_PROXY});
 const page=await context.newPage();const errors=[],consoleErrors=[],failed=[],httpErrors=[],api=[];page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()}));page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
 await page.goto('https://yunela-v92-demo.onrender.com',{waitUntil:'networkidle'});await page.locator('.store-grid article').nth(55).waitFor();assert.equal(await page.locator('.store-grid article').count(),56);assert.equal(await page.getByRole('button',{name:'До кошика',exact:true}).count(),0);
 for(const sku of [...targets,...previous]){
  await page.locator('#tea-search').fill(sku);const card=page.locator('.store-grid article');assert.equal(await card.count(),1);const image=card.locator('img');await image.scrollIntoViewIfNeeded();await decode(image);
  const catalog=await image.evaluate(im=>({currentSrc:im.currentSrc,fit:getComputedStyle(im).objectFit,background:getComputedStyle(im.parentElement).backgroundColor,renderWidth:im.clientWidth}));assert.ok(catalog.currentSrc.includes(sku));
  if(targets.includes(sku))await page.screenshot({path:`${out}/${width}-${sku}-catalog.png`});
  await card.locator('.product-open').click();assert.equal(await page.locator('.product-page').getAttribute('data-source-sku'),sku);
  const stage=page.locator('.gallery-stage img');await stage.scrollIntoViewIfNeeded();await decode(stage);const primary=await stage.getAttribute('src');const product=gallery.products.find(p=>p.sourceSku===sku);assert.ok(primary.includes(product.images[0].path));
  const detail=await stage.evaluate(im=>({currentSrc:im.currentSrc,fit:getComputedStyle(im).objectFit,background:getComputedStyle(im.parentElement).backgroundColor,renderWidth:im.clientWidth}));
  const thumbnails=page.locator('.gallery-thumbnails button');assert.equal(await thumbnails.count(),product.images.length>1?product.images.length:0);
  if(product.images.length>1){for(let i=0;i<product.images.length;i++){await thumbnails.nth(i).click();await decode(stage);assert.ok((await stage.getAttribute('src')).includes(product.images[i].path));}await thumbnails.first().click();await decode(stage);}
  await page.locator('.product-gallery').evaluate(async el=>{await Promise.all([...el.querySelectorAll('img')].map(im=>im.decode()));});assert.equal(await stage.getAttribute('src'),primary);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(targets.includes(sku)){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${width}-${sku}-detail.png`});}
  results.push({viewport:width,sourceSku:sku,result:'PASS',catalog,detail,galleryFrames:product.images.length,primaryRestored:true});await page.getByRole('button',{name:'Назад до каталогу',exact:true}).click();assert.equal(await page.locator('#tea-search').inputValue(),sku);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failed,[]);assert.deepEqual(httpErrors,[]);assert.deepEqual(api,[]);results.push({viewport:width,result:'PASS',catalogCount:56,pageErrors:errors,consoleErrors,failedRequests:failed,httpErrors,commerceApiRequests:api});await context.close();console.log(width+' PASS');
}
writeFileSync(out+'/BROWSER_RESULTS.json',JSON.stringify({commit:'f6ddcb149b7cc9b0b57f1d5a107b52f028f25020',result:'PASS',browser:await browser.version(),results},null,2)+'\n');
}catch(e){writeFileSync(out+'/BROWSER_FAILURE.json',JSON.stringify({error:String(e),results},null,2));throw e;}finally{await browser.close();}
