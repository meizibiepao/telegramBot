const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

let BotToken,JettonAddress,TonAddress,PoolAddress;

// Telegram Bot Token
// const botToken = '7515887303:AAFbFWq-goIwv2IYbdXNJZltBVPSnmKzr5Y';
// Jetton Address
// const jettonAddress = 'EQDSGTwPEbZp9bhRF9K4-sWlcjvORvglEOjDXVAt7YVy_hP3';  
// transactions pool address
// const transactionsTokenAddress = 'EQD9X6xO8Aj7rn6xaWRGHzndrd8J-Nu6cFo9jl8EMPJ8f1m5';
// wallet address
const walletAddress = 'UQDFbCcI8sn5MJ2eSNJZ4NblU4u7-zkzG-7ese1LLkArRuVp';

const groupChatID = '-1007391703862';

// 创建一个新的机器人实例
let bot;
let client;

async function startBot(TonkenInfo) {
    // 监听代币交易并发送到群组
    const monitorTokenTransactions = async () => {
        let lastTimestamp = null;
        let intervalMs = 500; // 每次发送消息的间隔时间（1秒）

        setInterval(async () => {
            const transactionsData = await getRecentTransactions(PoolAddress);
            // console.log('transactionsData = ',transactionsData);
            if (!transactionsData || !transactionsData.data) {
                console.error('No transaction data found');
                return;
            }

            const transactions = transactionsData.data;

            // 按时间戳排序，确保最新的交易在最后
            transactions.sort((a, b) => {
                return new Date(a.attributes.block_timestamp) - new Date(b.attributes.block_timestamp);
            });

            // 按照一定时间间隔发送消息
            transactions.forEach((transaction, index) => {
                const transactionTimestamp = new Date(transaction.attributes.block_timestamp);
                // 只发送最新的交易信息
                if (!lastTimestamp || transactionTimestamp > lastTimestamp) {
                    lastTimestamp = transactionTimestamp;
                    setTimeout(() => {
                        showMsg(transaction);
                    }, index * intervalMs); // 每条消息根据索引设置延迟时间
                }
            });
        }, 20000); // 20秒检查一次交易
    };

    // 启动交易监听
    monitorTokenTransactions();
}


// 获取代币交易的函数
async function getRecentTransactions(pAddress) 
{
    const apiUrl = `https://api.geckoterminal.com/api/v2/networks/ton/pools/${pAddress}/trades`;
    // console.log('apiUrl = ',apiUrl);
    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'accept': 'application/json'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('Error fetching recent transactions:', error);
        return null;
    }
}

//发送的消息内容
async function showMsg(transaction) 
{
    const transactionId = transaction.id;
    const transactionType = transaction.attributes.kind;
    const transactionAmount = transaction.attributes.from_token_amount;
    const transactionSender = transaction.attributes.tx_from_address;
    const transactionReceiver = transaction.attributes.to_token_address;
    const transactionTimestamp = new Date(transaction.attributes.block_timestamp);
    
    let from_token,to_token,transactionAddress;
    if (transactionType == 'buy'){
        from_token = 'TON';
        to_token = 'MCT';
        transactionAddress = transaction.attributes.to_token_address;
    }else{
        from_token = 'MCT';
        to_token = 'TON';
        transactionAddress = transaction.attributes.from_token_address;
    }

    const from_amount = Number(transaction.attributes.from_token_amount).toFixed(5);
    const to_amount = Number(transaction.attributes.to_token_amount).toFixed(5);

    const from_value = (Number(transaction.attributes.from_token_amount)*Number(transaction.attributes.price_from_in_usd)).toFixed(5);
    const to_value = (Number(transaction.attributes.to_token_amount)*Number(transaction.attributes.price_to_in_usd)).toFixed(5);
    const bolume = Number(transaction.attributes.volume_in_usd).toFixed(5);

const caption = `🔄 NEW ${transactionType} trade:

🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀

💎 ${from_amount} ${from_token} [$${ from_value }]
💵 ${to_amount} ${to_token} [$${ to_value }]
🤵 <a href="https://tonviewer.com/${transactionAddress}">Buyer</a> |  <a href="https://tonviewer.com/transaction/${transaction.attributes.tx_hash}">Txn</a>
💰 $${ bolume }
🕗 ${transactionTimestamp.toLocaleString()}

📊 <a href="https://www.geckoterminal.com/zh/ton/pools/${PoolAddress}">geckoterminal</a> | 🌊 <a href="https://tonviewer.com/${PoolAddress}?section=holders">LP Lock</a> | 🌐 <a href="https://tonviewer.com/${JettonAddress}">TX</a> | 🎖️ <a href="https://discord.gg/P6ekQttS">Dicord</a> | 🏆 <a href="https://www.facebook.com/Idlefantasynft">FaceBook</a> | ⛳ <a href="https://x.com/IdleGog">twitter</a> 

`;
    
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'buy token', url: 'https://t.me/idlegog_crypto_trading_bot?start=welcome' }
                    // { text: 'buy token', url: 'https://app.ston.fi/swap?chartVisible=false&ft=TON&tt=EQDSGTwPEbZp9bhRF9K4-sWlcjvORvglEOjDXVAt7YVy_hP3' }
                    
                ]
            ],
        },
        parse_mode: 'HTML'  // 使用 HTML 格式
    };

    bot.sendPhoto(groupChatID,'https://meizibiepao.github.io/my-website/images/bg_01.jpg', {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: options.reply_markup
    });
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

async function startTransactionsBot(_TonkenInfo,_client,_bot) {
    client = _client;
    bot = _bot;
    await parseTokenInfo(_TonkenInfo);
    await startBot();
    console.log('transactionsBot is running...');
}

module.exports = { startTransactionsBot };



