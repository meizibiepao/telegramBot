const TelegramBot = require('node-telegram-bot-api');

const axios = require('axios');
const sdk_1 = require("@ston-fi/sdk");
const crypto_1 = require("@ton/crypto");
const ton_1 = require("@ton/ton");
const ton_access_1 = require("@orbs-network/ton-access");
const { toNano } = require('@ton/ton');

//获取 TonkenInfo JSON 字符串
// const TonkenInfoString = process.argv[2];
let BotToken,JettonAddress,TonAddress,PoolAddress;
// 创建一个新的机器人实例
let bot,chatId;
let client;

const WalletAddress = 'UQDFbCcI8sn5MJ2eSNJZ4NblU4u7-zkzG-7ese1LLkArRuVp';

const staking_url = 'https://app.ston.fi/staking#staking-form';

const addLiquidity_url = 'https://app.ston.fi/liquidity/provide?ft=TON&tt=EQDSGTwPEbZp9bhRF9K4-sWlcjvORvglEOjDXVAt7YVy_hP3';

//交易费
const ton2JettonGas = 0.215;
const jetton2TonGas = 0.185;
// const minTradeAmount = 0.265;

async function openTonClient() {
    // const endpoint = await getHttpEndpoint({ network: "testnet" });
    const endpoint = await (0, ton_access_1.getHttpEndpoint)({ network: "mainnet" });
    return new ton_1.TonClient({ endpoint });
}
function routerV1(client) {
    return client.open(new sdk_1.DEX.v1.Router());
}
async function keyPairAquire() {
    let mnemonics = "tornado appear syrup team fortune fine rack west dish guilt anger athlete bench eagle truck voice erosion betray inhale embody legal opinion kangaroo decade".split(" ");
    return await (0, crypto_1.mnemonicToPrivateKey)(mnemonics);
}
async function walletContractV4(client) {
    let keyPair = await keyPairAquire();
    let userMasterWallet = ton_1.WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    return client.open(userMasterWallet);
}


// 从去中心化交易所获取 Jetton 数据
const getJettonDataFromDex = async (jAddress) => {
    const apiUrl = `https://api.geckoterminal.com/api/v2/networks/ton/tokens/${jAddress}?include=top_pools`;

    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'accept': 'application/json'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('Error fetching Jetton data:', error);
        return null;
    }
};

// 从钱包获取 ton 数据
const getAccountDataFromWallet = async (wAddress) => {
    const apiUrl = `https://tonapi.io/v2/accounts/${wAddress}`;

    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'accept': 'application/json'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('Error fetching Jetton data:', error);
        return null;
    }
};


// 从钱包获取 jetton 数据
const getJettonDataFromWallet = async (wAddress , jAddress) => {
    const apiUrl = `https://tonapi.io/v2/accounts/${wAddress}/jettons/${jAddress}`;

    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'accept': 'application/json'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('Error fetching Jetton data:', error);
        return null;
    }
};

async function exchangeJetton2Ton(jettonAmount) {
    const router = routerV1(client);
    let userMasterWallet = await walletContractV4(client);
    // swap 25000 CO8 for 25000 CO7 but not less than 0.1 STON
    const txsParams = await router.getSwapJettonToTonTxParams({
        userWalletAddress: userMasterWallet.address.toString(), // ! replace with your address
        offerJettonAddress: JettonAddress,
        offerAmount: toNano(jettonAmount.toString()),
        proxyTon: new sdk_1.pTON.v1(),
        minAskAmount: "1",
        queryId: 1234567,
    });
    const seqno = await userMasterWallet.getSeqno();
    // you can instantly send the transaction using the router method with send suffix
    // and send it manually later
    await userMasterWallet.sendTransfer({
        seqno: seqno,
        secretKey: (await keyPairAquire()).secretKey,
        messages: [(0, ton_1.internal)(txsParams)],
    });

    console.log(`exchangeJetton2Ton : ${jettonAmount} Jetton -> Ton `);
    console.log(`JettonAddress : ${JettonAddress} `);

    waitForTransactionConfirmation(seqno);
}

