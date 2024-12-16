type ChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement>;
type ProcessedAsset = {
  symbol: string;
  address: string;
  maxLtv: number;
  utilization: number;
};


import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Percent,
  DollarSign
} from 'lucide-react';

const LOGO_BASE_URL = "https://raw.githubusercontent.com/unhappyben/token-logos/main/logos";

// Types
interface TokenPrice {
  price: number;
  decimals: number;
  symbol: string;
  timestamp: number;
}

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  maxLtv: number;
  utilization: number;
  borrowApy: number;
}

interface Strategy {
  id: string;
  name: string;
  apy: number;
  token: string;
  minDeposit: number;
}

const YieldCalculator: React.FC = () => {
  // State
  const [selectedAsset, setSelectedAsset] = useState<TokenInfo | null>(null);
  const [prices, setPrices] = useState<Record<string, TokenPrice>>({});
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [depositAmount, setDepositAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<TokenInfo[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [siloData, goatData] = await Promise.all([
          fetch('https://app.silo.finance/_next/data/latest/index.json').then(r => r.json()),
          fetch('https://api.goat.fi/apy/breakdown').then(r => r.json())
        ]);

        const processedAssets = processSiloData(siloData);
        setAssets(processedAssets);

        const tokenAddresses = processedAssets.map(a => a.address).join(',');
        const prices = await fetch(`https://api.defillama.com/prices/current/arbitrum:${tokenAddresses}`).then(r => r.json());
        setPrices(prices.coins);

        await loadTokenLogos(processedAssets);
        setLoading(false);
      } catch (error) {
        console.error('Error loading initial data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Load token logos
  const loadTokenLogos = async (tokens: TokenInfo[]) => {
    const logoMap: Record<string, string> = {};
    for (const token of tokens) {
      try {
        const logoUrl = `${LOGO_BASE_URL}/${token.symbol.toLowerCase()}.png`;
        const response = await fetch(logoUrl, { method: 'HEAD' });
        logoMap[token.symbol] = response.ok ? logoUrl : '/placeholder.png';
      } catch (error) {
        console.error(`Error loading logo for ${token.symbol}:`, error);
        logoMap[token.symbol] = '/placeholder.png';
      }
    }
    setLogos(logoMap);
  };

  // Calculate health factor
  const calculateHealthFactor = () => {
    if (!selectedAsset || !depositAmount || !borrowAmount) return 0;
    const deposit = parseFloat(depositAmount);
    const borrow = parseFloat(borrowAmount);
    if (isNaN(deposit) || isNaN(borrow) || deposit <= 0 || borrow <= 0) return 0;
    const maxBorrow = deposit * (selectedAsset.maxLtv / 100);
    return (maxBorrow / borrow) * 100;
  };

  // Calculate yields
  const calculateYields = () => {
    if (!selectedAsset || !selectedStrategy || !depositAmount || !borrowAmount) return null;
    const deposit = parseFloat(depositAmount);
    const borrow = parseFloat(borrowAmount);
    if (isNaN(deposit) || isNaN(borrow) || deposit <= 0 || borrow <= 0) return null;
    const borrowCost = borrow * (selectedAsset.borrowApy / 100);
    const yield_ = borrow * (selectedStrategy.apy / 100);
    const netYield = yield_ - borrowCost;
    return {
      daily: netYield / 365,
      weekly: netYield / 52,
      monthly: netYield / 12,
      annual: netYield,
      apy: (netYield / deposit) * 100
    };
  };

  const healthFactor = calculateHealthFactor();
  const yields = calculateYields();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yield Calculator</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Asset Selection */}
        <select 
          onChange={(e) => setSelectedAsset(assets[parseInt(e.target.value)])}
          value={selectedAsset ? assets.indexOf(selectedAsset) : ''}
        >
          <option value="">Select an asset</option>
          {assets.map((asset, idx) => (
            <option key={idx} value={idx}>
              {asset.symbol} - Max LTV: {asset.maxLtv}% - Util: {asset.utilization.toFixed(2)}%
            </option>
          ))}
        </select>

        {/* Amount Inputs */}
        <Input
          type="number"
          onChange={(e) => setDepositAmount(e.target.value)}
          placeholder="Deposit Amount ($)"
        />
        <Input
          type="number"
          onChange={(e) => setBorrowAmount(e.target.value)}
          placeholder="Borrow Amount ($)"
        />

        {/* Health Factor */}
        {healthFactor > 0 && (
          <div>
            <h3>Health Factor</h3>
            <p>{healthFactor.toFixed(2)}%</p>
            {healthFactor < 110 && (
              <p><AlertTriangle /> High liquidation risk</p>
            )}
          </div>
        )}

        {/* Strategy Selection */}
        <select
          onChange={(e) => setSelectedStrategy(strategies[parseInt(e.target.value)])}
          value={selectedStrategy ? strategies.indexOf(selectedStrategy) : ''}
        >
          <option value="">Select a strategy</option>
          {strategies.map((strategy, idx) => (
            <option key={idx} value={idx}>
              {strategy.name} - {strategy.apy.toFixed(2)}% APY
            </option>
          ))}
        </select>

        {/* Results */}
        {yields && (
          <div>
            <h3>Borrow APY</h3>
            <p>-{selectedAsset?.borrowApy.toFixed(2)}%</p>
            <h3>Strategy APY</h3>
            <p>+{selectedStrategy?.apy.toFixed(2)}%</p>
            <h3>Net APY</h3>
            <p>{yields.apy.toFixed(2)}%</p>
            <h3>Projected Yields</h3>
            <p>Daily: ${yields.daily.toFixed(2)}</p>
            <p>Weekly: ${yields.weekly.toFixed(2)}</p>
            <p>Monthly: ${yields.monthly.toFixed(2)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default YieldCalculator;
