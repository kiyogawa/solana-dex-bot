#!/bin/bash

# エラーが発生したら即座に終了
set -e

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ログ関数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 基本的なセットアップ
setup_basic() {
    log_info "基本セットアップを開始..."
    
    # システムの更新
    sudo apt update
    sudo apt upgrade -y
    
    # 基本ツールのインストール
    sudo apt install -y curl git ufw fail2ban htop

    # タイムゾーンの設定
    sudo timedatectl set-timezone Asia/Tokyo
    
    log_info "基本セットアップ完了"
}

# Node.jsのセットアップ
setup_nodejs() {
    log_info "Node.jsのセットアップを開始..."
    
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # npmの更新
    sudo npm install -g npm@latest
    
    # PM2のインストール
    sudo npm install -g pm2
    
    log_info "Node.jsのセットアップ完了"
}

# セキュリティ設定
setup_security() {
    log_info "セキュリティ設定を開始..."
    
    # UFWの設定
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow http
    sudo ufw allow https
    sudo ufw --force enable
    
    # Fail2banの設定
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    
    log_info "セキュリティ設定完了"
}

# アプリケーションのデプロイ
deploy_application() {
    log_info "アプリケーションのデプロイを開始..."
    
    # アプリケーションディレクトリの作成
    sudo mkdir -p /opt/solana-dex-bot
    sudo chown $USER:$USER /opt/solana-dex-bot
    
    # ソースコードのコピー
    cp -r ./* /opt/solana-dex-bot/
    cd /opt/solana-dex-bot
    
    # 依存関係のインストール
    npm install --production
    
    # 本番環境設定の適用
    cp .env.production .env
    
    log_info "アプリケーションのデプロイ完了"
}

# PM2の設定
setup_pm2() {
    log_info "PM2の設定を開始..."
    
    cd /opt/solana-dex-bot
    
    # PM2の起動設定
    pm2 start src/index.js --name "solana-bot" --time
    pm2 save
    
    # 自動起動の設定
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
    
    log_info "PM2の設定完了"
}

# モニタリングの設定
setup_monitoring() {
    log_info "モニタリングの設定を開始..."
    
    # モニタリングスクリプトの作成
    cat > /opt/solana-dex-bot/monitor.sh << 'EOF'
#!/bin/bash

# システムリソースの取得
MEMORY=$(free -m | awk 'NR==2{printf "%.2f%%", $3*100/$2 }')
DISK=$(df -h | awk '$NF=="/"{printf "%s", $5}')
CPU=$(top -bn1 | grep load | awk '{printf "%.2f%%", $(NF-2)}')
BOT_STATUS=$(pm2 info solana-bot | grep status | awk '{print $4}')

# Discordへの通知
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    curl -H "Content-Type: application/json" \
         -d "{\"content\":\"Bot Status: $BOT_STATUS\nMemory: $MEMORY\nDisk: $DISK\nCPU: $CPU\"}" \
         $DISCORD_WEBHOOK_URL
fi
EOF
    
    chmod +x /opt/solana-dex-bot/monitor.sh
    
    # Cronジョブの設定(1時間ごと)
    (crontab -l 2>/dev/null; echo "0 * * * * /opt/solana-dex-bot/monitor.sh") | crontab -
    
    log_info "モニタリングの設定完了"
}

# メイン実行関数
main() {
    log_info "VPSデプロイを開始します..."
    
    # 各セットアップステップの実行
    setup_basic
    setup_nodejs
    setup_security
    deploy_application
    setup_pm2
    setup_monitoring
    
    log_info "VPSデプロイが完了しました"
    log_warn "重要: 以下の手順を実行してください:"
    echo "1. .envファイルの秘密鍵とDiscord Webhook URLを設定"
    echo "2. pm2 status で正常に起動していることを確認"
    echo "3. pm2 logs solana-bot でログを確認"
}

# スクリプトの実行
main