async function exchangeTon2Jetton(tonAmount) {
    const router = routerV1(client);
    let userMasterWallet = await walletContractV4(client);
    // swap 25000 CO8 for 25000 CO7 but not less than 0.1 STON
    const txsParams = await router.getSwapTonToJettonTxParams({
        userWalletAddress: userMasterWallet.address.toString(), // ! replace with your address
        proxyTon: new sdk_1.pTON.v1(),
        offerAmount: (0, ton_1.toNano)(tonAmount),
        askJettonAddress: JettonAddress,
        minAskAmount: "1",
        queryId: 12345,
    });
    const seqno = await userMasterWallet.getSeqno();
    // you can instantly send the transaction using the router method with send suffix
    // and send it manually later
    const msg = await userMasterWallet.sendTransfer({
        seqno: seqno,
        secretKey: (await keyPairAquire()).secretKey,
        messages: [(0, ton_1.internal)(txsParams)],
    });

    console.log(`exchangeTon2Jetton : ${tonAmount} TON -> Jetton `);
    console.log(`JettonAddress : ${JettonAddress} `);

    waitForTransactionConfirmation(seqno);
}

//等待区块链交易，并发送交易结果 轮训时间为600秒/每20秒1次
async function waitForTransactionConfirmation( seqno, timeout = 600000, interval = 10000) {
    index = 0;
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        console.log(index);
        index = index+1;
        let userMasterWallet = await walletContractV4(client);
        const currentSeqno = await userMasterWallet.getSeqno();
        console.log(currentSeqno,seqno);
        if (currentSeqno > seqno) {
            const accountData = await getAccountDataFromWallet(WalletAddress);
            //ton 代币数量
            let tonAmount = (Number(accountData.balance)/1e9).toFixed(3);

            //从钱包获取jetton数据
            const jettonData = await getJettonDataFromWallet(WalletAddress , JettonAddress);
            
            //jetton 数量
            const jettonAmount = (Number(jettonData.balance)/1e9).toFixed(3);
            const jettonName = jettonData.jetton.name;

            //钱包地址缩写
            const walletAbbreviation = `${WalletAddress.slice(0, 4)}...${WalletAddress.slice(-4)}`;

            const message = `✅ The transaction has been completed successfully. 
[${walletAbbreviation}](https://tonviewer.com/${WalletAddress})  TON : ${tonAmount} | ${jettonName} : ${jettonAmount}`;
            bot.sendMessage(chatId, message, { parse_mode: "Markdown", disable_web_page_preview: true });

            return true; // Transaction confirmed
        }
        await new Promise(resolve => setTimeout(resolve, interval)); // 等待 interval 毫秒后再次检查
    }
    await bot.sendMessage(chatId, `✋ The transaction has been Timeout or failure.`);
    return false; // Timeout or failure
}

function handleSellMenu(query) {
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const sellOptions = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '💳Wallets', callback_data: 'wallet_menu' }],
                [{ text: 'Staking CEC', url: staking_url },{ text: 'Add CEC/TON Liquidity', url: addLiquidity_url }],
                [{ text: 'Sell 🔄 Buy', callback_data: 'main_menu' }],
                [{ text: 'Sell 25%', callback_data: 'sell_25p' }, { text: 'Sell 50%', callback_data: 'sell_50p' }, { text: 'Sell 75%', callback_data: 'sell_75p' }, { text: 'Sell 100%', callback_data: 'sell_100p' }],
                // [{ text: 'Sell X%', callback_data: 'sell_xp' }, { text: 'Sell X TON', callback_data: 'sell_x_ton' }, { text: 'Sell X Tokens', callback_data: 'sell_x_tokens' }],
                [{ text: 'Sell X%', callback_data: 'sell_xp' }, { text: 'Sell X Tokens', callback_data: 'sell_x_tokens' }],
                [{ text: 'Share', switch_inline_query: '' }]
            ]
        }
    };

    bot.editMessageReplyMarkup(sellOptions.reply_markup, { chat_id: chat_id, message_id: message_id  });
}

