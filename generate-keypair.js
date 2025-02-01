import { Keypair } from '@solana/web3.js';

// 新しいKeypairを生成
const keypair = Keypair.generate();

// 秘密鍵を直接Uint8Array形式で出力
console.log('Secret Key:', `[${keypair.secretKey}]`);
console.log('Public Key:', keypair.publicKey.toString());

console.log('\n注意: 生成された秘密鍵は64バイトの配列です。');
console.log('以下の手順で準備してください:');
console.log('1. この公開鍵アドレスをコピー:', keypair.publicKey.toString());
console.log('2. https://solfaucet.com/ にアクセス');
console.log('3. 公開鍵アドレスを貼り付けてテストSOLを取得');
