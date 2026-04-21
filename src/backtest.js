/**
 * Core backtesting logic.
 * @param {Array} rawData - Array of {date, close}
 * @param {number} smaLength - SMA period count
 * @param {string} smaUnit - 'days' | 'weeks'
 * @param {number} leverage - Leverage multiplier (e.g., 1, 1.5, 2)
 * @param {number} errorMarginPct - Execution slip/error in percent (e.g., 1 for 1%)
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {boolean} useMM - Parse into Money Market
 * @param {number} mmApr - Annual percentage rate of money market
 */
export function runBacktest(rawData, smaLength, smaUnit, leverage, errorMarginPct, startDate, endDate, useMM, mmApr) {
  if (!rawData || rawData.length < (smaUnit === 'weeks' ? smaLength * 4 : smaLength)) return { history: [], metrics: null };

  const dataWithSma = [];
  
  if (smaUnit === 'weeks') {
    const weeklyCloses = [];
    const weeklySmas = [];
    let sum = 0;
    
    const eows = [];
    for(let i=0; i < rawData.length; i++) {
        const todayDate = new Date(rawData[i].date);
        const tomorrow = i+1 < rawData.length ? new Date(rawData[i+1].date) : null;
        // End of week logic: if tomorrow's weekday number is <= today's, the week flipped
        // e.g. Friday (5) -> Monday (1), 1 <= 5 true
        if (!tomorrow || tomorrow.getDay() <= todayDate.getDay()) {
            weeklyCloses.push(rawData[i].close);
            sum += rawData[i].close;
            if (weeklyCloses.length > smaLength) {
                sum -= weeklyCloses[weeklyCloses.length - 1 - smaLength];
            }
            if (weeklyCloses.length >= smaLength) {
                weeklySmas.push(sum / smaLength);
            } else {
                weeklySmas.push(null);
            }
            eows.push(i);
        }
    }
    
    // Assign latest finalized weekly SMA to daily points
    let currentSma = null;
    let eowPointer = 0;
    for(let i=0; i < rawData.length; i++) {
        // We write the current finalized SMA to today.
        // This ensures no look-ahead. The SMA only updates AFTER the week fully ends.
        if (currentSma !== null) {
            dataWithSma.push({
                date: rawData[i].date,
                close: rawData[i].close,
                sma: currentSma
            });
        }
        
        // If today is an end-of-week, the finalized SMA unlocks for tomorrow onwards
        if (eowPointer < eows.length && i === eows[eowPointer]) {
            currentSma = weeklySmas[eowPointer];
            eowPointer++;
        }
    }
  } else {
    // Native daily SMA
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
  
  let inMarket = false;
  let entryPrice = 0;
  
  let outStart = filteredData[0].date;
  const outMarketPeriods = [];
  const trades = [];
  
  let peakValue = cash;
  let maxDrawdown = 0;
  
  let indexPeak = initialPrice;
  let indexMaxDrawdown = 0;
  
  const history = [];
  const dailyReturns = [];
  
  const errFactorBuy = 1 + (errorMarginPct / 100);
  const errFactorSell = 1 - (errorMarginPct / 100);
  const dailyMMFactor = useMM ? Math.pow(1 + (mmApr / 100), 1 / 252) : 1;

  let lastValue = cash;

  for (let i = 0; i < filteredData.length; i++) {
    const today = filteredData[i];
    const prev = i > 0 ? filteredData[i-1] : null;

    const prev2 = i > 1 ? filteredData[i-2] : null;

    // Check signals using strict crossovers
    const crossUp = prev2 && prev2.close <= prev2.sma * errFactorBuy && prev.close > prev.sma * errFactorBuy;
    const crossDown = prev && prev.close < prev.sma * errFactorSell;

    // Buy strictly on a fresh crossover from below + threshold buffer
    if (crossUp && !inMarket) {
        inMarket = true;
        entryPrice = today.close;
        trades.push({ type: 'BUY', date: today.date, price: entryPrice });
        if (outStart) {
            outMarketPeriods.push({ start: outStart, end: today.date });
            outStart = null;
        }
    } 
    // Sell whenever price drops below the threshold buffer
    else if (crossDown && inMarket) {
        inMarket = false;
        outStart = today.date;
        // Apply leverage return for this last partial period
        const returnSinceEntry = (today.close - entryPrice) / entryPrice;
        cash = cash * (1 + (returnSinceEntry * leverage));
        trades.push({ type: 'SELL', date: today.date, price: today.close, return: returnSinceEntry * leverage });
    }

    // Accrue Money Market interest if out of the market
    if (!inMarket && i > 0) {
        cash = cash * dailyMMFactor;
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

    // Index max drawdown
    if (today.close > indexPeak) {
        indexPeak = today.close;
    }
    const indexCurrentDrawdown = (indexPeak - today.close) / indexPeak;
    if (indexCurrentDrawdown > indexMaxDrawdown) {
        indexMaxDrawdown = indexCurrentDrawdown;
    }

    // Chart curve strings (negative)
    const stratDrawdownChart = peakValue === 0 ? 0 : (currentValue - peakValue) / peakValue;
    const indexDrawdownChart = indexPeak === 0 ? 0 : (today.close - indexPeak) / indexPeak;
    const stratRelativeChart = (currentValue / today.close) - 1;

    // Track daily returns for Sharpe
    const dailyReturn = (currentValue - lastValue) / lastValue;
    dailyReturns.push(dailyReturn);
    lastValue = currentValue;

    history.push({
      date: today.date,
      Strategy: currentValue,
      StrategyDrawdown: stratDrawdownChart,
      StrategyRelative: stratRelativeChart,
      Index: today.close,
      IndexDrawdown: indexDrawdownChart,
      SMA: today.sma
    });
  }

  if (!inMarket && outStart) {
      outMarketPeriods.push({ start: outStart, end: filteredData[filteredData.length - 1].date });
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
    outMarketPeriods,
    trades,
    metrics: {
      totalReturn,
      cagr,
      maxDrawdown,
      sharpeRatio,
      indexTotalReturn,
      indexCagr,
      indexMaxDrawdown
    }
  };
}
