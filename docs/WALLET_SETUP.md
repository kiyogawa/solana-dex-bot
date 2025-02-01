# Phantomウォレットのセットアップ手順

## 1. Phantomウォレットのインストール
1. [Phantom Wallet](https://phantom.app/)をブラウザにインストール
2. 新しいウォレットを作成
3. シードフレーズを安全に保管

## 2. テストネット用の設定
1. Phantomウォレットを開く
2. 設定 → ネットワーク → 「Testnet」を選択
3. [Solana Testnet Faucet](https://solfaucet.com/)からテストSOLを取得

## 3. 秘密鍵のエクスポート
1. Phantomウォレットを開く
2. 設定 → 「秘密鍵をエクスポート」を選択
3. パスワードを入力
4. 表示された秘密鍵をコピー

## 4. 環境変数の設定
`.env`ファイルに以下の情報を設定:

```env
# テストネットを使用
SOLANA_RPC_URL=https://api.testnet.solana.com

# Phantomからエクスポートした秘密鍵
PRIVATE_KEY=[]  # ここに秘密鍵を入力

# RAY/USDCマーケットアドレス(テストネット用)
MARKET_ADDRESS=2xiv8A5xrJ7RnGdxXB42uFEkYHJjszEhaJyKKt4WaLep

# 初期取引資金(テスト用)
INITIAL_BALANCE=100
```

## 5. 確認事項
- テストネットで十分なSOL残高があること
- 秘密鍵が正しくJSON配列形式で設定されていること
- マーケットアドレスがテストネット用であること
