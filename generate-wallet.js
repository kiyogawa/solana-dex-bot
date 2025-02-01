import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

// 新しいウォレットを生成
const wallet = Keypair.generate();

// 秘密鍵を.envファイルに適した形式に変換
const secretKeyArray = Array.from(wallet.secretKey);

// .envファイルの内容を更新
const envContent = `# テストネット設定
SOLANA_RPC_URL=https://api.testnet.solana.com

# 秘密鍵
PRIVATE_KEY=[${secretKeyArray.join(',')}]

# RAY/USDCマーケットアドレス(テストネット)
MARKET_ADDRESS=2xiv8A5xrJ7RnGdxXB42uFEkYHJjszEhaJyKKt4WaLep

# テスト用初期資金
INITIAL_BALANCE=100

# Serum DEXのプログラムID
DEX_PROGRAM_ID=DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY`;

// .envファイルを更新
fs.writeFileSync('.env', envContent);

console.log('新しいウォレットが生成されました');
console.log('公開鍵:', wallet.publicKey.toString());
console.log('\n.envファイルが更新されました。以下の手順で続行してください:');
console.log('1. https://solfaucet.com/ にアクセス');
console.log('2. 上記の公開鍵をペーストしてテストSOLを取得');
console.log('3. npm startでボットを起動');
