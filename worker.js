self.addEventListener('message', async (e) => {
  const { action, payload } = e.data;
  if (action === 'simulate') {
    const { serverSeed, clientSeed, nonce, history, bombsCount, futureHandsCount } = payload;
    const result = await runSimulation(serverSeed, clientSeed, nonce, history, bombsCount, futureHandsCount);
    self.postMessage({ action: 'result', data: result });
  }
});

async function hmacSha256(key, msg) {
  const enc = new TextEncoder();
  const keyData = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", keyData, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function sha256(msg) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function createNums(allNums, hash) {
  let nums = [];
  let h = hash;
  allNums.forEach((c) => {
    nums.push({ num: c, hash: h });
    h = h.substring(1) + h.charAt(0);
  });
  nums.sort((o1,o2)=>o1.hash<o2.hash?-1:o1.hash===o2.hash?0:1);
  return nums;
}

async function getResult(hash) {
  const allNums = Array.from({length:25},(_,i)=>i+1);
  let seed = hash;
  let finalNums = createNums(allNums, seed);
  seed = await sha256(seed);
  finalNums = createNums(finalNums.map(n=>n.num), seed);
  return finalNums.map(m=>m.num);
}

function simulateRisk(resultList, history=[], simulations=2000, bombsCount=10) {
  const riskCount = Array(25).fill(0);
  for(let s=0;s<simulations;s++){
    let combined = [...resultList];
    if(history.length>0){
      const past = history[Math.floor(Math.random()*history.length)].resultList;
      combined = combined.map((v,i)=>Math.random()<0.5?v:past[i]);
    }
    const shuffled = [...combined].sort(()=>Math.random()-0.5);
    const bombs = shuffled.slice(0,bombsCount);
    bombs.forEach(b=>riskCount[b-1]++);
  }
  return riskCount.map(c=>(c/simulations)*100);
}

function generateHeatmap(riskPercent) {
  return riskPercent.map((p,i)=>{
    let color='green';
    if(p>50) color='red';
    else if(p>20) color='yellow';
    return {num:i+1, riskPercent:p.toFixed(1), color};
  });
}

function suggestMoves(heatmap) {
  const safeMoves = heatmap.filter(h=>h.color==='green'||h.color==='yellow').sort((a,b)=>a.riskPercent-b.riskPercent).slice(0,3);
  const avgRisk = heatmap.reduce((acc,h)=>acc+parseFloat(h.riskPercent),0)/25;
  const cashoutSuggestion = avgRisk>40 ? 'Consider Cashout':'Safe to Continue';
  return { safeMoves, cashoutSuggestion, expectedValue:(100-avgRisk).toFixed(1) };
}

function simulateFutureHands(history,hands=3,bombsCount=10){
  const futurePred=[];
  for(let h=0;h<hands;h++){
    const lastHand = history[history.length-1]?history[history.length-1].resultList:Array.from({length:25},(_,i)=>i+1);
    const riskPercent=simulateRisk(lastHand, history, 2000, bombsCount);
    futurePred.push(generateHeatmap(riskPercent));
  }
  return futurePred;
}

async function runSimulation(serverSeed, clientSeed, nonce, history, bombsCount=10, futureHandsCount=3){
  const msg = `${clientSeed}:${nonce}`;
  const hmac = await hmacSha256(serverSeed,msg);
  const resultList = await getResult(hmac);
  const newHistory = [...history,{resultList}];
  if(newHistory.length>10)newHistory.shift();

  const riskPercent = simulateRisk(resultList,newHistory,5000,bombsCount);
  const heatmap = generateHeatmap(riskPercent);
  const suggestions = suggestMoves(heatmap);
  const futureHands = simulateFutureHands(newHistory,futureHandsCount,bombsCount);

  return { resultList, newHistory, heatmap, suggestions, futureHands };
}
