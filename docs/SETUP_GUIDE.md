# セットアップガイド

## 1. 準備するもの

1. Solanaウォレット
   - Phantom等のウォレットで新規作成
   - 十分なSOL(取引手数料用)
   - 取引用のUSDC

2. 開発環境
   - Node.js v16以上
   - npm or yarn
   - テキストエディタ(VSCode推奨)

## 2. インストール手順

1. プロジェクトのダウンロード
```bash
git clone [repository-url]
cd solana-dex-bot
```

2. 依存パッケージのインストール
```bash
npm install
```

3. 環境設定ファイルの作成
```bash
cp .env.example .env
```

## 3. 環境変数の設定

1. Solana RPCの設定
   - メインネット用: https://api.mainnet-beta.solana.com
   - テストネット用: https://api.testnet.solana.com
   
2. ウォレット設定
   - Phantomウォレットから秘密鍵をエクスポート
   - 秘密鍵をJSON配列形式に変換
   - .envファイルのPRIVATE_KEYに設定

3. マーケットアドレスの設定
   - RAY/USDC: 2xiv8A5xrJ7RnGdxXB42uFEkYHJjszEhaJyKKt4WaLep
   - SRM/USDC: ByRys5tuUWDgL73G8JBAEfkdFf8JWBzPBDHsBVQ5vbQA
   - 他のマーケットは[Serum Markets](https://github.com/project-serum/serum-ts/blob/master/packages/serum/src/markets.json)で確認

## 4. ボットの起動

1. テストモードでの起動(推奨)
```bash
# テストネットで実行
npm start
```

2. 本番モードでの起動
```bash
# メインネットで実行(リスクを理解した上で)
npm start
```

## 5. 動作確認

1. ログの確認
```
Market initialized successfully
Analyzing market...
```

2. 取引の確認
- Solanaエクスプローラーで取引を確認
- ウォレットの残高変動を確認

## 6. パラメータ調整

### RSI設定
```javascript
// より慎重な設定
rsi < 25  // 買いシグナル
rsi > 75  // 売りシグナル

// よりアグレッシブな設定
rsi < 35  // 買いシグナル
rsi > 65  // 売りシグナル
```

### リスク設定
```javascript
// より保守的な設定
stopLossPercentage = 0.01    // 1%
takeProfitPercentage = 0.03  // 3%

// よりアグレッシブな設定
stopLossPercentage = 0.03    // 3%
takeProfitPercentage = 0.08  // 8%
```

## 7. トラブルシューティング

### よくある問題と解決方法

1. 接続エラー
```
Error: Unable to connect to the Solana network
```
- RPCエンドポイントの確認
- インターネット接続の確認

2. 残高不足
```
Error: Insufficient funds
```
- SOL残高の確認(手数料用)
- USDC残高の確認(取引用)

3. マーケットエラー
```
Error: Market not found
```
- マーケットアドレスの確認
- 取引ペアの存在確認

## 8. パフォーマンスモニタリング

1. 収益の計算
```
日次収益率 = (現在残高 - 前日残高) / 前日残高 × 100
月次収益率 = (現在残高 - 月初残高) / 月初残高 × 100
```

2. リスク指標
```
最大ドローダウン = (最高残高 - 最低残高) / 最高残高 × 100
シャープレシオ = (運用収益率 - 無リスク金利) / ボラティリティ
```

## 9. 安全な運用のために

1. 資金管理
- 取引資金は損失を許容できる額に制限
- 全資産の10%以下での運用を推奨

2. リスク管理
- 1日の損失上限を設定(推奨:6%)
- 連続損失時は取引を一時停止

3. バックアップ
- 秘密鍵のバックアップ
- 取引ログの定期的な保存

4. モニタリング
- 定期的な性能評価
- パラメータの最適化
- 市場環境の変化への対応