function handleMainMenu(query) {
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const sellOptions = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '💳Wallets', callback_data: 'wallet_menu' }],
                [{ text: 'Staking CEC', url: staking_url },{ text: 'Add CEC/TON Liquidity', url: addLiquidity_url }],
                [{ text: 'Buy 🔄 Sell', callback_data: 'sell_menu' }],
                [{ text: 'Buy 1 TON', callback_data: 'buy_1_ton' },{ text: 'Buy 2 TON', callback_data: 'buy_2_ton' },{ text: 'Buy 10 TON', callback_data: 'buy_10_ton' }],
                [{ text: 'Buy 20 TON', callback_data: 'buy_20_ton' },{ text: 'Buy 50 TON', callback_data: 'buy_50_ton' },{ text: 'Buy MAX TON', callback_data: 'buy_max_ton' }],
                [{ text: 'Buy X TON', callback_data: 'buy_x_ton' },{ text: 'Buy X Tokens', callback_data: 'buy_x_tokens' }]
            ]
        }
    };

    bot.editMessageReplyMarkup(sellOptions.reply_markup, { chat_id: chat_id, message_id: message_id  });
}

function handleWalletMenu(query) {
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const sellOptions = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '💳New Wallet', callback_data: 'new_wallet' }],
                [{ text: '➕Connect Wallet', callback_data: 'connect_wallet' }],
                [{ text: '↩️Main meun', callback_data: 'main_menu' }]
            ]
        }
    };

    bot.editMessageReplyMarkup(sellOptions.reply_markup, { chat_id: chat_id, message_id: message_id  });
}


async function handleBuyToken(query,amount) {
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    // 测试先除以1000
    const tradeAmount = amount / 1000;
    console.log('handleBuyToken - tradeAmount = ', tradeAmount);

    const accountData = await getAccountDataFromWallet(WalletAddress);

    let tonAmount = 0;
    if (accountData && accountData.balance) {
        tonAmount = Math.max(0, (Number(accountData.balance) / 1e9).toFixed(3) - ton2JettonGas);
    }

    if (tonAmount < tradeAmount) {
        const walletAbbreviation = `${WalletAddress.slice(0, 4)}...${WalletAddress.slice(-4)}`;
        const message = `❌ [${walletAbbreviation}](https://tonviewer.com/${WalletAddress}) The wallet does not have enough TON to execute this transaction. The trading volume is ${tradeAmount} TON, and the maximum trading volume of the current balance is ${tonAmount} TON `;
        bot.sendMessage(chatId, message, { parse_mode: "Markdown", disable_web_page_preview: true });
        return;
    }

    const confirmationMessage = await bot.sendMessage(chatId, `🔄 The trading volume is ${tradeAmount} TON. Do you want to proceed with the transaction? Please confirm.`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Confirm', callback_data: 'confirm' }],
                [{ text: 'Cancel', callback_data: 'cancel' }]
            ]
        }
    });

    // 定义具名的回调函数
    const callbackQueryHandler = async (callbackQuery) => {
        const action = callbackQuery.data;
        if (action === 'confirm') {
            await bot.sendMessage(chat_id, `✅ Transaction is being executed. Please wait...`);
            
            // 执行交易
            await exchangeTon2Jetton(tradeAmount);
            
            // 通知用户交易已完成
            // await bot.sendMessage(chatId, `✅ The transaction has been completed successfully.`);
        } else if (action === 'cancel') {
            await bot.sendMessage(chat_id, `❌ Transaction has been cancelled.`);
        }

        // 删除确认消息的按钮
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: confirmationMessage.message_id });
        
        // 移除当前监听器
        bot.removeListener('callback_query', callbackQueryHandler);
    };

    // 移除之前可能存在的相同回调的监听器
    bot.removeListener('callback_query', callbackQueryHandler);

    // 添加具名的监听器
    bot.on('callback_query', callbackQueryHandler);

    
}

async function handleBuyTokenByMAXTon(query) {
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const accountData = await getAccountDataFromWallet(WalletAddress);
    //ton 代币数量
    let tonAmount = (Number(accountData.balance)/1e9).toFixed(3);
    if (tonAmount <= ton2JettonGas)
    {
        await bot.sendMessage(chat_id, `❌ The wallet does not have enough TON to execute this transaction.`);
        return;
    }
    const tradeAmount = tonAmount - ton2JettonGas;

    console.log('BuyTokenByMAXTon - tradeAmount = ',tradeAmount);
    handleBuyToken(query,tradeAmount);
}

