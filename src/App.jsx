import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
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
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Strategy Parameters
  const [sma1, setSma1] = useState(1000); 
  const [sma2, setSma2] = useState(250);  
  const [sma3, setSma3] = useState(50);   
  const [showStrat2, setShowStrat2] = useState(true);
  const [showStrat3, setShowStrat3] = useState(true);
  const [leverage, setLeverage] = useState(1);
  const [errorMargin, setErrorMargin] = useState(0); 
  const [startDate, setStartDate] = useState('2000-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetch('/sp_data.json')
      .then(res => res.json())
      .then(json => {
        setData(json.records);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load data", err);
        setLoading(false);
      });
  }, []);

  const backtestResult = useMemo(() => {
    if (loading || data.length === 0) return null;
    
    const res1 = runBacktest(data, sma1, leverage, errorMargin, startDate, endDate);
    const res2 = showStrat2 ? runBacktest(data, sma2, leverage, errorMargin, startDate, endDate) : null;
    const res3 = showStrat3 ? runBacktest(data, sma3, leverage, errorMargin, startDate, endDate) : null;
    
    if (!res1 || !res1.history || res1.history.length === 0) return null;

    const mergedHistory = res1.history.map((row, i) => {
      return {
        date: row.date,
        Index: row.Index,
        Strategy1: row.Strategy,
        SMA1: row.SMA,
        Strategy2: res2 && res2.history[i] ? res2.history[i].Strategy : null,
        SMA2: res2 && res2.history[i] ? res2.history[i].SMA : null,
        Strategy3: res3 && res3.history[i] ? res3.history[i].Strategy : null,
        SMA3: res3 && res3.history[i] ? res3.history[i].SMA : null,
      };
    });

    return {
      history: mergedHistory,
      outMarketPeriods: res1.outMarketPeriods, // Shading based on primary SMA
      metrics1: res1.metrics,
      metrics2: res2 ? res2.metrics : null,
      metrics3: res3 ? res3.metrics : null
    };
  }, [data, loading, sma1, sma2, sma3, showStrat2, showStrat3, leverage, errorMargin, startDate, endDate]);

  if (loading) return <div style={{ color: 'white', textAlign: 'center', padding: '3rem' }}>Loading dataset...</div>;
  if (!backtestResult) return <div style={{ color: 'white', textAlign: 'center', padding: '3rem' }}>Not enough data.</div>;

  const { history, outMarketPeriods, metrics1, metrics2, metrics3 } = backtestResult;
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '10px', border: '1px solid #334155', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry, idx) => {
            const isPrice = entry.name.includes("SMA") || entry.name.includes("Index");
            return (
              <p key={idx} style={{ margin: 0, color: entry.color }}>
                {entry.name}: {isPrice ? entry.value.toFixed(2) : formatCcy(entry.value)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

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
            <label>Strategy 1: SMA <span style={{color: '#3b82f6'}}>{sma1}d</span></label>
            <input type="range" min="10" max="2500" step="10" value={sma1} onChange={e => setSma1(Number(e.target.value))} />
          </div>
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={showStrat2} onChange={e => setShowStrat2(e.target.checked)} />
              Strategy 2: SMA <span style={{color: '#10b981'}}>{sma2}d</span>
            </label>
            {showStrat2 && <input type="range" min="10" max="2500" step="10" value={sma2} onChange={e => setSma2(Number(e.target.value))} />}
          </div>
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={showStrat3} onChange={e => setShowStrat3(e.target.checked)} />
              Strategy 3: SMA <span style={{color: '#8b5cf6'}}>{sma3}d</span>
            </label>
            {showStrat3 && <input type="range" min="10" max="2500" step="10" value={sma3} onChange={e => setSma3(Number(e.target.value))} />}
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Leverage <span>{leverage}x</span></label>
            <input type="range" min="1" max="4" step="0.1" value={leverage} onChange={e => setLeverage(Number(e.target.value))} />
          </div>

          <div className="input-group">
            <label>Signal Threshold Buffer <span>{errorMargin}%</span></label>
            <input type="range" min="0" max="10" step="0.1" value={errorMargin} onChange={e => setErrorMargin(Number(e.target.value))} />
          </div>

          <div className="input-group">
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
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>Index</td>
                  <td style={{ padding: '0.5rem' }}>{formatPct(metrics1.indexTotalReturn)}</td>
                  <td style={{ padding: '0.5rem' }}>{formatPct(metrics1.indexCagr)}</td>
                  <td style={{ padding: '0.5rem' }}>-</td>
                  <td style={{ padding: '0.5rem' }}>-</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem', color: '#3b82f6' }}>Strat 1 ({sma1}d)</td>
                  <td style={{ padding: '0.5rem', color: metrics1.totalReturn > 0 ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics1.totalReturn)}</td>
                  <td style={{ padding: '0.5rem', color: metrics1.cagr > 0 ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics1.cagr)}</td>
                  <td style={{ padding: '0.5rem', color: 'var(--danger)' }}>{(metrics1.maxDrawdown * 100).toFixed(1)}%</td>
                  <td style={{ padding: '0.5rem' }}>{metrics1.sharpeRatio.toFixed(2)}</td>
                </tr>
                {showStrat2 && metrics2 && (
                  <tr>
                    <td style={{ padding: '0.5rem', color: '#10b981' }}>Strat 2 ({sma2}d)</td>
                    <td style={{ padding: '0.5rem', color: metrics2.totalReturn > 0 ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics2.totalReturn)}</td>
                    <td style={{ padding: '0.5rem', color: metrics2.cagr > 0 ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics2.cagr)}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--danger)' }}>{(metrics2.maxDrawdown * 100).toFixed(1)}%</td>
                    <td style={{ padding: '0.5rem' }}>{metrics2.sharpeRatio.toFixed(2)}</td>
                  </tr>
                )}
                {showStrat3 && metrics3 && (
                  <tr>
                    <td style={{ padding: '0.5rem', color: '#8b5cf6' }}>Strat 3 ({sma3}d)</td>
                    <td style={{ padding: '0.5rem', color: metrics3.totalReturn > 0 ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics3.totalReturn)}</td>
                    <td style={{ padding: '0.5rem', color: metrics3.cagr > 0 ? 'var(--success)' : 'var(--danger)' }}>{formatPct(metrics3.cagr)}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--danger)' }}>{(metrics3.maxDrawdown * 100).toFixed(1)}%</td>
                    <td style={{ padding: '0.5rem' }}>{metrics3.sharpeRatio.toFixed(2)}</td>
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
                <YAxis stroke="#94a3b8" />
                
                {outMarketPeriods && outMarketPeriods.map((period, idx) => (
                  <ReferenceArea key={idx} x1={period.start} x2={period.end} fill="#334155" fillOpacity={0.3} />
                ))}

                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" name={`Strategy 1 (${sma1}d)`} dataKey="Strategy1" stroke="#3b82f6" dot={false} strokeWidth={2} />
                {showStrat2 && <Line type="monotone" name={`Strategy 2 (${sma2}d)`} dataKey="Strategy2" stroke="#10b981" dot={false} strokeWidth={2} />}
                {showStrat3 && <Line type="monotone" name={`Strategy 3 (${sma3}d)`} dataKey="Strategy3" stroke="#8b5cf6" dot={false} strokeWidth={2} />}
                
                <Line type="monotone" name="Index" dataKey="Index" stroke="#eab308" dot={false} strokeWidth={1} opacity={0.6} />
                <Line type="monotone" name={`SMA 1 (${sma1}d)`} dataKey="SMA1" stroke="#f43f5e" dot={false} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
        </main>
      </div>
    </div>
  );
}
