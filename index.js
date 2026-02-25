require('dotenv').config();

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

const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Events 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('clientReady', () => {
    console.log(`Bot ligado como ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {

    if (message.author.bot) return;

    // ===== PAINEL =====
    if (message.content === "!painel") {

        const button = new ButtonBuilder()
            .setCustomId('role_237')
            .setLabel('Pegar cargo 237')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        await message.channel.send({
            content: "Clique no botão para pegar o cargo 237:",
            components: [row]
        });
    }

    // ===== BAN =====
    if (message.content.startsWith("!ban")) {

        if (!message.member.permissions.has("BanMembers"))
            return message.reply("Você não tem permissão.");

        const user = message.mentions.members.first();
        if (!user) return message.reply("Marca alguém.");

        if (!user.bannable) return message.reply("Não consigo banir.");

        await user.ban();
        message.channel.send(`${user.user.tag} foi banido.`);
    }

    // ===== UNBAN =====
    if (message.content.startsWith("!unban")) {

        if (!message.member.permissions.has("BanMembers"))
            return message.reply("Você não tem permissão.");

        const args = message.content.split(" ");
        const userId = args[1];
        if (!userId) return message.reply("Coloque o ID.");

        try {
            await message.guild.members.unban(userId);
            message.channel.send("Usuário desbanido.");
        } catch {
            message.reply("Erro ao desbanir.");
        }
    }

// ===== MUTE =====
if (message.content.startsWith("!mute")) {

    if (!message.member.permissions.has("ModerateMembers"))
        return message.reply("Você não tem permissão.");

    const args = message.content.split(" ");
    const user = message.mentions.members.first();
    const time = args[2];

    if (!user || !time)
        return message.reply("Use: !mute @user 10m / 2h / 1d");

    if (!user.moderatable)
        return message.reply("Não consigo mutar.");

    const unit = time.slice(-1);
    const value = parseInt(time.slice(0, -1));

    if (!value || !["m", "h", "d"].includes(unit))
        return message.reply("Tempo inválido. Ex: 10m, 2h, 1d");

    let ms;
    if (unit === "m") ms = value * 60 * 1000;
    if (unit === "h") ms = value * 60 * 60 * 1000;
    if (unit === "d") ms = value * 24 * 60 * 60 * 1000;

    await user.timeout(ms);

    message.channel.send(`${user.user.tag} foi mutado por ${time}.`);
    }

// ===== UNMUTE =====
if (message.content.startsWith("!unmute")) {

    if (!message.member.permissions.has("ModerateMembers"))
        return message.reply("Sem permissão.");

    const user = message.mentions.members.first();
    if (!user) return message.reply("Marca alguém.");

    await user.timeout(null);
    message.channel.send(`${user.user.tag} desmutado.`);
}

    // ===== CLEAR =====
if (message.content.startsWith("!clear")) {

    if (!message.member.permissions.has("ManageMessages"))
        return message.reply("Sem permissão.");

    const args = message.content.split(" ");
    const amount = parseInt(args[1]);

    if (!amount || amount < 1 || amount > 1000)
        return message.reply("Use um número entre 1 e 1000.");

    let deleted = 0;

    while (deleted < amount) {
        const toDelete = Math.min(100, amount - deleted);
        const msgs = await message.channel.bulkDelete(toDelete, true);
        deleted += msgs.size;
    }

    message.channel.send(`🧹 Apaguei ${amount} mensagens.`)
        .then(m => setTimeout(() => m.delete(), 3000));
}

});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'role_237') {
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

client.login(process.env.TOKEN);
