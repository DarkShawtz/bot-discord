require("dotenv").config();

console.log("DEBUG: index.js iniciou");

// ===== PORTA HTTP PRA RENDER =====
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot online"));
app.get("/health", (req, res) => res.send("OK"));

app.listen(PORT, () => {
  console.log("Servidor HTTP ativo na porta " + PORT);
});

// ===== BOT DISCORD =====
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== LOGS IMPORTANTES (Render / Gateway) =====
client.on("error", (e) => console.log("CLIENT ERROR:", e));
client.on("warn", (m) => console.log("WARN:", m));
client.on("debug", (m) => console.log("DEBUG_WS:", m));
client.on("shardError", (e) => console.log("SHARD ERROR:", e));
client.on("shardDisconnect", (event, id) => console.log("SHARD DISCONNECT:", id, event));
client.on("shardReconnecting", (id) => console.log("SHARD RECONNECTING:", id));

process.on("unhandledRejection", (e) => console.log("UNHANDLED:", e));
process.on("uncaughtException", (e) => console.log("UNCAUGHT:", e));

// ===== LEVEL CONFIG =====
const LEVELS_FILE = path.join(__dirname, "levels.json");

// cargos por level
const ROLE_PIC_PERM_ID = "1476043892209090761"; // lvl 5
const ROLE_MOV_ID = "1476045812038369433";      // lvl 15

const PIC_PERM_LEVEL = 5;
const MOV_LEVEL = 15;

// cooldown XP (10s)
const XP_COOLDOWN_MS = 10_000;

// anti-spam: 5 msgs em 3s = mute 60s
const SPAM_WINDOW_MS = 3_000;
const SPAM_LIMIT = 5;
const SPAM_MUTE_MS = 60_000;

// memória (runtime)
const lastXpTime = new Map(); // userId -> timestamp
const msgTimes = new Map();   // userId -> array de timestamps

function xpNeeded(level) {
  return 50 + (level * 50);
}

function loadLevels() {
  try {
    if (!fs.existsSync(LEVELS_FILE)) fs.writeFileSync(LEVELS_FILE, "{}", "utf8");
    return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8") || "{}");
  } catch (e) {
    console.log("Erro lendo levels.json:", e);
    return {};
  }
}

let levels = loadLevels();
let saveTimer = null;

function saveLevelsDebounced() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2), "utf8");
    } catch (e) {
      console.log("Erro salvando levels.json:", e);
    } finally {
      saveTimer = null;
    }
  }, 1200);
}

function ensureUser(userId) {
  if (!levels[userId]) levels[userId] = { level: 1, xp: 0 };
  if (typeof levels[userId].level !== "number" || levels[userId].level < 1) levels[userId].level = 1;
  if (typeof levels[userId].xp !== "number" || levels[userId].xp < 0) levels[userId].xp = 0;
  return levels[userId];
}

