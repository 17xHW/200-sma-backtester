import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts';
import { runBacktest } from './backtest';

function formatPct(val) {
  if (val == null || isNaN(val)) return '0.00%';
  return (val * 100).toFixed(2) + '%';
}

function formatCcy(val) {
  if (val == null || isNaN(val)) return '$0.00';
  return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function App() {
  const [datasets, setDatasets] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [assetName, setAssetName] = useState('sp500');
  const [useMM, setUseMM] = useState(false);
  const [mmApr, setMmApr] = useState(4.0);
  const [isFeminine, setIsFeminine] = useState(false);

  useEffect(() => {
    if (isFeminine) {
      document.body.classList.add('feminine-theme');
    } else {
      document.body.classList.remove('feminine-theme');
    }
  }, [isFeminine]);
  
  // Strategy Parameters
  const [sma1Unit, setSma1Unit] = useState('weeks');
  const [sma1, setSma1] = useState(200); 
  
  const [sma2Unit, setSma2Unit] = useState('days');
  const [sma2, setSma2] = useState(250);  
  
  const [sma3Unit, setSma3Unit] = useState('days');
  const [sma3, setSma3] = useState(50);   
  
  const [activeTab, setActiveTab] = useState(1);
  const [showStrat2, setShowStrat2] = useState(false);
  const [showStrat3, setShowStrat3] = useState(false);
  const [leverage, setLeverage] = useState(1);
  const [errorMargin, setErrorMargin] = useState(0); 
  const [startDate, setStartDate] = useState('2000-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLoading(true);
    const assets = ['sp500', 'nasdaq', 'dax', 'gold', 'silver'];
    Promise.all(assets.map(a => fetch(`/${a}.json`).then(r => r.json()).then(j => ({ name: a, data: j.records }))))
      .then(results => {
        const dict = {};
        results.forEach(r => { dict[r.name] = r.data; });
        setDatasets(dict);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load dataset bundle", err);
        setLoading(false);
      });
  }, []);

  const data = datasets ? datasets[assetName] : [];

  const backtestResult = useMemo(() => {
    if (loading || data.length === 0) return null;
    
    const res1 = runBacktest(data, sma1, sma1Unit, leverage, errorMargin, startDate, endDate, useMM, mmApr);
    const res2 = showStrat2 ? runBacktest(data, sma2, sma2Unit, leverage, errorMargin, startDate, endDate, useMM, mmApr) : null;
    const res3 = showStrat3 ? runBacktest(data, sma3, sma3Unit, leverage, errorMargin, startDate, endDate, useMM, mmApr) : null;
    
    if (!res1 || !res1.history || res1.history.length === 0) return null;

    const mergedHistory = res1.history.map((row, i) => {
      return {
        date: row.date,
        Index: row.Index,
        IndexDrawdown: row.IndexDrawdown * 100,
        Strategy1: row.Strategy,
        Strategy1Drawdown: row.StrategyDrawdown * 100,
        Strategy1Relative: row.StrategyRelative * 100,
        SMA1: row.SMA,
        Strategy2: res2 && res2.history[i] ? res2.history[i].Strategy : null,
        Strategy2Drawdown: res2 && res2.history[i] ? res2.history[i].StrategyDrawdown * 100 : null,
        Strategy2Relative: res2 && res2.history[i] ? res2.history[i].StrategyRelative * 100 : null,
        SMA2: res2 && res2.history[i] ? res2.history[i].SMA : null,
        Strategy3: res3 && res3.history[i] ? res3.history[i].Strategy : null,
        Strategy3Drawdown: res3 && res3.history[i] ? res3.history[i].StrategyDrawdown * 100 : null,
        Strategy3Relative: res3 && res3.history[i] ? res3.history[i].StrategyRelative * 100 : null,
        SMA3: res3 && res3.history[i] ? res3.history[i].SMA : null,
      };
    });

    return {
      history: mergedHistory,
      outMarketPeriods: res1.outMarketPeriods,
      trades1: res1.trades,
      trades2: res2 ? res2.trades : [],
      trades3: res3 ? res3.trades : [],
      metrics1: res1.metrics,
      metrics2: res2 ? res2.metrics : null,
      metrics3: res3 ? res3.metrics : null
    };
  }, [data, loading, sma1, sma1Unit, sma2, sma2Unit, sma3, sma3Unit, showStrat2, showStrat3, leverage, errorMargin, startDate, endDate, useMM, mmApr]);

  if (loading) return <div style={{ color: 'white', textAlign: 'center', padding: '3rem' }}>Loading dataset...</div>;
  if (!backtestResult) return <div style={{ color: 'white', textAlign: 'center', padding: '3rem' }}>Not enough data.</div>;

  const { history, outMarketPeriods, trades1, trades2, trades3, metrics1, metrics2, metrics3 } = backtestResult;
  
  let activeTrades = [];
  if (activeTab === 1) activeTrades = trades1;
  if (activeTab === 2) activeTrades = trades2;
  if (activeTab === 3) activeTrades = trades3;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '10px', border: '1px solid #334155', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry, idx) => {
            let valText;
            const isPct = entry.name.includes("Drawdown") || entry.dataKey.includes("Drawdown") || entry.name.includes("vs Index") || entry.dataKey.includes("Relative");
            if (isPct) {
               valText = (entry.value > 0 && !entry.name.includes("Drawdown") ? '+' : '') + entry.value.toFixed(2) + '%';
            } else {
               const isPrice = entry.name.includes("SMA") || entry.name.includes("Index");
               valText = isPrice ? entry.value.toFixed(2) : formatCcy(entry.value);
            }
            return (
              <p key={idx} style={{ margin: 0, color: entry.color }}>
                {entry.name}: {valText}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const getLabel = (stratNum, sma, unit) => `Strategy ${stratNum} (${sma}${unit === 'weeks' ? 'w' : 'd'})`;

  const color1 = isFeminine ? "#ec4899" : "#3b82f6";
  const color2 = isFeminine ? "#d946ef" : "#10b981";
  const color3 = isFeminine ? "#8b5cf6" : "#8b5cf6";
  const colorIdx = isFeminine ? "#be185d" : "#eab308";

  return (
    <div className="dashboard-container">
      <header>
        <h1>Multi-SMA Strategy Dashboard</h1>
        <p>Compare three parallel moving average crossovers against the S&P 500 Buy & Hold.</p>
      </header>

      <div className="dashboard-grid">
        <aside className="sidebar card">
          <h3>Parameters</h3>
          
          <div className="input-group">
            <label>Asset</label>
            <select value={assetName} onChange={e => setAssetName(e.target.value)} style={{background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px', width: '100%', marginBottom: '1rem'}}>
                <option value="sp500">S&P 500 (^GSPC)</option>
                <option value="nasdaq">Nasdaq Composite (^IXIC)</option>
                <option value="dax">German DAX (^GDAXI)</option>
                <option value="gold">Gold (GC=F)</option>
                <option value="silver">Silver (SI=F)</option>
            </select>
          </div>

          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={isFeminine} onChange={e => setIsFeminine(e.target.checked)} />
              🦋 Stylish Interface
            </label>
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{color: '#3b82f6', fontWeight: 'bold'}}>Strat 1</span>
              <input type="number" style={{width: '60px', background: 'var(--bg-secondary)', color: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px'}} value={sma1} onChange={e => setSma1(Number(e.target.value))} />
              <select value={sma1Unit} onChange={e => setSma1Unit(e.target.value)} style={{background: 'var(--bg-secondary)', color: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px'}}>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </select>
            </label>
            <input type="range" min="1" max={sma1Unit === 'weeks' ? 500 : 2500} step="1" value={sma1} onChange={e => setSma1(Number(e.target.value))} />
          </div>

          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={showStrat2} onChange={e => setShowStrat2(e.target.checked)} />
              <span style={{color: color2, fontWeight: 'bold'}}>Strat 2</span>
              <input type="number" style={{width: '60px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px'}} value={sma2} onChange={e => setSma2(Number(e.target.value))} />
              <select value={sma2Unit} onChange={e => setSma2Unit(e.target.value)} style={{background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px'}}>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </select>
            </label>
            {showStrat2 && <input type="range" min="1" max={sma2Unit === 'weeks' ? 500 : 2500} step="1" value={sma2} onChange={e => setSma2(Number(e.target.value))} />}
          </div>

          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={showStrat3} onChange={e => setShowStrat3(e.target.checked)} />
              <span style={{color: color3, fontWeight: 'bold'}}>Strat 3</span>
              <input type="number" style={{width: '60px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px'}} value={sma3} onChange={e => setSma3(Number(e.target.value))} />
              <select value={sma3Unit} onChange={e => setSma3Unit(e.target.value)} style={{background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px'}}>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </select>
            </label>
            {showStrat3 && <input type="range" min="1" max={sma3Unit === 'weeks' ? 500 : 2500} step="1" value={sma3} onChange={e => setSma3(Number(e.target.value))} />}
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Leverage <span>{leverage}x</span></label>
            <input type="range" min="1" max="4" step="0.1" value={leverage} onChange={e => setLeverage(Number(e.target.value))} />
          </div>

          <div className="input-group">
            <label>Signal Threshold Buffer <span>{errorMargin}%</span></label>
            <input type="range" min="0" max="10" step="0.1" value={errorMargin} onChange={e => setErrorMargin(Number(e.target.value))} />
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={useMM} onChange={e => setUseMM(e.target.checked)} />
              Money Market Cash Park
            </label>
            {useMM && <input type="range" min="0" max="15" step="0.1" value={mmApr} onChange={e => setMmApr(Number(e.target.value))} />}
            {useMM && <small style={{color: 'var(--success)'}}>Yielding {mmApr}% APR while in cash.</small>}
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          <div className="input-group">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </aside>

        <main className="main-content">
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.5rem' }}>Asset</th>
                  <th style={{ padding: '0.5rem' }}>Total Return</th>
                  <th style={{ padding: '0.5rem' }}>CAGR</th>
                  <th style={{ padding: '0.5rem' }}>Max Drawdown</th>
                  <th style={{ padding: '0.5rem' }}>Sharpe Ratio</th>
                  <th style={{ padding: '0.5rem' }}>Total Executions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>Index</td>
                  <td style={{ padding: '0.5rem' }}>{formatPct(metrics1.indexTotalReturn)}</td>
                  <td style={{ padding: '0.5rem' }}>{formatPct(metrics1.indexCagr)}</td>
                  <td style={{ padding: '0.5rem' }}>{(metrics1.indexMaxDrawdown * 100).toFixed(1)}%</td>
                  <td style={{ padding: '0.5rem' }}>-</td>
                  <td style={{ padding: '0.5rem' }}>-</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem', color: color1 }}>{getLabel(1, sma1, sma1Unit)}</td>
                  <td style={{ padding: '0.5rem', color: metrics1.totalReturn > metrics1.indexTotalReturn ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics1.totalReturn)}</td>
                  <td style={{ padding: '0.5rem', color: metrics1.cagr > metrics1.indexCagr ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics1.cagr)}</td>
                  <td style={{ padding: '0.5rem', color: metrics1.maxDrawdown < metrics1.indexMaxDrawdown ? 'var(--success)' : 'var(--danger)' }}>{(metrics1.maxDrawdown * 100).toFixed(1)}%</td>
                  <td style={{ padding: '0.5rem' }}>{metrics1.sharpeRatio.toFixed(2)}</td>
                  <td style={{ padding: '0.5rem' }}>{trades1.length}</td>
                </tr>
                {showStrat2 && metrics2 && (
                  <tr>
                    <td style={{ padding: '0.5rem', color: color2 }}>{getLabel(2, sma2, sma2Unit)}</td>
                    <td style={{ padding: '0.5rem', color: metrics2.totalReturn > metrics1.indexTotalReturn ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics2.totalReturn)}</td>
                    <td style={{ padding: '0.5rem', color: metrics2.cagr > metrics1.indexCagr ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics2.cagr)}</td>
                    <td style={{ padding: '0.5rem', color: metrics2.maxDrawdown < metrics1.indexMaxDrawdown ? 'var(--success)' : 'var(--danger)' }}>{(metrics2.maxDrawdown * 100).toFixed(1)}%</td>
                    <td style={{ padding: '0.5rem' }}>{metrics2.sharpeRatio.toFixed(2)}</td>
                    <td style={{ padding: '0.5rem' }}>{trades2.length}</td>
                  </tr>
                )}
                {showStrat3 && metrics3 && (
                  <tr>
                    <td style={{ padding: '0.5rem', color: color3 }}>{getLabel(3, sma3, sma3Unit)}</td>
                    <td style={{ padding: '0.5rem', color: metrics3.totalReturn > metrics1.indexTotalReturn ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics3.totalReturn)}</td>
                    <td style={{ padding: '0.5rem', color: metrics3.cagr > metrics1.indexCagr ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics3.cagr)}</td>
                    <td style={{ padding: '0.5rem', color: metrics3.maxDrawdown < metrics1.indexMaxDrawdown ? 'var(--success)' : 'var(--danger)' }}>{(metrics3.maxDrawdown * 100).toFixed(1)}%</td>
                    <td style={{ padding: '0.5rem' }}>{metrics3.sharpeRatio.toFixed(2)}</td>
                    <td style={{ padding: '0.5rem' }}>{trades3.length}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card chart-container">
            <h3>Portfolio Performance</h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={history} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" minTickGap={30} tickFormatter={(tick) => tick.substring(0, 4)} />
                <YAxis stroke="#94a3b8" scale="log" domain={['auto', 'auto']} tickFormatter={(tick) => '$' + tick.toLocaleString()} />
                
                {outMarketPeriods && outMarketPeriods.map((period, idx) => (
                  <ReferenceArea key={idx} x1={period.start} x2={period.end} fill="#334155" fillOpacity={0.3} />
                ))}

                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" name={getLabel(1, sma1, sma1Unit)} dataKey="Strategy1" stroke={color1} dot={false} strokeWidth={2} />
                {showStrat2 && <Line type="monotone" name={getLabel(2, sma2, sma2Unit)} dataKey="Strategy2" stroke={color2} dot={false} strokeWidth={2} />}
                {showStrat3 && <Line type="monotone" name={getLabel(3, sma3, sma3Unit)} dataKey="Strategy3" stroke={color3} dot={false} strokeWidth={2} />}
                
                <Line type="monotone" name="Index" dataKey="Index" stroke={colorIdx} dot={false} strokeWidth={1} opacity={0.6} />
                <Line type="monotone" name={`SMA 1 (${sma1}${sma1Unit === 'weeks' ? 'w' : 'd'})`} dataKey="SMA1" stroke="#f43f5e" dot={false} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="card chart-container" style={{ marginTop: '2rem', height: '350px' }}>
            <h3>Drawdown Profile</h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={history} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" minTickGap={30} tickFormatter={(tick) => tick.substring(0, 4)} />
                <YAxis stroke="#94a3b8" domain={['auto', 0]} tickFormatter={(tick) => tick + '%'} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" name={getLabel(1, sma1, sma1Unit) + " Drawdown"} dataKey="Strategy1Drawdown" stroke={color1} dot={false} strokeWidth={2} />
                {showStrat2 && <Line type="monotone" name={getLabel(2, sma2, sma2Unit) + " Drawdown"} dataKey="Strategy2Drawdown" stroke={color2} dot={false} strokeWidth={2} />}
                {showStrat3 && <Line type="monotone" name={getLabel(3, sma3, sma3Unit) + " Drawdown"} dataKey="Strategy3Drawdown" stroke={color3} dot={false} strokeWidth={2} />}
                <Line type="monotone" name="Index Drawdown" dataKey="IndexDrawdown" stroke={colorIdx} dot={false} strokeWidth={1} opacity={0.6} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card chart-container" style={{ marginTop: '2rem', height: '350px' }}>
            <h3>Relative Outperformance vs Buy & Hold</h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={history} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" minTickGap={30} tickFormatter={(tick) => tick.substring(0, 4)} />
                <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(tick) => (tick > 0 ? '+' : '') + tick.toFixed(0) + '%'} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Line type="monotone" name={getLabel(1, sma1, sma1Unit) + " vs Index"} dataKey="Strategy1Relative" stroke={color1} dot={false} strokeWidth={2} />
                {showStrat2 && <Line type="monotone" name={getLabel(2, sma2, sma2Unit) + " vs Index"} dataKey="Strategy2Relative" stroke={color2} dot={false} strokeWidth={2} />}
                {showStrat3 && <Line type="monotone" name={getLabel(3, sma3, sma3Unit) + " vs Index"} dataKey="Strategy3Relative" stroke={color3} dot={false} strokeWidth={2} />}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ marginTop: '2rem' }}>
            <h3>Trade Logs</h3>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <button 
                onClick={() => setActiveTab(1)} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 1 ? `2px solid ${color1}` : 'none', color: activeTab === 1 ? color1 : 'inherit', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                Strategy 1
              </button>
              {showStrat2 && (
                <button 
                  onClick={() => setActiveTab(2)} 
                  style={{ background: 'none', border: 'none', borderBottom: activeTab === 2 ? `2px solid ${color2}` : 'none', color: activeTab === 2 ? color2 : 'inherit', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  Strategy 2
                </button>
              )}
              {showStrat3 && (
                <button 
                  onClick={() => setActiveTab(3)} 
                  style={{ background: 'none', border: 'none', borderBottom: activeTab === 3 ? `2px solid ${color3}` : 'none', color: activeTab === 3 ? color3 : 'inherit', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  Strategy 3
                </button>
              )}
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.5rem' }}>Type</th>
                      <th style={{ padding: '0.5rem' }}>Date</th>
                      <th style={{ padding: '0.5rem' }}>Price</th>
                      <th style={{ padding: '0.5rem' }}>Return Since Entry (After Leverage)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTrades && activeTrades.length > 0 ? activeTrades.map((trade, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.5rem', color: trade.type === 'BUY' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>{trade.type}</td>
                        <td style={{ padding: '0.5rem' }}>{trade.date}</td>
                        <td style={{ padding: '0.5rem' }}>{formatCcy(trade.price)}</td>
                        <td style={{ padding: '0.5rem', color: trade.return > 0 ? 'var(--success)' : (trade.return < 0 ? 'var(--danger)' : 'inherit') }}>
                           {trade.type === 'SELL' ? formatPct(trade.return) : '-'}
                        </td>
                      </tr>
                    )) : <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No trades executed in this period.</td></tr>}
                  </tbody>
              </table>
            </div>
          </div>
          
        </main>
      </div>
    </div>
  );
}
