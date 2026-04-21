/**
 * Core backtesting logic.
 * @param {Array} rawData - Array of {date, close}
 * @param {number} smaLength - SMA period in days (e.g., 200 for 200 days, 1000 for 200 weeks)
 * @param {number} leverage - Leverage multiplier (e.g., 1, 1.5, 2)
 * @param {number} errorMarginPct - Execution slip/error in percent (e.g., 1 for 1%)
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
export function runBacktest(rawData, smaLength, leverage, errorMarginPct, startDate, endDate) {
  if (!rawData || rawData.length < smaLength) return { history: [], metrics: null };

  // 1. Precompute SMA for the entire dataset
  const dataWithSma = [];
  let sum = 0;
  
  for (let i = 0; i < rawData.length; i++) {
    sum += rawData[i].close;
    if (i >= smaLength) {
      sum -= rawData[i - smaLength].close;
    }
    
    if (i >= smaLength - 1) {
      dataWithSma.push({
        date: rawData[i].date,
        close: rawData[i].close,
        sma: sum / smaLength
      });
    }
  }

  // 2. Filter by Date
  const filteredData = dataWithSma.filter(d => 
    (!startDate || d.date >= startDate) && 
    (!endDate || d.date <= endDate)
  );

  if (filteredData.length === 0) return { history: [], metrics: null };

  // 3. Run Strategy
  const initialPrice = filteredData[0].close;
  let cash = initialPrice;
  
  // Buy & Hold base comparison
  
  let inMarket = false;
  let entryPrice = 0;
  
  let peakValue = cash;
  let maxDrawdown = 0;
  
  const history = [];
  const dailyReturns = [];
  
  const errFactorBuy = 1 + (errorMarginPct / 100);
  const errFactorSell = 1 - (errorMarginPct / 100);


  let lastValue = cash;

  for (let i = 0; i < filteredData.length; i++) {
    const today = filteredData[i];
    const prev = i > 0 ? filteredData[i-1] : null;

    // Check signals (Compare previous day close to previous day SMA with threshold)
    // Buy when crossing from below + threshold buffer
    if (prev && prev.close > prev.sma * errFactorBuy && !inMarket) {
        inMarket = true;
        entryPrice = today.close;
    } 
    // Sell when crossing from above - threshold buffer
    else if (prev && prev.close < prev.sma * errFactorSell && inMarket) {
        inMarket = false;
        // Apply leverage return for this last partial period
        const returnSinceEntry = (today.close - entryPrice) / entryPrice;
        cash = cash * (1 + (returnSinceEntry * leverage));
    }

    // Mark to market daily value
    let currentValue = cash;
    if (inMarket && entryPrice > 0) {
        const currentReturn = (today.close - entryPrice) / entryPrice;
        currentValue = cash * (1 + (currentReturn * leverage));
    }


    // Track max drawdown
    if (currentValue > peakValue) {
        peakValue = currentValue;
    }
    const currentDrawdown = (peakValue - currentValue) / peakValue;
    if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
    }

    // Track daily returns for Sharpe
    const dailyReturn = (currentValue - lastValue) / lastValue;
    dailyReturns.push(dailyReturn);
    lastValue = currentValue;

    history.push({
      date: today.date,
      Strategy: currentValue,
      Index: today.close,
      SMA: today.sma
    });
  }

  // 4. Calculate Metrics
  const totalReturn = (lastValue - initialPrice) / initialPrice;
  const indexTotalReturn = (history[history.length-1].Index - initialPrice) / initialPrice;
  
  const years = filteredData.length / 252; // approx trading days
  const cagr = Math.pow(lastValue / initialPrice, 1 / years) - 1;
  const indexCagr = Math.pow(history[history.length-1].Index / initialPrice, 1 / years) - 1;

  // Sharpe Ratio
  const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const stdDailyReturn = Math.sqrt(dailyReturns.reduce((sq, n) => sq + Math.pow(n - avgDailyReturn, 2), 0) / dailyReturns.length);
  // Assuming 0% risk free rate for simplicity
  const sharpeRatio = stdDailyReturn === 0 ? 0 : (avgDailyReturn / stdDailyReturn) * Math.sqrt(252);

  return {
    history,
    metrics: {
      totalReturn,
      cagr,
      maxDrawdown,
      sharpeRatio,
      indexTotalReturn,
      indexCagr
    }
  };
}
