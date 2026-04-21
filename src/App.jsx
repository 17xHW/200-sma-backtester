import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  const [smaLength, setSmaLength] = useState(1000); // 200 weeks
  const [leverage, setLeverage] = useState(1);
  const [errorMargin, setErrorMargin] = useState(0); // 0%
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
    return runBacktest(data, smaLength, leverage, errorMargin, startDate, endDate);
  }, [data, loading, smaLength, leverage, errorMargin, startDate, endDate]);

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', padding: '3rem' }}>Loading dataset...</div>;
  }

  if (!backtestResult || !backtestResult.metrics) {
    return <div style={{ color: 'white', textAlign: 'center', padding: '3rem' }}>Not enough data or invalid parameters.</div>;
  }

  const { history, metrics } = backtestResult;
  
  // Custom Tooltip for Chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '10px', border: '1px solid #334155', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} style={{ margin: 0, color: entry.color }}>
              {entry.name}: {entry.name.includes("SMA") || entry.name.includes("Index") ? entry.value.toFixed(2) : formatCcy(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-container">
      <header>
        <h1>S&P 500 SMA Strategy</h1>
        <p>Backtesting engine for the 200-week (or custom) moving average trend following strategy.</p>
      </header>

      <div className="dashboard-grid">
        <aside className="sidebar card">
          <h3>Parameters</h3>
          
          <div className="input-group">
            <label>SMA Length (days) <span>{smaLength}</span></label>
            <input type="range" min="10" max="2500" step="10" value={smaLength} onChange={e => setSmaLength(Number(e.target.value))} />
            <small style={{color: 'var(--text-secondary)'}}>1000 days = 200 weeks</small>
          </div>

          <div className="input-group">
            <label>Leverage <span>{leverage}x</span></label>
            <input type="range" min="1" max="4" step="0.1" value={leverage} onChange={e => setLeverage(Number(e.target.value))} />
          </div>

          <div className="input-group">
            <label>Signal Threshold Buffer <span>{errorMargin}%</span></label>
            <input type="range" min="0" max="10" step="0.1" value={errorMargin} onChange={e => setErrorMargin(Number(e.target.value))} />
            <small style={{color: 'var(--text-secondary)'}}>Require price to cross SMA by X% to avoid noise.</small>
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
          <div className="stats-grid">
            <div className="card stat-card">
              <span className="stat-label">Total Return</span>
              <span className={`stat-value ${metrics.totalReturn >= 0 ? 'up' : 'down'}`}>
                {formatPct(metrics.totalReturn)}
              </span>
              <small style={{color: 'var(--text-secondary)'}}>Index: {formatPct(metrics.indexTotalReturn)}</small>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Annualized (CAGR)</span>
              <span className={`stat-value ${metrics.cagr >= 0 ? 'up' : 'down'}`}>
                {formatPct(metrics.cagr)}
              </span>
              <small style={{color: 'var(--text-secondary)'}}>Index: {formatPct(metrics.indexCagr)}</small>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Max Drawdown</span>
              <span className="stat-value down">
                {(metrics.maxDrawdown * 100).toFixed(1)}%
              </span>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Sharpe Ratio</span>
              <span className="stat-value" style={{ color: '#a78bfa' }}>
                {metrics.sharpeRatio.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="card chart-container">
            <h3>Portfolio Performance</h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={history} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" minTickGap={30} tickFormatter={(tick) => tick.substring(0, 4)} />
                <YAxis stroke="#94a3b8" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="Strategy" stroke="#3b82f6" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="Index" stroke="#eab308" dot={false} strokeWidth={1} opacity={0.8} />
                <Line type="monotone" dataKey="SMA" stroke="#f43f5e" dot={false} strokeWidth={1} strokeDasharray="3 3" opacity={0.8} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
        </main>
      </div>
    </div>
  );
}
