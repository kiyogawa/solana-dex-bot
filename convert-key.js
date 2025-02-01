import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

try {
    const secretKey = '4LrqHYXeHzviyevn2pDGtBspx4TYW278rVk22VMqek8cxHHvfYhXCqBRNYQvpXU1rTJu1TqpNXPhzWKuJDM7cTUC';
    const keyPair = Keypair.fromSecretKey(bs58.decode(secretKey));
    console.log(JSON.stringify(Array.from(keyPair.secretKey)));
} catch (error) {
    console.error('Error converting key:', error);
}
