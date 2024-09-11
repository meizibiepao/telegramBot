// const { exec } = require('child_process');
// const { spawn } = require('child_process');

const { TonConnect } = require ('@tonconnect/sdk');

const TelegramBot = require('node-telegram-bot-api');

const { startCryptonBot } = require('./cryptonBot.js');
const { startTransactionsBot } = require('./transactionsBot.js');


const ton_1 = require("@ton/ton");
const ton_access_1 = require("@orbs-network/ton-access");
const sdk_1 = require("@ston-fi/sdk");

// telegram bot
let bot ;
let client;
// Telegram Bot Token
const BotToken = '7515887303:AAFbFWq-goIwv2IYbdXNJZltBVPSnmKzr5Y';

// Jetton Address
const JettonAddress = 'EQDSGTwPEbZp9bhRF9K4-sWlcjvORvglEOjDXVAt7YVy_hP3';  
// Ton Address
const TonAddress = new sdk_1.pTON.v1().address;

let TonkenInfo = {
    BotToken:BotToken,
    JettonAddress:JettonAddress,
    TonAddress:TonAddress
}

async function openTonClient() {
    // const endpoint = await getHttpEndpoint({ network: "testnet" });
    const endpoint = await (0, ton_access_1.getHttpEndpoint)({ network: "mainnet" });
    return new ton_1.TonClient({ endpoint });
}

function routerV1(client) {
    return client.open(new sdk_1.DEX.v1.Router());
}

// 交易机器人
async function startCrytonBot(client) {
    // 启动 cryptonBot.js
    await startCryptonBot(TonkenInfo,client,bot);
}

// 群组自动发送交易记录机器人
async function startTransactionBot(client) {
    // 启动 transcationsBot.js
    await startTransactionsBot(TonkenInfo,client,bot);
}

async function getTokenInfo(client) {
    let router = routerV1(client);
    let token0 = JettonAddress;
    let token1 = TonAddress;
    let pool = client.open(await router.getPool({
        token0: token0,
        token1: token1,
    }));
    console.log('pool = ', pool);

    TonkenInfo.PoolAddress = pool.address;
}

async function startTelegramBot() {
    // 创建一个新的机器人实例
    bot = await new TelegramBot(BotToken, { polling: true });
}

async function main()
{

    client = openTonClient();
    client.then(async (client) => {

        try {
            await startTelegramBot();
            await getTokenInfo(client);
            
            await startCrytonBot(client);
            await startTransactionBot(client);
        } catch (err) {
            console.error("Error during bot initialization or execution:", err);
            // 在这里你可以决定如何处理错误，例如重启机器人或发送错误通知
        }
    }).catch(err => {
        console.error("Failed to initialize TON client:", err);
    });


    // const bot = new TelegramBot(BotToken, {polling: true});

    // bot.on('message', (msg) => {
    //     const chatId = msg.chat.id;
    //     console.log(`群组ID: ${chatId}`);
    //     bot.sendMessage(chatId, `这个群组的ID是: ${chatId}`);
    // });    
    // console.log('bot is running...')
}

main();