async function handleBuyTokenByXTon(query) {
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const options = {
        reply_markup: JSON.stringify({
            force_reply: true,  
            selective: true     
        })
    };

    bot.sendMessage(chat_id, 'Please enter the quantity of TON you want to purchase:' , options);
    // 监听用户的响应
    bot.once('message', async (msg) => {
        const tradeAmount = parseFloat(msg.text);
        console.log("tradeAmount = ",tradeAmount);
        if (isNaN(tradeAmount) || tradeAmount <= 0) {
            bot.sendMessage(chat_id, 'Please enter a valid number.');
        } else {
            console.log('BuyTokenByXTon - tradeAmount = ',tradeAmount);
            handleBuyToken(query , tradeAmount);
        }
    });
}

async function handleBuyTokenByXTokens(query) {
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const options = {
        reply_markup: JSON.stringify({
            force_reply: true,  
            selective: true     
        })
    };

    bot.sendMessage(chat_id, 'Please enter the quantity of tokens you want to purchase:' , options);
    // 监听用户的响应
    bot.once('message', async (msg) => {
        const amount = parseFloat(msg.text);
        console.log("amount = ",amount);
        if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chat_id, 'Please enter a valid number.');
        } else {

            const router = routerV1(client);
            let pool = client.open(await router.getPool({
                token0: JettonAddress,
                token1: TonAddress,
            }));

            const expectedOutputs = await pool.getExpectedOutputs({
                amount:toNano(amount),
                jettonWallet:JettonAddress,
            });
            const tradeAmount = Number(expectedOutputs.jettonToReceive)/1e9;

            console.log('BuyTokenByXTokens - tradeAmount = ',tradeAmount);
            handleBuyToken(query , tradeAmount);
        }
    });
}

///////////////////////////////////////////////

async function handleSellTokenByXToken(query)
{
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const options = {
        reply_markup: JSON.stringify({
            force_reply: true,  
            selective: true     
        })
    };

    bot.sendMessage(chat_id, 'Please enter the quantity of tokens you want to sell: X Token' , options);
    // 监听用户的响应
    bot.once('message', async (msg) => {
        const amount = parseFloat(msg.text);
        console.log("amount = ",amount);
        if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chat_id, 'Please enter a valid number.');
        } else {
            console.log('handleSellTokenByXToken - amount = ',amount);
            handleSellToken(query , amount);
        }
    });
}

async function handleSellTokenByXTon(query)
{
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const options = {
        reply_markup: JSON.stringify({
            force_reply: true,  
            selective: true     
        })
    };

    bot.sendMessage(chat_id, 'Please enter the quantity of TON you want to sell: X TON' , options);
    // 监听用户的响应
    bot.once('message', async (msg) => {
        const amount = parseFloat(msg.text);
        console.log("amount = ",amount);
        if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chat_id, 'Please enter a valid number.');
        } else {
            console.log('BuyTokenByXTokens - amount = ',amount);

            const accountData = await getAccountDataFromWallet(WalletAddress);
            //ton 代币数量
            let tonAmount = (Number(accountData.balance)/1e9).toFixed(3);

            console.log('handleSellTokenByXTon - tonAmount = ',tonAmount);
            
            if (tonAmount - jetton2TonGas < amount)
            {
                await bot.sendMessage(chat_id, `❌ The wallet does not have enough TON to execute this transaction.`);
                return;
            }

            const router = routerV1(client);
            let pool = client.open(await router.getPool({
                token0: JettonAddress,
                token1: TonAddress,
            }));
            console.log('handleSellTokenByXTon - pool = ',pool);

            const expectedOutputs = await pool.getExpectedOutputs({
                amount:toNano(amount),
                jettonWallet:TonAddress,
            });
            console.log('handleSellTokenByXTon - expectedOutputs = ',expectedOutputs);
            const tradeAmount = expectedOutputs.jettonToReceive;

            console.log('handleSellTokenByXTon - tradeAmount = ',tradeAmount);

            handleSellToken(query , tradeAmount);
        }
    });
}

