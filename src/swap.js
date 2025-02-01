import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, getAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { Market, OpenOrders } from '@project-serum/serum';
import fetch from 'node-fetch';
import { config } from 'dotenv';
import bs58 from 'bs58';
import Decimal from 'decimal.js';

config();

class DexTrader {
    constructor() {
        this.connection = new Connection(process.env.SOLANA_RPC_URL, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 60000
        });
        this.market = null;
        this.keypair = null;
    }

    async initialize() {
        try {
            // 秘密鍵の読み込みとデコード
            const privateKeyString = process.env.WALLET_PRIVATE_KEY;
            if (!privateKeyString) {
                throw new Error('WALLET_PRIVATE_KEY is required in .env');
            }
            const privateKeyBytes = bs58.decode(privateKeyString);
            this.keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));
            
            // マーケットの初期化
            const marketAddress = new PublicKey(process.env.MARKET_ADDRESS);
            const programId = new PublicKey(process.env.DEX_PROGRAM_ID);
            
            this.market = await Market.load(
                this.connection,
                marketAddress,
                {},
                programId
            );

            console.log('DexTrader initialized successfully');
            console.log('Using wallet:', this.keypair.publicKey.toString());
            
            return true;
        } catch (error) {
            console.error('Error initializing DexTrader:', error);
            return false;
        }
    }

    async getOpenOrders() {
        try {
            const openOrders = await OpenOrders.findForMarketAndOwner(
                this.connection,
                this.market.address,
                this.keypair.publicKey,
                this.market.programId
            );
            return openOrders;
        } catch (error) {
            console.error('Error getting open orders:', error);
            return [];
        }
    }

    async placeBuyOrder(price, size) {
        try {
            const transaction = new Transaction();
            
            // オーダーの作成
            transaction.add(
                this.market.makePlaceOrderInstruction(this.connection, {
                    owner: this.keypair.publicKey,
                    payer: this.keypair.publicKey,
                    side: 'buy',
                    price,
                    size,
                    orderType: 'limit',
                    clientId: undefined,
                })
            );

            // トランザクションの送信
            const signature = await this.connection.sendTransaction(
                transaction,
                [this.keypair],
                {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                }
            );

            // トランザクションの確認待ち
            const confirmation = await this.connection.confirmTransaction(signature);
            
            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }

            console.log('Buy order placed successfully');
            console.log('Transaction signature:', signature);
            
            return signature;
        } catch (error) {
            console.error('Error placing buy order:', error);
            throw error;
        }
    }

    async placeSellOrder(price, size) {
        try {
            // Convert Decimal to number for the market
            const priceNumber = parseFloat(price.toString());
            const sizeNumber = parseFloat(size.toString());

            // Create open orders account if needed
            const openOrders = await OpenOrders.findForMarketAndOwner(
                this.connection,
                this.market.address,
                this.keypair.publicKey,
                this.market.programId
            );

            const transaction = new Transaction();

            // Create open orders account if none exists
            if (openOrders.length === 0) {
                transaction.add(
                    await OpenOrders.makeCreateAccountTransaction(
                        this.connection,
                        this.market.address,
                        this.keypair.publicKey,
                        this.keypair.publicKey,
                        this.market.programId
                    )
                );
            }
            
            // オーダーの作成
            transaction.add(
                this.market.makePlaceOrderInstruction(this.connection, {
                    owner: this.keypair.publicKey,
                    payer: this.keypair.publicKey,
                    side: 'sell',
                    price: priceNumber,
                    size: sizeNumber,
                    orderType: 'limit',
                    openOrdersAddressKey: openOrders[0]?.address || undefined,
                    clientId: undefined,
                })
            );

            // トランザクションの送信
            const signature = await this.connection.sendTransaction(
                transaction,
                [this.keypair],
                {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                }
            );

            // トランザクションの確認待ち
            const confirmation = await this.connection.confirmTransaction(signature);
            
            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }

            console.log('Sell order placed successfully');
            console.log('Transaction signature:', signature);
            
            return signature;
        } catch (error) {
            console.error('Error placing sell order:', error);
            throw error;
        }
    }

    async cancelAllOrders() {
        try {
            const openOrders = await this.getOpenOrders();
            
            for (const orders of openOrders) {
                const transaction = new Transaction();
                
                for (let i = 0; i < orders.orders.length; i++) {
                    const orderId = orders.orders[i];
                    if (orderId.equals(new PublicKey(0))) continue;
                    
                    transaction.add(
                        this.market.makeCancelOrderInstruction(this.connection, {
                            owner: this.keypair.publicKey,
                            order: orderId,
                        })
                    );
                }
                
                if (transaction.instructions.length > 0) {
                    const signature = await this.connection.sendTransaction(
                        transaction,
                        [this.keypair],
                        {
                            skipPreflight: false,
                            preflightCommitment: 'confirmed',
                        }
                    );
                    
                    await this.connection.confirmTransaction(signature);
                    console.log('Orders cancelled successfully');
                }
            }
        } catch (error) {
            console.error('Error cancelling orders:', error);
            throw error;
        }
    }

    async getMarketPrice() {
        try {
            const bids = await this.market.loadBids(this.connection);
            const asks = await this.market.loadAsks(this.connection);
            
            const bestBid = bids.getL2(1)[0]?.[0] ?? null;
            const bestAsk = asks.getL2(1)[0]?.[0] ?? null;
            
            if (bestBid === null || bestAsk === null) {
                throw new Error('No orders in the order book');
            }
            
            return {
                bid: bestBid,
                ask: bestAsk,
                mid: (bestBid + bestAsk) / 2
            };
        } catch (error) {
            console.error('Error getting market price:', error);
            throw error;
        }
    }

    async getTokenBalance(mintAddress) {
        try {
            const tokenMint = new PublicKey(mintAddress);
            const associatedTokenAddress = getAssociatedTokenAddressSync(
                tokenMint,
                this.keypair.publicKey
            );
            
            try {
                const tokenAccount = await getAccount(
                    this.connection,
                    associatedTokenAddress
                );
                return new Decimal(tokenAccount.amount.toString()).div(Math.pow(10, tokenAccount.decimals));
            } catch (e) {
                if (e.name === 'TokenAccountNotFoundError') {
                    // Create associated token account if it doesn't exist
                    console.log('Creating associated token account...');
                    const transaction = new Transaction().add(
                        createAssociatedTokenAccountInstruction(
                            this.keypair.publicKey, // payer
                            associatedTokenAddress, // associatedToken
                            this.keypair.publicKey, // owner
                            tokenMint // mint
                        )
                    );
                    
                    const signature = await this.connection.sendTransaction(
                        transaction,
                        [this.keypair],
                        {
                            skipPreflight: false,
                            preflightCommitment: 'confirmed',
                        }
                    );
                    
                    await this.connection.confirmTransaction(signature);
                    console.log('Associated token account created');
                    
                    // Now get the account
                    const tokenAccount = await getAccount(
                        this.connection,
                        associatedTokenAddress
                    );
                    return new Decimal(tokenAccount.amount.toString()).div(Math.pow(10, tokenAccount.decimals));
                }
                throw e;
            }
        } catch (error) {
            console.error('Error getting token balance:', error);
            throw error;
        }
    }

    async settleFunds() {
        try {
            const openOrders = await this.getOpenOrders();
            
            for (const orders of openOrders) {
                if (orders.baseTokenFree.gt(new Decimal(0)) || orders.quoteTokenFree.gt(new Decimal(0))) {
                    const transaction = new Transaction();
                    
                    transaction.add(
                        this.market.makeSettleFundsInstruction(this.connection, {
                            owner: this.keypair.publicKey,
                            openOrders: orders.address,
                            baseWallet: getAssociatedTokenAddressSync(
                                TOKEN_PROGRAM_ID,
                                this.market.baseMintAddress,
                                this.keypair.publicKey
                            ),
                            quoteWallet: getAssociatedTokenAddressSync(
                                TOKEN_PROGRAM_ID,
                                this.market.quoteMintAddress,
                                this.keypair.publicKey
                            ),
                        })
                    );
                    
                    const signature = await this.connection.sendTransaction(
                        transaction,
                        [this.keypair],
                        {
                            skipPreflight: false,
                            preflightCommitment: 'confirmed',
                        }
                    );
                    
                    await this.connection.confirmTransaction(signature);
                    console.log('Funds settled successfully');
                }
            }
        } catch (error) {
            console.error('Error settling funds:', error);
            throw error;
        }
    }
}

export default DexTrader;
