const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');
const fs = require('fs');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token) { console.error('Error: DISCORD_TOKEN environment variable is not set.'); process.exit(1); }
if (!clientId) { console.error('Error: DISCORD_CLIENT_ID environment variable is not set.'); process.exit(1); }

const rest = new REST({ version: '10' }).setToken(token);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const DATA_FILE = './msgcount.json';
function loadCounts() { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) { return {}; } }
function saveCounts(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function incrementCount(guildId, userId) { const data = loadCounts(); if (!data[guildId]) data[guildId] = {}; data[guildId][userId] = (data[guildId][userId] || 0) + 1; saveCounts(data); }
function getGuildCounts(guildId) { const data = loadCounts(); return data[guildId] || {}; }

const phrases = ['きっとこの一言だけで世界は終わるよ','We Can Tryできるよ','そんなのってアリエナイよ…！','確定です！！','熱い情熱に染まって行く','私の意志は止められないの！','めくるめくミラクル♪','心に庭ができる…','呆れるほど欲張りだから！','どうか時間を戻して…！','心の声で叫べ！','親愛なるキミへ贈ろう','どんたん！どどたん！どんたどんどたん！','ちゅっどーん！','たとえすれ違ってもまた戻ってくるから','Strawberry？Lemon cider？'];
const sisterPhrases = ['お許し致しましょう…！', 'えっと…そ、それはお許しできません！'];

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
}function calcRating(Lv, ACC) { return Lv * Math.pow((ACC / 100 - 0.55) / 0.45, 2); }
function getRatingMessage(ACC) { if (ACC >= 100) return 'φおめでとうございます！すごいです！'; if (ACC >= 99.50) return '上出来だと思いますよ！'; if (ACC >= 99.00) return 'ばっちりです！'; if (ACC >= 98.00) return 'やりましたね！'; return 'ここからです！'; }

const commands = [
  new SlashCommandBuilder().setName('sendword').setDescription('ランダムなフレーズを1つ送ります'),
  new SlashCommandBuilder().setName('dice').setDescription('サイコロを振ります（例: 1d6, 3d10）').addStringOption(o => o.setName('dice').setDescription('ダイスの指定（例: 2d6）').setRequired(true)),
  new SlashCommandBuilder().setName('popporating').setDescription('単曲レートを計算します').addNumberOption(o => o.setName('譜面定数').setDescription('譜面定数（例: 13.5）').setRequired(true)).addNumberOption(o => o.setName('acc').setDescription('ACC（例: 99.75）').setRequired(true)),
  new SlashCommandBuilder().setName('ranking').setDescription('このサーバーのメッセージ数ランキングTOP7を表示します'),
  new SlashCommandBuilder().setName('sister').setDescription('許しを乞いましょう'),
].map(cmd => cmd.toJSON());

const MONITOR_CHANNEL_NAME = '紫苑bot監視（通知非推奨）';

async function sendToMonitorChannel(message) {
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find(ch => ch.name === MONITOR_CHANNEL_NAME && ch.isTextBased());
    if (channel) { try { await channel.send(message); } catch (err) { console.error('通知送信失敗:', err.message); } }
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try { await rest.put(Routes.applicationCommands(clientId), { body: commands }); console.log('Slash commands registered.'); } catch (err) { console.error(err); }
  await sendToMonitorChannel('起動しました！コマンドが使えるようになりましたよ！');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'sendword') { await interaction.reply(phrases[Math.floor(Math.random() * phrases.length)]); }
  if (interaction.commandName === 'popporating') { const Lv = interaction.options.getNumber('譜面定数'); const ACC = interaction.options.getNumber('acc'); await interaction.reply(`この単曲レートは${calcRating(Lv, ACC).toFixed(4)}です！${getRatingMessage(ACC)}`); }
  if (interaction.commandName === 'sister') { await interaction.reply(sisterPhrases[Math.floor(Math.random() * sisterPhrases.length)]); }
  if (interaction.commandName === 'ranking') {
    await interaction.deferReply();
    const counts = getGuildCounts(interaction.guildId);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const medals = ['🥇','🥈','🥉'];
    const lines = [];
    for (let i = 0; i < Math.min(7, sorted.length); i++) { const [uid, count] = sorted[i]; try { const m = await interaction.guild.members.fetch(uid); lines.push(`${medals[i] || `${i+1}位`} ${m.displayName} ${count}通`); } catch (_) { lines.push(`${medals[i] || `${i+1}位`} (不明) ${count}通`); } }
    let reply = `📊 **メッセージ数ranking**\n\n${lines.join('\n')}`;
    const myRank = sorted.findIndex(([uid]) => uid === interaction.user.id);
    if (myRank >= 7 || myRank === -1) { try { const m = await interaction.guild.members.fetch(interaction.user.id); reply += `\n\n---\nあなた（${m.displayName}）は ${myRank === -1 ? 'ランク外' : `${myRank+1}位`} ${counts[interaction.user.id] || 0}通`; } catch (_) {} }
    await interaction.editReply(reply);
  }
  if (interaction.commandName === 'dice') {
    const match = interaction.options.getString('dice').match(/^(\d+)d(\d+)$/i);
    if (!match) { await interaction.reply('えっと、ダイスの形式が正しくないですよ…！「1d6」や「3d10」のように入力してくださいね…！'); return; }
    const count = parseInt(match[1]); const faces = parseInt(match[2]);
    if (count > 50) { await interaction.reply('あべばべばばば！同時に振れるサイコロは50個までですよ……！'); return; }
    if (count < 1 || faces < 1) { await interaction.reply('ダイスの数と面数は1以上にしてくださいね！'); return; }
    await interaction.reply(getDiceComment(rollDice(count, faces), count, faces));
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  incrementCount(message.guild.id, message.author.id);
  const hasKeyword = tonetterKeywords.some(keyword => message.content.includes(keyword));
  if (hasKeyword) { try { await message.reply('トネッターを発見しました…！'); } catch (err) { console.error('トネッター返信失敗:', err.message); } }
});

process.on('unhandledRejection', (reason) => { console.error('未処理のPromise拒否:', reason); });
process.on('uncaughtException', (err) => { console.error('未捕捉の例外:', err.message); });

let reconnectAttempts = 0;
async function login() { try { await client.login(token); reconnectAttempts = 0; } catch (err) { reconnectAttempts++; const delay = Math.min(5000 * reconnectAttempts, 30000); console.error(`ログイン失敗。${delay/1000}秒後に再試行...`); setTimeout(login, delay); } }
client.on('error', (err) => { console.error('クライアントエラー:', err.message); });

login();
