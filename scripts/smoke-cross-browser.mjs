// Diagnostic browser compatibility on GitHub Ubuntu 24.04.
// Uses preinstalled stable Edge + Firefox/geckodriver. No npm browser packages.
// Browser checks do not modify the public service or access Supabase secrets.
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

const execFileAsync=promisify(execFile);
const origin='https://footballforecast.vercel.app';

function expectPage(html,path) {
  if(path==='/dashboard') {
    assert.match(html,/Футбольная аналитика/,'public dashboard must render');
    assert.match(html,/Публичная база подключена/,'anonymous REST must work in browser output');
  } else {
    assert.match(html,/Административный вход пока не настроен/,
      'unauthenticated admin must reach the safe setup page');
  }
}

async function edge() {
  const dir=await mkdtemp(join(tmpdir(),'ff-edge-'));
  try {
    const flags=['--headless=new','--no-sandbox','--disable-gpu',
      '--disable-dev-shm-usage','--disable-background-networking','--no-first-run',
      '--no-default-browser-check',`--user-data-dir=${dir}`,'--window-size=390,844'];
    const opts={timeout:45000,maxBuffer:12000000};
    // Edge/Chromium can exit zero with an empty --dump-dom on hosted runners.
    // Retry ONLY blank captures or actual launch timeouts. Incorrect nonempty
    // page HTML is an immediate failure and never retried or hidden.
    for(const path of ['/dashboard','/admin']) {
      let captured=false,lastFailure='';
      for(let attempt=1;attempt<=3;attempt++) {
        try {
          const {stdout,stderr}=await execFileAsync(process.env.FF_EDGE_BIN||'microsoft-edge',
            [...flags.filter(flag=>!flag.startsWith('--user-data-dir=')),
              `--user-data-dir=${join(dir,'dom-'+path.slice(1)+'-'+attempt)}`,
              '--no-proxy-server','--dump-dom',origin+path],opts);
          if(stdout.length===0) {
            lastFailure=`Edge ${path} returned blank DOM on attempt ${attempt}; stderr: ${stderr.slice(-400)}`;
            console.warn(lastFailure);
            continue;
          }
          expectPage(stdout,path);
          captured=true;
          break;
        } catch(error) {
          if(error?.code!=='ETIMEDOUT' && error?.killed!==true) throw error;
          lastFailure=`Edge launch timed out for ${path}, attempt ${attempt}`;
          console.warn(lastFailure);
        }
      }
      assert.ok(captured,`Edge failed to render ${path} after 3 launches: ${lastFailure}`);
    }
    const screenshot=join(dir,'mobile-dashboard.png');
    await execFileAsync(process.env.FF_EDGE_BIN||'microsoft-edge',
      [...flags.filter(flag=>!flag.startsWith('--user-data-dir=')),
        `--user-data-dir=${join(dir,'mobile-screenshot')}`, '--no-proxy-server',
        `--screenshot=${screenshot}`,origin+'/dashboard'],opts);
    const png=await readFile(screenshot);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.ok(png.readUInt32BE(16)>=320 && png.readUInt32BE(20)>=400,
      'Edge screenshot must have a mobile-sized viewport');
    console.log('PASS Microsoft Edge headless: dashboard, denied admin, mobile PNG');
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
}

async function availablePort() {
  const server=createServer();
  await new Promise((resolve,reject)=>{
    server.once('error',reject).listen(0,'127.0.0.1',resolve);
  });
  const port=server.address().port;
  await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  return port;
}

async function firefox() {
  const port=await availablePort();
  const host=`http://127.0.0.1:${port}`;
  const driver=spawn(process.env.FF_GECKO_BIN||'geckodriver',
    ['--host','127.0.0.1','--port',String(port),'--log','error'],
    {stdio:'ignore',detached:process.platform!=='win32'});
  let id;
  async function request(path,body,method) {
    const result=await fetch(host+path,{
      method:method??(body===undefined?'GET':'POST'),
      headers:{'content-type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body),
      signal:AbortSignal.timeout(35000)
    });
    const response=await result.json();
    if(!result.ok || response.value?.error)
      throw new Error(`WebDriver ${path}: ${response.value?.message||result.status}`);
    return response.value;
  }
  try {
    let session;
    for(let i=0;i<50;i++){
      if(driver.exitCode!==null)throw new Error('geckodriver exited before startup');
      try {
        session=await request('/session',{
          capabilities:{alwaysMatch:{browserName:'firefox',
            'moz:firefoxOptions':{args:['-headless']}}}
        });
        break;
      }catch(e){
        // Retry only while the driver port is still starting, not after errors.
        if(i>=49)throw e;
        await delay(200);
      }
    }
    assert.ok(session?.sessionId,'WebDriver session required');
    id=session.sessionId;
    await request(`/session/${id}/window/rect`,{width:390,height:844},'POST');
    for(const path of ['/dashboard','/admin']) {
      await request(`/session/${id}/url`,{url:origin+path},'POST');
      const source=await request(`/session/${id}/source`);
      assert.equal(typeof source,'string');
      expectPage(source,path);
    }
    await request(`/session/${id}/url`,{url:origin+'/dashboard'},'POST');
    const encoded=await request(`/session/${id}/screenshot`);
    const png=Buffer.from(encoded,'base64');
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.ok(png.readUInt32BE(16)>=300 && png.readUInt32BE(20)>=400,
      'Firefox screenshot must have a mobile viewport');
    console.log('PASS Mozilla Firefox headless: dashboard, denied admin, mobile PNG');
  } finally {
    if(id)try{await request(`/session/${id}`,undefined,'DELETE')}catch{}
    if(driver.exitCode===null){
      try{
        if(process.platform==='win32')driver.kill();
        else process.kill(-driver.pid,'SIGTERM');
      }catch{driver.kill();}
    }
  }
}

await edge();
await firefox();
console.log('PASS Edge and Firefox production browser compatibility diagnostics');
