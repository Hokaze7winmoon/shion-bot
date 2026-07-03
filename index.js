const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');
const fs = require('fs');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) { console.error('Environment variables missing.'); process.exit(1); }

const rest = new REST({ version: '10' }).setToken(token);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const DATA_FILE = './msgcount.json';
const MUNOU_FILE = './jinkoumunou.json';

function loadCounts() { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) { return {}; } }
function saveCounts(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function incrementCount(guildId, userId) { const data = loadCounts(); if (!data[guildId]) data[guildId] = {}; data[guildId][userId] = (data[guildId][userId] || 0) + 1; saveCounts(data); }
function getGuildCounts(guildId) { const data = loadCounts(); return data[guildId] || {}; }

// 人工無脳のデータ管理
const defaultDict = {
  'おはよう': 'おはよう！よく眠れたかしら？',
  'おはよ': 'おはよう！よく眠れたかしら？',
  'こんにちは': 'こんにちは。べ、別に退屈だから返事したわけじゃないわよ？',
  'こんばんは': 'こんばんは。というか、あんた時計見なさいよ！早く寝たほうがいいと思うわ…？'
};
function loadMunou() { try { return JSON.parse(fs.readFileSync(MUNOU_FILE, 'utf8')); } catch (_) { return { ...defaultDict }; } }
function saveMunou(data) { fs.writeFileSync(MUNOU_FILE, JSON.stringify(data, null, 2)); }

const phrases = ['きっとこの一言だけで世界は終わるよ','We Can Tryできるよ','そんなのってアリエナイよ…！','確定です！！','熱い情熱に染まって行く','私の意志は止められないの！','めくるめくミラクル♪','心に庭ができる…','呆れるほど欲張りだから！','どうか時間を戻して…！','心の声で叫べ！','親愛なるキミへ贈ろう','どんたん！どどたん！どんたどんどたん！','ちゅっどーん！','たとえすれ違ってもまた戻ってくるから','Strawberry？Lemon cider？'];
const sisterPhrases = ['お許し致しましょう…！', 'えっと…そ、それはお許しできません！'];
const tonetterKeywords = ['トネイト', '高瀬統也', '野田愛実', '佐藤文哉', '末ひる', 'よんよん', 'ロザリーナ', 'Yuuki'];

function rollDice(count, faces) { const rolls = []; for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * faces) + 1); return rolls; }

// ★バグを修正したサイコロコメント判定
function getDiceComment(rolls, count, faces) { 
  const total = rolls.reduce((a, b) => a + b, 0); 
  let comment = 'いい感じです！';

  if (count === 1) {
    // サイコロが1個のときは、出た目の割合でシンプルに判定！
    const ratio = total / faces;
    if (ratio >= 0.8) { comment = 'すごいです！'; }
    else if (ratio <= 0.3) { comment = 'えっと、次がありますよ…！'; }
  } else {
    // サイコロが複数のときは、確率の偏り（標準偏差）を使って判定！
    const M = count * (faces + 1) / 2; 
    const sigma = Math.sqrt(count * (faces * faces - 1) / 12); 
    if (total > (M + 0.6745 * sigma)) { comment = 'すごいです！'; }
    else if (total < (M - 0.6745 * sigma)) { comment = 'えっと、次がありますよ…！'; }
  }

  if (count === 1) {
    return `サイコロ振りますねー！\n${total}が出ました、\n${comment}`;
  } else {
    return `サイコロ振りますねー！\n合計${total} [${rolls.join(', ')}] が出ました、\n${comment}`; 
  }
}
function calcRating(Lv, ACC) { return Lv * Math.pow((ACC / 100 - 0.55) / 0.45, 2); }
function getRatingMessage(ACC) { if (ACC >= 100) return 'φおめでとうございます！すごいです！'; if (ACC >= 99.50) return '上出来だと思いますよ！'; if (ACC >= 99.00) return 'ばっちりです！'; if (ACC >= 98.00) return 'やりましたね！'; return 'ここ隔からです！'; }

