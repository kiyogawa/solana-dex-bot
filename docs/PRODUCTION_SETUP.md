# Solana DEX Trading Bot - Production Setup Guide

## 本番環境のセットアップ

### システム要件

- OS: Ubuntu 20.04 LTS以上推奨
- CPU: 4コア以上
- メモリ: 8GB以上
- ストレージ: SSD 50GB以上
- インターネット: 安定した高速接続

### セキュリティ設定

1. 専用サーバーの準備
```bash
# システムの更新
sudo apt update && sudo apt upgrade -y

# 基本的なセキュリティツールのインストール
sudo apt install ufw fail2ban -y

# ファイアウォールの設定
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

2. 専用ユーザーの作成
```bash
# トレーディングボット用ユーザーの作成
sudo useradd -m -s /bin/bash tradingbot
sudo passwd tradingbot

# sudo権限の付与
sudo usermod -aG sudo tradingbot
```

3. SSH設定の強化
```bash
# /etc/ssh/sshd_configの編集
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

### Node.jsのセットアップ

```bash
# Node.jsの安定版をインストール
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# npmの更新
sudo npm install -g npm@latest

# PM2のインストール
sudo npm install -g pm2
```

### アプリケーションのデプロイ

1. ソースコードのデプロイ
```bash
# アプリケーションディレクトリの作成
sudo mkdir -p /opt/solana-dex-bot
sudo chown tradingbot:tradingbot /opt/solana-dex-bot

# リポジトリのクローン
git clone [repository-url] /opt/solana-dex-bot
cd /opt/solana-dex-bot

# 依存関係のインストール
npm install --production
```

2. 環境変数の設定
```bash
# 環境変数ファイルの作成
sudo nano /opt/solana-dex-bot/.env

# 以下の内容を設定
NODE_ENV=production
LOG_LEVEL=info
SIMULATION_MODE=false
```

3. 秘密鍵の安全な管理
```bash
# 秘密鍵ディレクトリの作成
sudo mkdir -p /opt/solana-dex-bot/secrets
sudo chown tradingbot:tradingbot /opt/solana-dex-bot/secrets
sudo chmod 700 /opt/solana-dex-bot/secrets

# 秘密鍵ファイルの作成
sudo nano /opt/solana-dex-bot/secrets/wallet.key
sudo chmod 600 /opt/solana-dex-bot/secrets/wallet.key
```

### PM2による実行管理

1. PM2の設定ファイル作成
```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: "solana-dex-bot",
    script: "src/index.js",
    watch: false,
    env: {
      NODE_ENV: "production",
    },
    error_file: "/var/log/solana-dex-bot/error.log",
    out_file: "/var/log/solana-dex-bot/out.log",
    time: true,
    instances: 1,
    autorestart: true,
    max_restarts: 5,
    restart_delay: 5000,
  }]
}
```

2. ログディレクトリの設定
```bash
sudo mkdir -p /var/log/solana-dex-bot
sudo chown tradingbot:tradingbot /var/log/solana-dex-bot
```

3. ボットの起動
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### モニタリングとアラート設定

1. Prometheusメトリクスの設定
- メトリクス収集用エンドポイントの追加
- 主要指標の監視設定

2. Grafanaダッシュボードの設定
- パフォーマンス指標の可視化
- アラートルールの設定

3. Discordアラートの設定
```javascript
// アラート通知用の設定例
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

async function sendAlert(message) {
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (error) {
    console.error('Alert sending failed:', error);
  }
}
```

### バックアップと復旧手順

1. 定期バックアップの設定
```bash
# バックアップスクリプトの作成
#!/bin/bash
BACKUP_DIR="/backup/solana-dex-bot"
DATE=$(date +%Y%m%d)

# 設定ファイルのバックアップ
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/solana-dex-bot/.env /opt/solana-dex-bot/secrets

# ログのバックアップ
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/log/solana-dex-bot

# 古いバックアップの削除(30日以上前)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

2. 復旧手順の文書化
- バックアップからの復元手順
- 緊急停止手順
- システム再起動手順

### パフォーマンスチューニング

1. Node.jsの最適化
```bash
# メモリ制限の設定
export NODE_OPTIONS="--max-old-space-size=4096"
```

2. ネットワーク最適化
- RPC接続のフェイルオーバー設定
- WebSocket接続の維持

3. システムリソースの監視
```bash
# システムモニタリングツールのインストール
sudo apt install sysstat htop -y
```

### 定期メンテナンス手順

1. 日次チェック
- ログの確認
- パフォーマンス指標の確認
- エラー率の監視

2. 週次メンテナンス
- システムアップデート
- 依存関係の更新
- バックアップの確認

3. 月次レビュー
- パフォーマンス分析
- 設定の最適化
- セキュリティ監査

### トラブルシューティング

1. 一般的な問題の対処
- メモリリーク対策
- ネットワークタイムアウト対策
- トランザクション失敗の対処

2. エラーログの分析
```bash
# エラーログの確認
tail -f /var/log/solana-dex-bot/error.log

# パフォーマンスログの分析
sar -u 1 10  # CPU使用率
sar -r 1 10  # メモリ使用率
```

3. 緊急対応手順
- ボットの緊急停止
- ポジションの手動クローズ
- テクニカルサポートへの連絡

### セキュリティ監査チェックリスト

1. システムセキュリティ
- [ ] ファイアウォール設定の確認
- [ ] SSHアクセス制限
- [ ] システム更新の適用

2. アプリケーションセキュリティ
- [ ] 環境変数の暗号化
- [ ] 秘密鍵の安全な保管
- [ ] アクセス権限の適切な設定

3. ネットワークセキュリティ
- [ ] SSL/TLS設定
- [ ] API制限の設定
- [ ] DDoS対策

### 本番環境チェックリスト

- [ ] システム要件の確認
- [ ] セキュリティ設定の完了
- [ ] バックアップシステムの構築
- [ ] モニタリングの設定
- [ ] アラートシステムの設定
- [ ] ドキュメントの整備
- [ ] 緊急連絡先リストの作成
- [ ] テスト環境での検証完了
