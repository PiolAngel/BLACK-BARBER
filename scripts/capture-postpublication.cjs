const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const BASE='http://127.0.0.1:4173/';
async function main(){
 const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],{stdio:'ignore'});
 let browser;
 const results=[];
 try{
   await new Promise(r=>setTimeout(r,1200));
   browser=await chromium.launch();
   mkdirSync('visual-review',{recursive:true});
   for(const v of [
      {name:'desktop',width:1440,height:900},
      {name:'tablet',width:820,height:900},
      {name:'iphone',width:390,height:844}
   ]){
     const page=await browser.newPage({viewport:{width:v.width,height:v.height},deviceScaleFactor:1,reducedMotion:'reduce'});
     const errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     await page.goto(BASE,{waitUntil:'domcontentloaded'});
     await page.evaluate(()=>document.fonts.ready);
     const height=await page.evaluate(()=>document.documentElement.scrollHeight);
     for(let y=0;y<height;y+=Math.floor(v.height*.7)){
       await page.evaluate(y=>window.scrollTo(0,y),y);
       await page.waitForTimeout(65);
     }
     await page.evaluate(()=>window.scrollTo(0,0));
     await page.waitForTimeout(250);
     const metrics=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,doc:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
     if(metrics.doc>metrics.viewport+1)throw Error('overflow '+v.name+':'+JSON.stringify(metrics));
     if(errors.length)throw Error('JS '+v.name+':'+errors.join('|'));
     await page.screenshot({path:'visual-review/'+v.name+'-full.jpg',fullPage:true,type:'jpeg',quality:73,animations:'disabled'});
     for(const section of ['galeria','contacto-demo']){
       await page.locator('#'+section).scrollIntoViewIfNeeded();
       await page.waitForTimeout(280);
       await page.screenshot({path:'visual-review/'+v.name+'-'+section+'.jpg',fullPage:false,type:'jpeg',quality:85,animations:'disabled'});
     }
     if(v.width<=1023){
       await page.evaluate(()=>window.scrollTo(0,Math.min(1800,document.documentElement.scrollHeight-1000)));
       await page.waitForTimeout(300);
       const scrollBefore=await page.evaluate(()=>scrollY);
       await page.locator('#navToggle').click();
       await page.waitForTimeout(380);
       await page.screenshot({path:'visual-review/'+v.name+'-menu-after-scroll.jpg',type:'jpeg',quality:82,animations:'disabled'});
       const menu=await page.locator('#primaryNav').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight,parent:el.parentElement.tagName};});
       if(menu.parent!=='BODY'||Math.abs(menu.top)>1||menu.bottom<menu.height-2)throw Error('bad menu '+v.name+':'+JSON.stringify(menu));
       await page.locator('#navClose').click();
       const scrollAfter=await page.evaluate(()=>scrollY);
       if(Math.abs(scrollAfter-scrollBefore)>2)throw Error('lost scroll '+v.name+':'+scrollAfter+' '+scrollBefore);
       results.push({...v,...metrics,scrollBefore,scrollAfter,menu});
     }else results.push({...v,...metrics});
     await page.close();
   }
   writeFileSync('visual-review/diagnostico.json',JSON.stringify(results,null,2));
   console.log('CAPTURAS COMPLETADAS',JSON.stringify(results));
 }finally{if(browser)await browser.close();server.kill('SIGTERM');}
}
main().catch(e=>{console.error(e);process.exitCode=1});
