import yfinance as yf
import pandas as pd
import json
import os

def download_sp500():
    print("Downloading ^GSPC data...")
    ticker = yf.Ticker('^GSPC')
    # Get max period, daily
    hist = ticker.history(period="max", interval="1d")
    
    # We only need Date and Close.
    # The index is the Date.
    hist = hist.reset_index()
    
    # Check if 'Date' or 'Datetime' is in columns
    date_col = 'Date' if 'Date' in hist.columns else 'Datetime'
    
    # Format date to string YYYY-MM-DD
    hist['formatted_date'] = hist[date_col].dt.strftime('%Y-%m-%d')
    hist['close'] = hist['Close']
    
    # Prepare JSON array format
    records = hist[['formatted_date', 'close']].rename(columns={'formatted_date': 'date'}).to_dict('records')
    
    # Ensure public directory exists
    os.makedirs('public', exist_ok=True)
    
    output_meta = {
        'symbol': '^GSPC',
        'records': records
    }
    
    output_path = 'public/sp_data.json'
    with open(output_path, 'w') as f:
        json.dump(output_meta, f)
        
    print(f"Data saved to {output_path}. Total records: {len(records)}")

if __name__ == '__main__':
    download_sp500()