const commands = [
  new SlashCommandBuilder().setName('sendword').setDescription('ランダムなフレーズを1つ送ります'),
  new SlashCommandBuilder().setName('dice').setDescription('サイコロを振ります').addStringOption(o => o.setName('dice').setDescription('例: 2d6').setRequired(true)),
  new SlashCommandBuilder().setName('popporating').setDescription('単曲レートを計算します').addNumberOption(o => o.setName('譜面定数').setRequired(true)).addNumberOption(o => o.setName('acc').setRequired(true)),
  new SlashCommandBuilder().setName('ranking').setDescription('メッセージ数ランキングTOP7を表示します'),
  new SlashCommandBuilder().setName('sister').setDescription('許しを乞いましょう'),
  new SlashCommandBuilder().setName('jinkoumunou').setDescription('みんなで言葉を教え込む人工無脳の機能です')
    .addSubcommand(sub => sub.setName('message').setDescription('人工無脳に話しかけて会話を楽しみます').addStringOption(o => o.setName('内容').setDescription('話しかける中身').setRequired(true)))
    .addSubcommand(sub => sub.setName('learn').setDescription('新しい言葉とそれに対する返答を教え込みます').addStringOption(o => o.setName('word').setDescription('この言葉に').setRequired(true)).addStringOption(o => o.setName('reply').setDescription('こう返す').setRequired(true))),
].map(cmd => cmd.toJSON());

const MONITOR_CHANNEL_NAME = '紫苑bot監視（通知非推奨）';
async function sendToMonitorChannel(message) {
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find(ch => ch.name === MONITOR_CHANNEL_NAME && ch.isTextBased());
    if (channel) { try { await channel.send(message); } catch (_) {} }
  }
}

client.once('ready', async () => {
  try { await rest.put(Routes.applicationCommands(clientId), { body: commands }); } catch (err) { console.error(err); }
  await sendToMonitorChannel('起動しました！コマンドが使えるようになりましたよ！');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;
  
  if (commandName === 'sendword') await interaction.reply(phrases[Math.floor(Math.random() * phrases.length)]);
  if (commandName === 'sister') await interaction.reply(sisterPhrases[Math.floor(Math.random() * sisterPhrases.length)]);
  if (commandName === 'popporating') { const Lv = options.getNumber('譜面定数'); const ACC = options.getNumber('acc'); await interaction.reply(`この単曲レートは${calcRating(Lv, ACC).toFixed(4)}です！${getRatingMessage(ACC)}`); }
  
  if (commandName === 'ranking') {
    await interaction.deferReply();
    const counts = getGuildCounts(interaction.guildId); const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const medals = ['🥇','🥈','🥉']; const lines = [];
    for (let i = 0; i < Math.min(7, sorted.length); i++) { const [uid, count] = sorted[i]; try { const m = await interaction.guild.members.fetch(uid); lines.push(`${medals[i] || `${i+1}位`} ${m.displayName} ${count}通`); } catch (_) { lines.push(`${medals[i] || `${i+1}位`} (不明) ${count}通`); } }
    let reply = `📊 **メッセージ数ranking**\n\n${lines.join('\n')}`;
    await interaction.editReply(reply);
  }
  
  if (commandName === 'dice') {
    const match = options.getString('dice').match(/^(\d+)d(\d+)$/i);
    if (!match) { await interaction.reply('「1d6」や「3d10」のように入力してくださいね…！'); return; }
    const count = parseInt(match[1]); const faces = parseInt(match[2]);
    if (count > 50) { await interaction.reply('同時に振れるサイコロは50個までですよ……！'); return; }
    await interaction.reply(getDiceComment(rollDice(count, faces), count, faces));
  }

  if (commandName === 'jinkoumunou') {
    const sub = options.getSubcommand();
    const dict = loadMunou();
    if (sub === 'message') {
      const content = options.getString('内容');
      let matchedReply = null;
      for (const [key, value] of Object.entries(dict)) { if (content.includes(key)) { matchedReply = value; break; } }
      if (matchedReply) { await interaction.reply(matchedReply); } 
      else { await interaction.reply(`何それ。なんて答えればいいか \`/jinkoumunou learn word:${content} reply:[返答]\` で教えてくれないかしら？`); }
    }
    if (sub === 'learn') {
      const word = options.getString('word'); const reply = options.getString('reply');
      dict[word] = reply; saveMunou(dict);
      await interaction.reply(`ふーん、次から「${word}」って言われたら「${reply}」って返せばいいのね。覚えてあげるわ。`);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  incrementCount(message.guild.id, message.author.id);
  if (tonetterKeywords.some(k => message.content.includes(k))) { try { await message.reply('トネッターを発見しました…！'); } catch (_) {} }
});

process.on('unhandledRejection', () => {}); process.on('uncaughtException', () => {});
async function login() { try { await client.login(token); } catch (_) { setTimeout(login, 10000); } }
login();
