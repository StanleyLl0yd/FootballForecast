// Safari WebDriver smoke on macOS stable standard GitHub Actions runners.
// Requires sudo safaridriver --enable in CI. No tokens, writes or npm packages.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

const origin='https://footballforecast.vercel.app';
async function port() {
  const srv=createServer();
  await new Promise((ok,fail)=>srv.once('error',fail).listen(0,'127.0.0.1',ok));
  const p=srv.address().port;
  await new Promise((ok,fail)=>srv.close(e=>e?fail(e):ok()));
  return p;
}
const driverPort=await port();
const host=`http://127.0.0.1:${driverPort}`;
const driver=spawn('/usr/bin/safaridriver',['-p',String(driverPort)],{stdio:'ignore'});
let sessionId;
async function webdriver(path,body,method) {
  const res=await fetch(host+path,{
    method:method??(body===undefined?'GET':'POST'),
    headers:{'content-type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(60000)
  });
  const data=await res.json();
  if(!res.ok||data.value?.error)
    throw new Error(`Safari WebDriver ${path}: ${data.value?.message||res.status}`);
  return data.value;
}
try {
  let session;
  for(let i=0;i<40;i++) {
    if(driver.exitCode!==null)throw new Error('safaridriver did not start');
    try {
      session=await webdriver('/session',{capabilities:{
        alwaysMatch:{browserName:'safari'}
      }});
      break;
    }catch(e){
      if(i===39)throw e;
      await delay(250);
    }
  }
  sessionId=session?.sessionId;
  assert.ok(sessionId,'Safari WebDriver session not created');
  // Only one Safari automation session at a time.
  for(const [path,content] of [
    ['/dashboard',/Футбольная аналитика/],
    ['/admin',/Административный вход пока не настроен/]
  ]) {
    await webdriver(`/session/${sessionId}/url`,{url:origin+path},'POST');
    const source=await webdriver(`/session/${sessionId}/source`);
    assert.equal(typeof source,'string');
    assert.match(source,content,`Safari ${path} must render expected public/denied view`);
  }
  // Screenshot sanity on a real WebKit browser. Resizing may be constrained by
  // remote macOS screen dimensions, so don't invent mobile-size guarantees.
  await webdriver(`/session/${sessionId}/url`,{url:origin+'/dashboard'},'POST');
  const base64=await webdriver(`/session/${sessionId}/screenshot`);
  const png=Buffer.from(base64,'base64');
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.ok(png.readUInt32BE(16)>250&&png.readUInt32BE(20)>250);
  console.log('PASS Safari WebDriver: public dashboard, denied admin, screenshot');
} finally {
  if(sessionId)try{await webdriver(`/session/${sessionId}`,undefined,'DELETE')}catch{}
  if(driver.exitCode===null)driver.kill();
}
