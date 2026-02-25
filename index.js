require('dotenv').config();

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

    // ========================
    // PAINEL DE CARGO
    // ========================
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

    // ========================
    // BAN
    // ========================
    if (message.content.startsWith("!ban")) {

        if (!message.member.permissions.has("BanMembers")) {
            return message.reply("Você não tem permissão para banir.");
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply("Marca alguém para banir.");

        if (!user.bannable) return message.reply("Não consigo banir esse usuário.");

        await user.ban();
        message.channel.send(`${user.user.tag} foi banido.`);
    }

    // ========================
    // UNBAN
    // ========================
    if (message.content.startsWith("!unban")) {

        if (!message.member.permissions.has("BanMembers")) {
            return message.reply("Você não tem permissão.");
        }

        const args = message.content.split(" ");
        const userId = args[1];
        if (!userId) return message.reply("Coloque o ID do usuário.");

        try {
            await message.guild.members.unban(userId);
            message.channel.send("Usuário desbanido.");
        } catch {
            message.reply("Não consegui desbanir.");
        }
    }

    // ========================
    // MUTE (10 minutos)
    // ========================
    if (message.content.startsWith("!mute")) {

        if (!message.member.permissions.has("ModerateMembers")) {
            return message.reply("Você não tem permissão para mutar.");
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply("Marca alguém para mutar.");

        if (!user.moderatable) return message.reply("Não consigo mutar esse usuário.");

        await user.timeout(10 * 60 * 1000); // 10 minutos
        message.channel.send(`${user.user.tag} foi mutado por 10 minutos.`);
    }

});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'role_237') {
        const role = interaction.guild.roles.cache.get("1442721077859188859");

        if (!role) {
            return interaction.reply({ content: "Cargo 237 não encontrado.", ephemeral: true });
        }

        await interaction.member.roles.add(role);

        await interaction.reply({ 
            content: "Você recebeu o cargo 237!", 
            flags: 64 
        });
    }
});

client.login(process.env.TOKEN);
