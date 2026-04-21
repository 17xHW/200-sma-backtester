import yfinance as yf
import pandas as pd
import json
import os

ASSETS = {
    'sp500': '^GSPC',
    'nasdaq': '^IXIC',
    'dax': '^GDAXI',
    'gold': 'GC=F',
    'silver': 'SI=F'
}

def download_data():
    os.makedirs('public', exist_ok=True)
    
    for name, symbol in ASSETS.items():
        print(f"Downloading {symbol} data for {name}...")
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="max", interval="1d")
        
        hist = hist.reset_index()
        if hist.empty:
            print(f"Failed to fetch data for {symbol}")
            continue
            
        date_col = 'Date' if 'Date' in hist.columns else 'Datetime'
        
        hist['formatted_date'] = hist[date_col].dt.strftime('%Y-%m-%d')
        hist['close'] = hist['Close']
        
        records = hist[['formatted_date', 'close']].rename(columns={'formatted_date': 'date'}).to_dict('records')
        
        output_meta = {
            'symbol': symbol,
            'name': name,
            'records': records
        }
        
        output_path = f'public/{name}.json'
        with open(output_path, 'w') as f:
            json.dump(output_meta, f)
            
        print(f"Saved {name} to {output_path} ({len(records)} records)")

if __name__ == '__main__':
    download_data()
