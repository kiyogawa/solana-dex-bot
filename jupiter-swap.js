import { Connection, PublicKey, Keypair, VersionedTransaction, clusterApiUrl } from '@solana/web3.js';
import fetch from 'node-fetch';
import { config } from 'dotenv';
import bs58 from 'bs58';
import Decimal from 'decimal.js';

// Set global fetch for web3.js
global.fetch = fetch;
config();

async function swapSolToUsdc() {
    try {
        // Initialize connection
        const rpcEndpoint = 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcEndpoint, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 120000,
            wsEndpoint: rpcEndpoint.replace('https', 'wss'),
            fetch: fetch,
            disableRetryOnRateLimit: false,
            httpHeaders: {
                'Content-Type': 'application/json'
            }
        });

        // Verify connection
        try {
            const blockHeight = await connection.getBlockHeight();
            console.log('Connected to Solana network. Current block height:', blockHeight);
        } catch (error) {
            console.error('Failed to connect to Solana network:', error);
            throw error;
        }

        async function checkTransactionStatus(signature, maxAttempts = 30) {
            console.log('Checking transaction status...');
            for (let i = 0; i < maxAttempts; i++) {
                try {
                    const status = await connection.getSignatureStatus(signature, {
                        searchTransactionHistory: true
                    });
                    
                    if (status.value !== null) {
                        if (status.value.err) {
                            throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
                        }
                        
                        if (status.value.confirmationStatus === 'confirmed' || 
                            status.value.confirmationStatus === 'finalized') {
                            console.log(`Transaction ${status.value.confirmationStatus}`);
                            return true;
                        }
                    }
                    
                    console.log(`Attempt ${i + 1}/${maxAttempts}: Transaction still pending...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error('Error checking transaction status:', error);
                    if (i === maxAttempts - 1) throw error;
                }
            }
            throw new Error('Transaction status check timed out');
        }

        // Load keypair
        const privateKeyString = process.env.WALLET_PRIVATE_KEY;
        const privateKeyBytes = bs58.decode(privateKeyString);
        const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));

        console.log('Using wallet:', keypair.publicKey.toString());

        // Get SOL balance with retry
        let solBalance;
        for (let i = 0; i < 3; i++) {
            try {
                solBalance = await connection.getBalance(keypair.publicKey);
                break;
            } catch (error) {
                if (i === 2) throw error;
                console.log(`Retry ${i + 1}/3 getting balance...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        const solBalanceInSol = new Decimal(solBalance).div(1e9); // Convert lamports to SOL
        console.log(`Current SOL balance: ${solBalanceInSol} SOL`);

        // Calculate amount to swap (half of current balance)
        const amountToSwap = solBalanceInSol.div(2);
        const inputAmount = Math.floor(amountToSwap.mul(1e9).toNumber()); // Convert to lamports

        console.log(`Swapping ${amountToSwap} SOL to USDC`);

        // Get quote from Jupiter
        const quoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112` +
            `&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` +
            `&amount=${inputAmount}` +
            `&slippageBps=100`
        );
        const quoteData = await quoteResponse.json();

        console.log('Got quote from Jupiter');
        console.log(`Expected output: ${new Decimal(quoteData.outAmount).div(1e6)} USDC`);

        // Prepare transaction
        console.log('Preparing swap transaction...');
        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                quoteResponse: quoteData,
                userPublicKey: keypair.publicKey.toString(),
                wrapUnwrapSOL: true,
                computeUnitPriceMicroLamports: 5000
            })
        });
        const swapData = await swapResponse.json();
        console.log('Swap response:', swapData);

        if (!swapData.swapTransaction) {
            throw new Error('No swap transaction received from Jupiter');
        }

        // Deserialize and sign transaction
        const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
        const swapTransaction = VersionedTransaction.deserialize(swapTransactionBuf);
        swapTransaction.sign([keypair]);

        // Execute transaction with options and handle errors
        let signature;
        try {
            signature = await connection.sendTransaction(swapTransaction, {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3
            });
            console.log('Transaction sent successfully');
        } catch (error) {
            if (error.message.includes('blockhash not found')) {
                console.error('Transaction failed: Blockhash expired. Please try again.');
            } else if (error.message.includes('insufficient funds')) {
                console.error('Transaction failed: Insufficient funds for transaction.');
            } else {
                console.error('Transaction failed:', error.message);
            }
            throw error;
        }
        console.log('Swap transaction sent:', signature);

        // Check transaction status
        console.log('Checking transaction status...');
        await checkTransactionStatus(signature);

        console.log('Swap completed successfully');
        
        // Get final balances
        const finalSolBalance = await connection.getBalance(keypair.publicKey);
        const finalSolBalanceInSol = new Decimal(finalSolBalance).div(1e9);
        console.log(`Final SOL balance: ${finalSolBalanceInSol} SOL`);

    } catch (error) {
        console.error('Error during swap:', error);
    }
}

swapSolToUsdc().catch(console.error);
