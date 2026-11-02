'use strict';
const assert = require('node:assert/strict');
async function checkCatchup(contents) {
  const result = await contents.executeJavaScript(`(async()=>{
    const state=RootEngine.createState(672);state.resilience.graceUntil=1e9;
    let ticks=0,messages=0;const heartbeat=setInterval(()=>ticks++,10);
    const result=await new Promise((resolve,reject)=>{
      const worker=new Worker('/advance-worker.js');
      const timer=setTimeout(()=>{worker.terminate();reject(new Error('Catch-up worker did not finish'));},20000);
      worker.onmessage=({data})=>{if(data.type==='progress')messages++;else{clearTimeout(timer);worker.terminate();data.type==='complete'?resolve(data):reject(new Error(data.message));}};
      worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(new Error(event.message));};
      worker.postMessage({state,seconds:3600});
    });clearInterval(heartbeat);
    const expected=RootEngine.normalizeState(state);RootEngine.advance(expected,3600);
    return {ticks,messages,equal:JSON.stringify(expected)===JSON.stringify(result.state),seconds:result.report.seconds};
  })()`);
  assert.equal(result.equal, true);
  assert.equal(result.seconds, 3600);
  assert.ok(result.messages > 1);
  assert.ok(result.ticks > 1, 'Chromium UI must keep processing timers while the worker runs');
  return result;
}
module.exports = { checkCatchup };
