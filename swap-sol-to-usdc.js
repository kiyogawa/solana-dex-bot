import { Connection, PublicKey } from '@solana/web3.js';
import DexTrader from './src/swap.js';
import { config } from 'dotenv';
import Decimal from 'decimal.js';

config();

async function swapSolToUsdc() {
    try {
        const trader = new DexTrader();
        const initialized = await trader.initialize();
        
        if (!initialized) {
            console.error('Failed to initialize trader');
            return;
        }

        // Get SOL balance
        const solBalance = await trader.connection.getBalance(trader.keypair.publicKey);
        const solBalanceInSol = new Decimal(solBalance).div(1e9); // Convert lamports to SOL
        console.log(`Current SOL balance: ${solBalanceInSol} SOL`);

        // Calculate amount to swap (half of current balance)
        const amountToSwap = solBalanceInSol.div(2);
        console.log(`Swapping ${amountToSwap} SOL to USDC`);

        // Get current market price
        const marketPrice = await trader.getMarketPrice();
        console.log(`Current market price: ${marketPrice.mid} USDC/SOL`);

        // Place sell order for half of SOL
        const signature = await trader.placeSellOrder(marketPrice.mid, amountToSwap);
        console.log(`Sell order placed. Transaction signature: ${signature}`);

        // Wait for order to be filled and settle funds
        await trader.settleFunds();
        console.log('Funds settled successfully');

        // Get final balances
        const finalSolBalance = await trader.getTokenBalance(process.env.SOL_MINT);
        const finalUsdcBalance = await trader.getTokenBalance(process.env.USDC_MINT);
        
        console.log(`Final SOL balance: ${finalSolBalance}`);
        console.log(`Final USDC balance: ${finalUsdcBalance}`);

    } catch (error) {
        console.error('Error during swap:', error);
    }
}

swapSolToUsdc().catch(console.error);
