const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');
const fs = require('fs');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token) { console.error('Error: DISCORD_TOKEN environment variable is not set.'); process.exit(1); }
if (!clientId) { console.error('Error: DISCORD_CLIENT_ID environment variable is not set.'); process.exit(1); }

// --- 1. すべての道具の定義（最上部にまとめました） ---
const rest = new REST({ version: '10' }).setToken(token);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const DATA_FILE = './msgcount.json';
function loadCounts() { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) { return {}; } }
function saveCounts(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function incrementCount(guildId, userId) { const data = loadCounts(); if (!data[guildId]) data[guildId] = {}; data[guildId][userId] = (data[guildId][userId] || 0) + 1; saveCounts(data); }
function getGuildCounts(guildId) { const data = loadCounts(); return data[guildId] || {}; }

const phrases = ['きっとこの一言だけで世界は終わるよ','We Can Tryできるよ','そんなのってアリエナイよ…！','確定です！！','熱い情熱に染まって行く','私の意志は止められないの！','めくるめくミラクル♪','心に庭ができる…','呆れるほど欲張りだから！','どうか時間を戻して…！','心の声で叫べ！','親愛なるキミへ贈ろう','どんたん！どどたん！どんたどんどたん！','ちゅっどーん！','たとえすれ違ってもまた戻ってくるから','Strawberry？Lemon cider？'];
const sisterPhrases = ['お許し致しましょう…！', 'えっと…そ, それはお許しできません！'];

// トネッター検知用のキーワードリスト
const tonetterKeywords = ['トネイト', '高瀬統也', '野田愛実', '佐藤文哉', '末ひる', 'よんよん', 'ロザリーナ', 'Yuuki'];

function rollDice(count, faces) { const rolls = []; for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * faces) + 1); return rolls; }

function getDiceComment(rolls, count, faces) { 
  const total = rolls.reduce((a, b) => a + b, 0); 
  
  if (count === 1) {
    let comment = total >= 5 ? 'すごいです！' : total >= 3 ? 'いい感じです！' : 'えっと、次がありますよ…！';
    return `サイコロ振りますねー！\n${total}が出ました、\n${comment}`;
  }

  const M = count * (faces + 1) / 2; 
  const sigma = Math.sqrt(count * (faces * faces - 1) / 12); 
  const lower = M - 0.6745 * sigma; 
  const upper = M + 0.6745 * sigma; 
  
  let comment = total > upper ? 'すごいです！' : total < lower ? 'えっと、次がありますよ…！' : 'いい感じです！'; 
  return `サイコロ振りますねー！\n合計${total} [${rolls.join(', ')}] が出ました、\n${comment}`; 
}

function calcRating(Lv, ACC) { return Lv * Math.pow((ACC / 10
