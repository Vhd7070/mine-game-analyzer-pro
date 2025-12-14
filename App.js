import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [serverSeed, setServerSeed] = useState('');
  const [clientSeed, setClientSeed] = useState('');
  const [nonce, setNonce] = useState(1);
  const [bombsCount, setBombsCount] = useState(10);
  const [futureHandsCount, setFutureHandsCount] = useState(3);
  const [history, setHistory] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [suggestions, setSuggestions] = useState({ safeMoves: [], cashoutSuggestion: '', expectedValue: '' });
  const [futureHands, setFutureHands] = useState([]);
  const [loading, setLoading] = useState(false);

  const workerRef = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.js', import.meta.url));
    workerRef.current.onmessage = (e) => {
      const { action, data } = e.data;
      if (action === 'result') {
        setHistory(data.newHistory);
        setHeatmap(data.heatmap);
        setSuggestions(data.suggestions);
        setFutureHands(data.futureHands);
        setLoading(false);
      }
    };
    return () => { workerRef.current.terminate(); };
  }, []);

  const runSimulation = () => {
    if (!serverSeed || !clientSeed) return alert('Server Seed و Client Seed را وارد کنید!');
    setLoading(true);
    workerRef.current.postMessage({
      action: 'simulate',
      payload: { serverSeed, clientSeed, nonce, history, bombsCount, futureHandsCount }
    });
  };

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '500px', margin: 'auto' }}>
      <h2>Mine Game Analyzer Pro</h2>
      <input placeholder="Server Seed" value={serverSeed} onChange={e => setServerSeed(e.target.value)} />
      <input placeholder="Client Seed" value={clientSeed} onChange={e => setClientSeed(e.target.value)} />
      <input type="number" placeholder="Nonce" value={nonce} onChange={e => setNonce(Number(e.target.value))} />
      <input type="number" placeholder="تعداد بمب‌ها" value={bombsCount} onChange={e => setBombsCount(Number(e.target.value))} />
      <input type="number" placeholder="تعداد دست‌های آینده" value={futureHandsCount} onChange={e => setFutureHandsCount(Number(e.target.value))} />
      <button onClick={runSimulation}>{loading ? 'در حال شبیه‌سازی...' : 'Run Analysis'}</button>

      <div className="grid">
        {heatmap.map(cell => (
          <div key={cell.num} className={`cell ${cell.color}`}>
            {cell.num}<br />{cell.riskPercent}%
          </div>
        ))}
      </div>

      <h3>Suggested Moves:</h3>
      <ul>{suggestions.safeMoves.map(m => <li key={m.num}>{m.num} ({m.riskPercent}%)</li>)}</ul>
      <p><strong>Cashout:</strong> {suggestions.cashoutSuggestion}</p>
      <p><strong>Expected Value:</strong> {suggestions.expectedValue}%</p>

      <h3>Predicted Future Hands:</h3>
      {futureHands.map((hand, idx) => (
        <div key={idx} className="grid small">
          {hand.map(cell => (
            <div key={cell.num} className={`cell ${cell.color}`}>
              {cell.num}<br />{cell.riskPercent}%
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default App;