async function handleSellTokenByXPercent(query)
{
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const options = {
        reply_markup: JSON.stringify({
            force_reply: true,  
            selective: true     
        })
    };

    bot.sendMessage(chat_id, 'Please enter the percent of tokens you want to sell: X% ' , options);
    // 监听用户的响应
    bot.once('message', async (msg) => {
        const amount = parseFloat(msg.text);
        console.log("amount = ",amount);
        if (isNaN(amount) || amount <= 0 || amount > 100) {
            bot.sendMessage(chat_id, 'Please enter a valid number.');
        } else {
            console.log('handleSellTokenByXPercent - amount = ',amount/100);
            handleSellTokenByPercent(query , amount/100);
        }
    });
}

async function handleSellTokenByPercent(query,p)
{
    //从钱包获取jetton数据
    const jettonData = await getJettonDataFromWallet(WalletAddress , JettonAddress);
            
    //jetton 数量
    const jettonAmount = Number(jettonData.balance)/1e9;
    const jettonName = jettonData.jetton.name;

    let tradeAmount = jettonAmount*p;

    console.log('handleSellTokenByPercent - p = ',p);
    console.log('handleSellTokenByPercent - tradeAmount = ',tradeAmount);

    //测试时，如果调用百分比，就只拿前2位的数值
    let tradeAmountString = tradeAmount.toString();
    tradeAmount = Number(tradeAmountString.slice(0, 3));

    handleSellToken(query,tradeAmount)
}

async function handleSellToken(query,amount)
{
    const chat_id = query.message.chat.id;
    const message_id = query.message.message_id;

    const tradeAmount = amount;
    console.log('handleBuyToken - tradeAmount = ', tradeAmount);
    
    //从钱包获取jetton数据
    const jettonData = await getJettonDataFromWallet(WalletAddress , JettonAddress);
    console.log('jettonData = ',jettonData)

    //jetton 数量
    let jettonAmount = (Number(jettonData.balance)/1e9).toFixed(3);

    if (jettonAmount < tradeAmount) {
        const walletAbbreviation = `${WalletAddress.slice(0, 4)}...${WalletAddress.slice(-4)}`;
        const message = `❌ [${walletAbbreviation}](https://tonviewer.com/${WalletAddress}) The wallet does not have enough Token to execute this transaction. The trading volume is ${tradeAmount} Token, and the maximum trading volume of the current balance is ${jettonAmount} Token `;
        bot.sendMessage(chatId, message, { parse_mode: "Markdown", disable_web_page_preview: true });
        return;
    }

    const confirmationMessage = await bot.sendMessage(chatId, `🔄 The trading volume is ${tradeAmount} Token. Do you want to proceed with the transaction? Please confirm.`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Confirm', callback_data: 'confirm' }],
                [{ text: 'Cancel', callback_data: 'cancel' }]
            ]
        }
    });

    // 定义具名的回调函数
    const callbackQueryHandler = async (callbackQuery) => {
        const action = callbackQuery.data;
        if (action === 'confirm') {
            await bot.sendMessage(chat_id, `✅ Transaction is being executed. Please wait...`);
            
            // 执行交易
            await exchangeJetton2Ton(tradeAmount);
            
            // 通知用户交易已完成
            // await bot.sendMessage(chatId, `✅ The transaction has been completed successfully.`);
        } else if (action === 'cancel') {
            await bot.sendMessage(chat_id, `❌ Transaction has been cancelled.`);
        }

        // 删除确认消息的按钮
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: confirmationMessage.message_id });
        
        // 移除当前监听器
        bot.removeListener('callback_query', callbackQueryHandler);
    };

    // 移除之前可能存在的相同回调的监听器
    bot.removeListener('callback_query', callbackQueryHandler);

    // 添加具名的监听器
    bot.on('callback_query', callbackQueryHandler);

    
}

