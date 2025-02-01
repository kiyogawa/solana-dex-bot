# Solana DEX Trading Bot

月利100%を目指すSolana DEXトレーディングボット

## 特徴

- RSIとSMAを使用した取引戦略
- リスク管理機能(ストップロス、テイクプロフィット)
- ポジションサイズの自動計算
- 1分間隔での市場分析
- Serum DEX APIを使用した自動取引

## セットアップ

1. リポジトリをクローン:
```bash
git clone [repository-url]
cd solana-dex-bot
```

2. 依存関係をインストール:
```bash
npm install
```

3. 環境変数の設定:
- `.env.example`を`.env`にコピー
- 必要な情報を入力:
  - `SOLANA_RPC_URL`: SolanaのRPC URL
  - `PRIVATE_KEY`: あなたのSolanaウォレットの秘密鍵(JSON配列形式)
  - `MARKET_ADDRESS`: トレードするマーケットのアドレス
  - `INITIAL_BALANCE`: 初期取引資金(USDC)

## 使用方法

ボットを起動:
```bash
npm start
```

## リスク警告

このボットは以下のリスク管理戦略を実装していますが、暗号資産取引には重大なリスクが伴います:

- 1取引あたりの最大損失を資金の2%に制限
- RSIとSMAによる市場分析
- ストップロスとテイクプロフィットの設定

**注意**: このボットは教育目的で作成されています。実際の取引では、十分なテストと理解が必要です。

## 設定パラメータ

- `stopLossPercentage`: 2%(デフォルト)
- `takeProfitPercentage`: 5%(デフォルト)
- `targetMonthlyReturn`: 100%
- 分析間隔: 1分

## 取引戦略

1. RSIが30未満で、現在価格がSMA20を下回り、SMA20がSMA50を下回る場合に買い
2. RSIが70を超え、現在価格がSMA20を上回り、SMA20がSMA50を上回る場合に売り
3. 上記条件を満たさない場合はホールド

## 免責事項

このボットは投資アドバイスではありません。実際の取引では、以下の点に注意してください:

- 十分なテストを行う
- リスク管理を徹底する
- 取引に使用する資金は損失を許容できる額に制限する
