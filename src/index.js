import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { Market } from '@project-serum/serum';
import { config } from 'dotenv';
import Decimal from 'decimal.js';

config();

class SolanaDEXBot {
    constructor() {
        this.connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
        this.market = null;
        this.simulationMode = process.env.SIMULATION_MODE === 'true';
        this.debug = process.env.DEBUG === 'true';

        // 50%日利複利のための設定
        this.dailyTargetReturn = 0.50; // 50% daily return
        this.tradingIntervalsPerDay = 24; // 1時間ごとにトレード
        this.requiredReturnPerTrade = Math.pow(1 + this.dailyTargetReturn, 1/this.tradingIntervalsPerDay) - 1;
        
        // トレードパラメータの最適化
        this.rsiPeriod = 7; // より短期のRSI
        this.rsiOversold = 30; // より積極的な買いエントリー
        this.rsiOverbought = 70; // より積極的な売りエントリー
        this.stopLossPercentage = 0.02; // 2%のストップロス
        this.takeProfitPercentage = this.requiredReturnPerTrade * 1.5; // 必要リターンの1.5倍
        this.maxPositions = 3; // 同時ポジション数を増加
        this.maxDrawdown = 0.15; // 最大ドローダウン15%

        this.initialBalance = new Decimal(process.env.INITIAL_BALANCE || '1');
        
        // データ初期化
        this.resetData();
    }

    resetData() {
        this.balance = new Decimal(this.initialBalance);
        this.positions = [];
        this.trades = [];
        this.winningTrades = 0;
        this.losingTrades = 0;
        this.consecutiveLosses = 0;
        this.maxDrawdown = 0;
        this.peakBalance = this.initialBalance;
        this.lastTradePrice = null;
        this.lastTradeTime = null;
        this.priceHistory = [];
        this.volumeHistory = [];
        this.dailyProfitLoss = 0;
        this.dayStartBalance = this.initialBalance;
        this.lastDayReset = new Date().setHours(0,0,0,0);
    }

    async initialize() {
        try {
            const marketAddress = new PublicKey(process.env.MARKET_ADDRESS);
            const programId = new PublicKey(process.env.DEX_PROGRAM_ID);
            
            this.market = await Market.load(
                this.connection,
                marketAddress,
                {},
                programId
            );

            console.log('Market initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing market:', error);
            return false;
        }
    }

    async getMarketData() {
        try {
            const bids = await this.market.loadBids(this.connection);
            const asks = await this.market.loadAsks(this.connection);
            
            const bestBid = bids.getL2(1)[0]?.[0] ?? null;
            const bestAsk = asks.getL2(1)[0]?.[0] ?? null;
            
            if (bestBid === null || bestAsk === null) {
                return null;
            }
            
            // 出来高の計算
            const bidVolume = bids.getL2(5).reduce((acc, [price, size]) => acc + size, 0);
            const askVolume = asks.getL2(5).reduce((acc, [price, size]) => acc + size, 0);
            
            return {
                price: (bestBid + bestAsk) / 2,
                spread: bestAsk - bestBid,
                volume: bidVolume + askVolume
            };
        } catch (error) {
            console.error('Error getting market data:', error);
            return null;
        }
    }

    calculateRSI(prices, period = 7) {
        if (prices.length < period + 1) return null;

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const difference = prices[prices.length - i] - prices[prices.length - i - 1];
            if (difference >= 0) {
                gains += difference;
            } else {
                losses -= difference;
            }
        }

        const averageGain = gains / period;
        const averageLoss = losses / period;

        if (averageLoss === 0) return 100;

