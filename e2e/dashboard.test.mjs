// Browser checks of the real dashboard (e2e/README.md) in Chromium through Playwright, against e2e/server.mjs and an
// isolated e2e_* database prepared by e2e/prepare_db.py. TEST ONLY data; nothing is sent anywhere.
// Usage: E2E_URL=http://127.0.0.1:4317 E2E_ARTIFACTS=<dir> node --test e2e/dashboard.test.mjs
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.E2E_URL||'http://127.0.0.1:4317',shots=process.env.E2E_ARTIFACTS;
let browser;
before(async()=>{browser=await chromium.launch()});
after(async()=>{await browser?.close()});
const fault=(mode,count=1)=>fetch(base+'/__test/fault?mode='+mode+'&count='+count);
async function open(viewport={width:1280,height:900}){
 const page=await browser.newPage({viewport});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');await page.getByText('Ukupno u bazi:').waitFor({timeout:20000});
 return {page,errors};
}
const shot=(page,name)=>shots?page.screenshot({path:shots+'/'+name+'.png',fullPage:true}):null;
const field=(dialog,label)=>dialog.locator('label.field',{has:dialog.page().locator('span',{hasText:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}).locator('input,select,textarea').first();

test('catalogue, counts and possible pairs load from the real API',async()=>{
 const {page,errors}=await open();
 await page.getByText('Ukupno u bazi: 3 nekretnina i 2 kupaca').waitFor();
 assert.match(await page.getByRole('button',{name:/Mogući parovi/}).textContent(),/3/);
 await page.getByRole('button',{name:'Nekretnine',exact:true}).click();
 for(const t of ['TEST ONLY zemljište Lukavec','TEST ONLY kuća Split','TEST ONLY zemljište Galway'])await page.getByText(t).first().waitFor();
 await page.getByRole('button',{name:'Podudaranja',exact:true}).click();
 await page.getByText('TEST ONLY kupac zemljišta').first().waitFor();
 await shot(page,'desktop-pairs');
 assert.deepEqual(errors,[]);await page.close();
});

test('a new record is saved, stays after a full reload and is read back from the database',async()=>{
 const {page,errors}=await open();
 await page.getByRole('button',{name:'Nova nekretnina'}).click();
 const d=page.getByRole('dialog');await d.waitFor();
 await field(d,'Naziv nekretnine').fill('TEST ONLY nova kuća Zadar');
 await field(d,'Država').selectOption('Hrvatska');await field(d,'Grad').fill('Zadar');
 await field(d,'Vrsta nekretnine').selectOption('Kuća');await field(d,'Stanje').selectOption('Neizgrađeno');
 await field(d,'Navedeni iznos €').fill('210000');await field(d,'Površina m²').fill('900');
 await field(d,'URL izvornog oglasa').fill('https://example.org/test-only/p/new');
 await d.getByRole('button',{name:'Spremi promjene'}).click();
 await page.getByRole('dialog').waitFor({state:'detached',timeout:20000});
 await page.reload();await page.getByText('Ukupno u bazi: 4 nekretnina i 2 kupaca').waitFor({timeout:20000});
 await page.getByRole('button',{name:'Nekretnine',exact:true}).click();
 await page.getByText('TEST ONLY nova kuća Zadar').first().waitFor();
 // Read back through the API, independent of the page state.
 const data=await (await fetch(base+'/api/platform')).json();
 const saved=data.properties.find(p=>p.title==='TEST ONLY nova kuća Zadar');
 assert(saved,'stored');assert.equal(Number(saved.price),210000);assert.equal(saved.city,'Zadar');
 assert.deepEqual(errors,[]);await page.close();
});

test('a failed or invalid read is an error with retry, never empty data; loaded data stays visible',async()=>{
 await fault('error',2);
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(base+'/');
 await page.getByText('TEST ONLY: baza nije dostupna').first().waitFor({timeout:20000});
 assert.equal(await page.getByText('Ukupno u bazi: 0').count(),0,'no zero counts shown for a failed read');
 await shot(page,'desktop-error');
 await page.getByRole('button',{name:'Pokušaj ponovno'}).first().click();
 await page.getByText('Ukupno u bazi:').waitFor({timeout:20000});
 // After a successful load, a failing refresh keeps the loaded records on screen.
 await fault('invalid',2);
 await page.getByRole('button',{name:'Nekretnine',exact:true}).click();
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.getByText(/Odgovor poslužitelja nije valjan/).first().waitFor({timeout:20000});
 await page.getByText('TEST ONLY zemljište Lukavec').first().waitFor();
 await fault('none',0);await page.close();
});

test('mobile viewport: the dashboard and the record form are usable without horizontal page scroll',async()=>{
 const {page,errors}=await open({width:390,height:844});
 const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 assert(await overflow()<=1,'no horizontal page scroll on the overview: '+await overflow());
 await page.getByRole('button',{name:'Nova nekretnina'}).click();
 const d=page.getByRole('dialog');await d.waitFor();
 const save=d.getByRole('button',{name:'Spremi promjene'});await save.scrollIntoViewIfNeeded();
 const box=await save.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=391,'save button inside the viewport');
 await shot(page,'mobile-form');
 assert.deepEqual(errors,[]);await page.close();
});
