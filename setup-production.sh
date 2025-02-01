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

# 必要なディレクトリの作成
setup_directories() {
    log_info "ディレクトリの作成を開始..."
    
    # アプリケーションディレクトリ
    sudo mkdir -p /opt/solana-dex-bot
    sudo chown $USER:$USER /opt/solana-dex-bot
    
    # ログディレクトリ
    sudo mkdir -p /var/log/solana-dex-bot
    sudo chown $USER:$USER /var/log/solana-dex-bot
    
    # バックアップディレクトリ
    sudo mkdir -p /backup/solana-dex-bot
    sudo chown $USER:$USER /backup/solana-dex-bot
    
    # 秘密鍵ディレクトリ
    sudo mkdir -p /opt/solana-dex-bot/secrets
    sudo chown $USER:$USER /opt/solana-dex-bot/secrets
    sudo chmod 700 /opt/solana-dex-bot/secrets
    
    log_info "ディレクトリの作成が完了しました"
}

# 依存関係のインストール
install_dependencies() {
    log_info "依存関係のインストールを開始..."
    
    # システムパッケージの更新
    sudo apt-get update
    sudo apt-get upgrade -y
    
    # 必要なパッケージのインストール
    sudo apt-get install -y curl build-essential git ufw fail2ban htop sysstat

    # Node.jsのインストール
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # npmの更新とグローバルパッケージのインストール
    sudo npm install -g npm@latest
    sudo npm install -g pm2
    
    log_info "依存関係のインストールが完了しました"
}

# ファイアウォールの設定
setup_firewall() {
    log_info "ファイアウォールの設定を開始..."
    
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow http
    sudo ufw allow https
    
    # Prometheusメトリクス用ポート
    sudo ufw allow 9090
    
    sudo ufw --force enable
    
    log_info "ファイアウォールの設定が完了しました"
}

# アプリケーションのデプロイ
deploy_application() {
    log_info "アプリケーションのデプロイを開始..."
    
    # 現在のディレクトリの取得
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    
    # ソースコードのコピー
    cp -r $SCRIPT_DIR/* /opt/solana-dex-bot/
    cd /opt/solana-dex-bot
    
    # 依存関係のインストール
    npm install --production
    
    # 本番環境設定ファイルのコピー
    cp .env.production .env
    
    log_info "アプリケーションのデプロイが完了しました"
}

# PM2の設定
setup_pm2() {
    log_info "PM2の設定を開始..."
    
    # PM2の設定ファイルをコピー
    cp ecosystem.config.cjs /opt/solana-dex-bot/
    
    # PM2の起動と自動起動の設定
    cd /opt/solana-dex-bot
    pm2 start ecosystem.config.cjs
    pm2 save
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
    
    log_info "PM2の設定が完了しました"
}

# バックアップスクリプトの設定
setup_backup() {
    log_info "バックアップスクリプトの設定を開始..."
    
    cat > /opt/solana-dex-bot/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/solana-dex-bot"
DATE=$(date +%Y%m%d)

# 設定ファイルのバックアップ
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/solana-dex-bot/.env /opt/solana-dex-bot/secrets

# ログのバックアップ
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/log/solana-dex-bot

# 古いバックアップの削除(30日以上前)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
EOF
    
    chmod +x /opt/solana-dex-bot/backup.sh
    
    # cronジョブの設定
    (crontab -l 2>/dev/null; echo "0 0 * * * /opt/solana-dex-bot/backup.sh") | crontab -
    
    log_info "バックアップスクリプトの設定が完了しました"
}

# 監視スクリプトの設定
setup_monitoring() {
    log_info "監視スクリプトの設定を開始..."
    
    cat > /opt/solana-dex-bot/monitor.sh << 'EOF'
#!/bin/bash
# システムリソースの監視
MEMORY=$(free -m | awk 'NR==2{printf "%.2f%%", $3*100/$2 }')
DISK=$(df -h | awk '$NF=="/"{printf "%s", $5}')
CPU=$(top -bn1 | grep load | awk '{printf "%.2f%%", $(NF-2)}')

# Discordへの通知
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    curl -H "Content-Type: application/json" \
         -d "{\"content\":\"System Status\nMemory: $MEMORY\nDisk: $DISK\nCPU: $CPU\"}" \
         $DISCORD_WEBHOOK_URL
fi
EOF
    
    chmod +x /opt/solana-dex-bot/monitor.sh
    
    # cronジョブの設定(1時間ごと)
    (crontab -l 2>/dev/null; echo "0 * * * * /opt/solana-dex-bot/monitor.sh") | crontab -
    
    log_info "監視スクリプトの設定が完了しました"
}

# メイン実行関数
main() {
    log_info "本番環境セットアップを開始します..."
    
    # ユーザー確認
    read -p "本番環境のセットアップを開始しますか? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        log_info "セットアップを中止します"
        exit 1
    fi
    
    # 各セットアップステップの実行
    setup_directories
    install_dependencies
    setup_firewall
    deploy_application
    setup_pm2
    setup_backup
    setup_monitoring
    
    log_info "本番環境のセットアップが完了しました"
    log_warn "重要: 以下の手順を手動で実行してください:"
    echo "1. .env ファイルの秘密鍵を設定"
    echo "2. Discord Webhook URLの設定"
    echo "3. システムの再起動"
    echo "4. pm2 status で正常に起動していることを確認"
}

# スクリプトの実行
main