//解析参数
async function parseTokenInfo(TonkenInfo){
    BotToken = TonkenInfo.BotToken;
    JettonAddress = TonkenInfo.JettonAddress;
    TonAddress = TonkenInfo.TonAddress;
    PoolAddress = TonkenInfo.PoolAddress

    console.log('BotToken = ',BotToken);
    console.log('JettonAddress = ',JettonAddress);
    console.log('TonAddress = ',TonAddress);
    console.log('PoolAddress = ',PoolAddress);
    if (!BotToken || !JettonAddress || !TonAddress || !PoolAddress ){
        console.error('TonkenInfo is error');
        return false;
    }
    return true;
}

//开启机器人
async function startBot(){
    
    // 当接收到 /start 命令时，发送带有按钮的消息
    bot.onText(/\/start/, async (msg) => {
        chatId = msg.chat.id;
        
        // 从去中心化交易所获取 Jetton 数据
        const tokenData = await getJettonDataFromDex(JettonAddress);

        console.log('tokenData = ',tokenData)

        if (!tokenData || !tokenData.data || !tokenData.included ) {
            bot.sendMessage(chatId, '无法获取代币数据，请稍后再试。');
            return;
        }

        //代币名字
        let tokenName = ' ';
        if (tokenData.data && tokenData.data.attributes && tokenData.data.attributes.name){
            tokenName = tokenData.data.attributes.name;
        }
        //去中心化交易所
        let tokenExchange = 'geckoterminal';

        //代币价格
        let tokenPrice = 0;
        if (tokenData.data&&tokenData.data.attributes&&tokenData.data.attributes.price_usd) {
            tokenPrice = tokenData.data.attributes.price_usd;
        }
        //稀释估值
        let tokenFDV = 0;
        if (tokenData.data&&tokenData.data.attributes&&tokenData.data.attributes.fdv_usd) {
            tokenFDV = tokenData.data.attributes.fdv_usd;
        }
        //价格变化
        let tokenVolume24H = 0;
        if (tokenData.data&&tokenData.data.attributes&&tokenData.data.attributes.volume_usd){
            tokenVolume24H = tokenData.data.attributes.volume_usd.h24;
        }
        //代币市值
        let tokenMarketCap = 0;
        if (tokenData.data&&tokenData.data.market_cap_usd){
            tokenMarketCap = tokenData.data.market_cap_usd;
        }
        //流动性底池估值
        let tokenLiq = 0;
        if (tokenData.data&&tokenData.data.total_reserve_in_usd){
            tokenLiq = tokenData.data.total_reserve_in_usd;
        }
        //1小时走势
        let tokenOneHourPriceChanges = 0
        if (tokenData.included&&tokenData.included[0]&&tokenData.included[0].attributes&&tokenData.included[0].attributes.price_change_percentage&&tokenData.included[0].attributes.price_change_percentage.h1){
            tokenOneHourPriceChanges = tokenData.included[0].attributes.price_change_percentage.h1
        }

        //持有者数量
        // let tokenHolders

        //是否增发
        // let tokenMintable = "NO";

        const accountData = await getAccountDataFromWallet(WalletAddress);
        console.log('accountData = ',accountData)

        //ton 代币数量
        let tonAmount = -1;
        if (accountData&&accountData.balance) {
            tonAmount = (Number(accountData.balance)/1e9).toFixed(3);
        }

        //从钱包获取jetton数据
        const jettonData = await getJettonDataFromWallet(WalletAddress , JettonAddress);
        console.log('jettonData = ',jettonData)

        //jetton 数量
        let jettonAmount = -1;
        if (jettonData&&jettonData.balance) {
            jettonAmount = (Number(jettonData.balance)/1e9).toFixed(3);
        }

        //钱包地址缩写
        const walletAbbreviation = `${WalletAddress.slice(0, 4)}...${WalletAddress.slice(-4)}`;

        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💳Wallets', callback_data: 'wallet_menu' }],
                    [{ text: 'Staking CEC', url: staking_url },{ text: 'Add CEC/TON Liquidity', url: addLiquidity_url }],
                    [{ text: 'Buy 🔄 Sell', callback_data: 'sell_menu' }],
                    [{ text: 'Buy 1 TON', callback_data: 'buy_1_ton' },{ text: 'Buy 2 TON', callback_data: 'buy_2_ton' },{ text: 'Buy 10 TON', callback_data: 'buy_10_ton' }],
                    [{ text: 'Buy 20 TON', callback_data: 'buy_20_ton' },{ text: 'Buy 50 TON', callback_data: 'buy_50_ton' },{ text: 'Buy MAX TON', callback_data: 'buy_max_ton' }],
                    [{ text: 'Buy X TON', callback_data: 'buy_x_ton' },{ text: 'Buy X Tokens', callback_data: 'buy_x_tokens' }]
                ],
            },
            parse_mode: 'HTML'  // 使用 HTML 格式
        };

        const caption = `
${tokenName} [MarketValue: $${tokenMarketCap || tokenFDV} ] $${tokenName}
📊 Chart: <a href="https://www.geckoterminal.com/ton/pools/EQD9X6xO8Aj7rn6xaWRGHzndrd8J-Nu6cFo9jl8EMPJ8f1m5">${tokenExchange}</a>
💰 Price: $${tokenPrice}
💵 FDV: $${tokenFDV}
💦 Liq: $${tokenLiq}
💱 Vol24: $${tokenVolume24H}
📈 Pchange: ${tokenOneHourPriceChanges}
<a href="https://tonviewer.com/${WalletAddress}">${walletAbbreviation}</a> | ${tonAmount} TON | ${jettonAmount} ${tokenName}
    `;

        bot.sendPhoto(chatId, 'https://meizibiepao.github.io/my-website/images/meb-web-bg.jpg', {
            caption: caption,
            parse_mode: 'HTML',
            reply_markup: options.reply_markup
        });
    });


    bot.on('callback_query', async (query) => {
        // const chatId = query.message.chat.id;
        const userChoice = query.data;
        console.log('userChoice = ', userChoice);

        switch (userChoice) {
            case 'wallet_menu':
                // 处理钱包功能
                handleWalletMenu(query);
                break;
            // case 'staking_cec':
            //     // 处理质押功能
                
            //     break;
            // case 'add_liquidity':
            //     // 处理流动性注入功能
            //     break;
            case 'sell_menu':
                // 切换到买卖页面
                handleSellMenu(query);
                break;
            case 'main_menu':
                // 切换到主页面
                handleMainMenu(query);
                break;
            case 'buy_1_ton':
                // 处理购买1 TON
                handleBuyToken(query,1);
                break;
            case 'buy_2_ton':
                // 处理购买2 TON
                handleBuyToken(query,2);
                break;
            case 'buy_10_ton':
                // 处理购买10 TON
                handleBuyToken(query,10);
                break;
            case 'buy_20_ton':
                // 处理购买20 TON
                handleBuyToken(query,20);
                break;
            case 'buy_50_ton':
                // 处理购买50 TON
                handleBuyToken(query,50);
                break;
            case 'buy_max_ton':
                // 处理购买MAX TON
                handleBuyTokenByMAXTon(query);
                break;
            case 'buy_x_ton':
                // 处理自定义购买TON
                handleBuyTokenByXTon(query);
                break;
            case 'buy_x_tokens':
                // 处理自定义购买x代币
                handleBuyTokenByXTokens(query);
                break;
            case 'sell_25p':
                // 处理自定义出售代币
                handleSellTokenByPercent(query,0.25);
                break;
            case 'sell_50p':
                handleSellTokenByPercent(query,0.5);
                break;
            case 'sell_75p':
                handleSellTokenByPercent(query,0.75);
                break;
            case 'sell_100p':
                handleSellTokenByPercent(query,1);
                break;
            case 'sell_xp':
                handleSellTokenByXPercent(query);
                break;
            case 'sell_x_ton':
                handleSellTokenByXTon(query);
                break;
            case 'sell_x_tokens':
                handleSellTokenByXToken(query);
                break;
            case 'new_wallet':
                // 处理自定义新建钱包
                break;
            case 'connect_wallet':
                // 处理自定义链接钱包
                break;
            default:
                console.log('Unknown user choice:', userChoice);
                break;
        }
    });

}

async function startCryptonBot(_TonkenInfo,_client,_bot) {
    client = _client;
    bot = _bot;
    await parseTokenInfo(_TonkenInfo);
    await startBot();
    console.log('cryptonBot is running...');
}

module.exports = { startCryptonBot };