        const rs = averageGain / averageLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateVolatility(prices, period = 20) {
        if (prices.length < period) return 0;
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    async analyzeTradingOpportunity() {
        try {
            const marketData = await this.getMarketData();
            if (!marketData) {
                return {
                    action: 'hold',
                    price: 0,
                    reason: 'Unable to get market data'
                };
            }

            const { price, spread, volume } = marketData;

            // 価格履歴とボリューム履歴の更新
            this.priceHistory.push(price);
            this.volumeHistory.push(volume);
            if (this.priceHistory.length > 50) {
                this.priceHistory.shift();
                this.volumeHistory.shift();
            }

            // テクニカル指標の計算
            const rsi = this.calculateRSI(this.priceHistory, this.rsiPeriod);
            const volatility = this.calculateVolatility(this.priceHistory);
            const volumeMA = this.volumeHistory.reduce((a, b) => a + b, 0) / this.volumeHistory.length;
            
            // 日次リセットチェック
            const currentDayStart = new Date().setHours(0,0,0,0);
            if (currentDayStart > this.lastDayReset) {
                this.dayStartBalance = this.balance;
                this.dailyProfitLoss = 0;
                this.lastDayReset = currentDayStart;
            }

            // トレード判断
            let action = 'hold';
            let reason = 'No clear trading signal';

            // ボリュームと値幅のチェック
            const sufficientVolume = volume > volumeMA * 0.8;
            const acceptableSpread = spread < price * 0.003; // スプレッド0.3%以下

            if (rsi !== null && sufficientVolume && acceptableSpread) {
                // 日次目標達成チェック
                const dailyReturn = this.balance.div(this.dayStartBalance).minus(1).toNumber();
                const remainingDailyTarget = (1 + this.dailyTargetReturn) - (1 + dailyReturn);

                if (dailyReturn < this.dailyTargetReturn) { // 日次目標未達の場合のみトレード
                    if (rsi < this.rsiOversold && volatility > 0.001) {
                        action = 'buy';
                        reason = 'RSI oversold with sufficient volatility';
                    } else if (rsi > this.rsiOverbought) {
                        action = 'sell';
                        reason = 'RSI overbought condition';
                    }
                }
            }

            return {
                action,
                price,
                reason,
                metrics: {
                    rsi,
                    volatility,
                    spread,
                    volume
                }
            };
        } catch (error) {
            console.error('Error analyzing trading opportunity:', error);
            return {
                action: 'hold',
                price: 0,
                reason: 'Error during analysis'
            };
        }
    }

    async run() {
        console.log('Starting Solana DEX Trading Bot (50% Daily Compound Interest Strategy)');
        
        const initialized = await this.initialize();
        if (!initialized) {
            console.error('Failed to initialize market. Exiting...');
            return;
        }

        // メインループ
        while (true) {
            try {
                await this.tradingCycle();
                // 1時間ごとのトレード
                await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000 / this.tradingIntervalsPerDay));
            } catch (error) {
                console.error('Error in trading cycle:', error);
                await new Promise(resolve => setTimeout(resolve, 60 * 1000));
            }
        }
    }

    async tradingCycle() {
        try {
            console.log('\n--- Starting market analysis ---');
            
            const analysis = await this.analyzeTradingOpportunity();
            console.log('Analysis result:', analysis);

            if (analysis.action !== 'hold') {
                console.log('Trading opportunity found:', analysis);
                await this.executeTrade(analysis);
            } else {
                console.log('No trading opportunity at this time');
            }

            this.displayPerformance();

        } catch (error) {
            console.error('Error in trading cycle:', error);
            throw error;
        }
    }

    async executeTrade(analysis) {
        try {
            const { action, price, metrics } = analysis;
            
            if (action === 'buy') {
                const positionSize = this.calculatePositionSize(price, metrics.volatility);
                console.log(`Executing buy order for ${positionSize} tokens at ${price} SOL`);
                
                this.positions.push({
                    price,
                    amount: positionSize,
                    timestamp: new Date(),
                    stopLoss: price * (1 - this.stopLossPercentage),
                    takeProfit: price * (1 + this.takeProfitPercentage)
                });
                
                this.balance = this.balance.minus(new Decimal(positionSize).mul(price));
                
            } else if (action === 'sell' && this.positions.length > 0) {
                const position = this.positions[0];
                console.log(`Executing sell order for ${position.amount} tokens at ${price} SOL`);
                
                const profit = new Decimal(price - position.price).mul(position.amount);
                const profitPercentage = profit.div(new Decimal(position.price).mul(position.amount)).mul(100);
                
                console.log(`Profit: ${profit.toFixed(8)} SOL (${profitPercentage.toFixed(2)}%)`);
                
                this.balance = this.balance.plus(new Decimal(position.amount).mul(price));
                this.dailyProfitLoss += profit.toNumber();
                
                this.positions.shift();
                
                if (profit.gt(0)) {
                    this.winningTrades++;
                    this.consecutiveLosses = 0;
                } else {
                    this.losingTrades++;
                    this.consecutiveLosses++;
                }
            }
            
            if (this.balance.gt(this.peakBalance)) {
                this.peakBalance = this.balance;
            }
            
            const currentDrawdown = this.peakBalance.minus(this.balance).div(this.peakBalance).toNumber();
            if (currentDrawdown > this.maxDrawdown) {
                this.maxDrawdown = currentDrawdown;
            }
            
        } catch (error) {
            console.error('Error executing trade:', error);
            throw error;
        }
    }

    calculatePositionSize(price, volatility) {
        const accountBalance = this.balance;
        const riskAmount = accountBalance.mul(0.1); // リスク許容額を増加
        const volatilityAdjustment = Math.min(1, Math.max(0.1, 1 - volatility * 10));
        return riskAmount.mul(volatilityAdjustment).div(price);
    }

    displayPerformance() {
        const dailyReturn = this.balance.div(this.dayStartBalance).minus(1).mul(100);
        const totalReturn = this.balance.div(this.initialBalance).minus(1).mul(100);
        
        console.log('\nPerformance Summary:');
        console.log('Initial Balance:', this.initialBalance.toString(), 'SOL');
        console.log('Current Balance:', this.balance.toString(), 'SOL');
        console.log('Daily Return:', `${dailyReturn.toFixed(2)}%`);
        console.log('Total Return:', `${totalReturn.toFixed(2)}%`);
        console.log('Daily Profit/Loss:', this.dailyProfitLoss.toFixed(8), 'SOL');
        console.log('Active Positions:', this.positions.length);
        console.log('Win Rate:', `${(this.winningTrades / (this.winningTrades + this.losingTrades) * 100 || 0).toFixed(2)}%`);
        console.log('Max Drawdown:', `${(this.maxDrawdown * 100).toFixed(2)}%`);
    }
}

// ボットのインスタンス作成と起動
const bot = new SolanaDEXBot();
bot.run().catch(console.error);