async function giveRoleIfNeeded(member, newLevel) {
  if (!member || !member.guild) return;

  const toGive = [];
  if (newLevel >= PIC_PERM_LEVEL) toGive.push(ROLE_PIC_PERM_ID);
  if (newLevel >= MOV_LEVEL) toGive.push(ROLE_MOV_ID);

  for (const roleId of toGive) {
    const role = member.guild.roles.cache.get(roleId);
    if (!role) continue;
    if (member.roles.cache.has(roleId)) continue;

    try {
      await member.roles.add(roleId);
    } catch (e) {
      console.log("Falha ao dar cargo:", roleId, e?.message || e);
    }
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot ligado no Discord como ${c.user.tag}`);
});

// Se não logar em 30s, avisa (diagnóstico)
setTimeout(() => {
  if (!client.isReady()) {
    console.log("⚠️ 30s e ainda não ficou READY. Isso geralmente é token errado, intents, ou bloqueio no gateway.");
  }
}, 30_000);

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.trim();

  // ======================
  // ANTI-SPAM (5 msgs / 3s => mute 1 min)
  // ======================
  {
    const userId = message.author.id;
    const now = Date.now();

    const arr = msgTimes.get(userId) || [];
    const filtered = arr.filter((t) => now - t <= SPAM_WINDOW_MS);
    filtered.push(now);
    msgTimes.set(userId, filtered);

    if (filtered.length >= SPAM_LIMIT) {
      msgTimes.set(userId, []);

      try {
        if (message.member && message.member.moderatable) {
          await message.member.timeout(SPAM_MUTE_MS, "Spam (5 mensagens em 3s)");
          await message.channel.send(`🚫 ${message.author} tomou mute de **1 minuto** por spam.`);
        }
      } catch (e) {
        console.log("Falha ao aplicar anti-spam mute:", e?.message || e);
      }
      return;
    }
  }

  // ======================
  // COMANDOS
  // ======================

  // PAINEL DE CARGO
  if (content === "!painel") {
    const button = new ButtonBuilder()
      .setCustomId("role_237")
      .setLabel("Pegar cargo 237")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    await message.channel.send({
      content: "Clique no botão para pegar o cargo 237:",
      components: [row]
    });
    return;
  }

  // BAN
  if (content.startsWith("!ban")) {
    if (!message.member.permissions.has("BanMembers"))
      return message.reply("Você não tem permissão para banir.");

    const user = message.mentions.members.first();
    if (!user) return message.reply("Marca alguém para banir.");
    if (!user.bannable) return message.reply("Não consigo banir esse usuário.");

    await user.ban();
    message.channel.send(`${user.user.tag} foi banido.`);
    return;
  }

  // UNBAN
  if (content.startsWith("!unban")) {
    if (!message.member.permissions.has("BanMembers"))
      return message.reply("Você não tem permissão.");

    const args = content.split(" ");
    const userId = args[1];
    if (!userId) return message.reply("Coloque o ID do usuário.");

    try {
      await message.guild.members.unban(userId);
      message.channel.send("Usuário desbanido.");
    } catch {
      message.reply("Não consegui desbanir.");
    }
    return;
  }

  // MUTE variável: !mute @user 10m / 2h / 1d
  if (content.startsWith("!mute")) {
    if (!message.member.permissions.has("ModerateMembers"))
      return message.reply("Você não tem permissão.");

    const args = content.split(" ");
    const user = message.mentions.members.first();
    const time = args[2];

    if (!user || !time)
      return message.reply("Use: !mute @user 10m / 2h / 1d");

    if (!user.moderatable)
      return message.reply("Não consigo mutar esse usuário.");

    const unit = time.slice(-1);
    const value = parseInt(time.slice(0, -1), 10);

    if (!value || !["m", "h", "d"].includes(unit))
      return message.reply("Tempo inválido. Ex: 10m, 2h, 1d");

    let ms;
    if (unit === "m") ms = value * 60 * 1000;
    if (unit === "h") ms = value * 60 * 60 * 1000;
    if (unit === "d") ms = value * 24 * 60 * 60 * 1000;

    await user.timeout(ms);
    message.channel.send(`${user.user.tag} foi mutado por ${time}.`);
    return;
  }

  // UNMUTE
  if (content.startsWith("!unmute")) {
    if (!message.member.permissions.has("ModerateMembers"))
      return message.reply("Você não tem permissão.");

    const user = message.mentions.members.first();
    if (!user) return message.reply("Marca alguém.");

    await user.timeout(null);
    message.channel.send(`${user.user.tag} foi desmutado.`);
    return;
  }

  // CLEAR (1..1000)
  if (content.startsWith("!clear")) {
    if (!message.member.permissions.has("ManageMessages"))
      return message.reply("Você não tem permissão.");

    const args = content.split(" ");
    const amount = parseInt(args[1], 10);

    if (!amount || amount < 1 || amount > 1000)
      return message.reply("Use um número entre 1 e 1000. Ex: !clear 50");

    let deleted = 0;
    while (deleted < amount) {
      const chunk = Math.min(100, amount - deleted);
      const msgs = await message.channel.bulkDelete(chunk, true);
      deleted += msgs.size;
      if (msgs.size === 0) break;
    }

    const m = await message.channel.send(`🧹 Apaguei ${deleted} mensagens.`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  // RANK
  if (content === "!rank") {
    const data = ensureUser(message.author.id);
    const need = xpNeeded(data.level);
    return message.reply(`📈 Seu nível: **${data.level}** | XP: **${data.xp}/${need}**`);
  }

  // LEVEL @pessoa (ou você mesmo)
  if (content.startsWith("!level")) {
    const member = message.mentions.members.first() || message.member;
    const data = ensureUser(member.id);
    const need = xpNeeded(data.level);
    return message.reply(`📈 Nível de **${member.user.tag}**: **${data.level}** | XP: **${data.xp}/${need}**`);
  }

  // TOP 10
  if (content === "!top") {
    const entries = Object.entries(levels)
      .map(([id, data]) => ({
        id,
        level: data.level || 1,
        xp: data.xp || 0
      }))
      .sort((a, b) => {
        if (b.level === a.level) return b.xp - a.xp;
        return b.level - a.level;
      })
      .slice(0, 10);

    if (entries.length === 0)
      return message.reply("Ainda não há ranking.");

    let text = "🏆 **TOP 10 DO SERVIDOR** 🏆\n\n";

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const member = await message.guild.members.fetch(e.id).catch(() => null);
      const name = member ? member.user.tag : `User(${e.id})`;
      text += `**${i + 1}.** ${name} — lvl **${e.level}** (xp ${e.xp})\n`;
    }

    await message.channel.send(text);
    return;
  }

  // não dar XP pra comandos
  if (content.startsWith("!")) return;

  // ======================
  // XP / LEVEL UP
  // ======================
  const now = Date.now();
  const last = lastXpTime.get(message.author.id) || 0;
  if (now - last < XP_COOLDOWN_MS) return;

  lastXpTime.set(message.author.id, now);

  const data = ensureUser(message.author.id);

  const gained = Math.floor(Math.random() * 8) + 5; // 5-12
  data.xp += gained;

  let leveledUp = false;
  while (data.xp >= xpNeeded(data.level)) {
    data.xp -= xpNeeded(data.level);
    data.level += 1;
    leveledUp = true;
  }

  saveLevelsDebounced();

  if (leveledUp) {
    await message.channel.send(`🔥 ${message.author} subiu para o **nível ${data.level}**!`);

    try {
      await giveRoleIfNeeded(message.member, data.level);
    } catch (e) {
      console.log("Erro ao dar cargos de level:", e?.message || e);
    }
  }
});

// ===== BOTÃO DO CARGO 237 =====
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "role_237") {
    const role = interaction.guild.roles.cache.get("1442721077859188859");

    if (!role) {
      return interaction.reply({ content: "Cargo 237 não encontrado.", flags: 64 });
    }

    await interaction.member.roles.add(role);

    await interaction.reply({
      content: "Você recebeu o cargo 237!",
      flags: 64
    });
  }
});

// ===== LOGIN (com await + erro explícito) =====
(async () => {
  console.log("DEBUG: Cheguei antes do login");
  console.log("DEBUG TOKEN existe?", !!process.env.TOKEN);

  if (!process.env.TOKEN) {
    console.log("❌ TOKEN não encontrado! Configure a variável TOKEN no Render (Environment Variables).");
    return;
  }

  try {
    console.log("DEBUG: Vou tentar logar no Discord agora...");
    await client.login(process.env.TOKEN);
    console.log("DEBUG: login() retornou.");
  } catch (e) {
    console.log("❌ ERRO no login:", e);
  }
})();
