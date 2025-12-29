require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Routes,
  SlashCommandBuilder,
  ActivityType,
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus
} = require("@discordjs/voice");

const path = require("path");

// ================= CONFIG =================
const AUTHORIZED_IDS = [
  "566510674424102922", // toi
  "836677770373103636", // Ten
  "1331647713149714513" // Antoine
];

const GUILD_ID = "719294957856227399";
const VOICE_CHANNEL_ID = "1298632389349740625";
const ROLE_ID = "1450881076359729152";

const KEYWORDS = [
  "discord.gg/galaxrp",
  "galaxrp"
];

// =============== CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

let autoJoinEnabled = false;
let connection = null;
const player = createAudioPlayer();

// =====================================================================
// 🔊 VOCAL 
// =====================================================================
async function connectToVoice() {
  if (!autoJoinEnabled) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  connection.subscribe(player);
}

// =====================================================================
// 🟦 AUTO-ROLE — LOGIQUE PRINCIPALE
// =====================================================================
async function checkMember(member, logsArray = null) {
  if (!member.presence) return;

  const status = member.presence.activities.find(a => a.type === ActivityType.Custom);
  const text = status?.state?.toLowerCase() || "";
  const hasKeyword = KEYWORDS.some(k => text.includes(k));
  const hasRole = member.roles.cache.has(ROLE_ID);

  if (hasKeyword && !hasRole) {
    await member.roles.add(ROLE_ID);
    if (logsArray) logsArray.push(`🟩 Ajout → ${member.user.tag}`);
  }

  if (!hasKeyword && hasRole) {
    await member.roles.remove(ROLE_ID);
    if (logsArray) logsArray.push(`🟥 Retrait → ${member.user.tag}`);
  }
}

// =====================================================================
// 🔧 COMMANDES INTERACTIONS
// =====================================================================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!AUTHORIZED_IDS.includes(interaction.user.id))
    return interaction.reply({ content: "⛔ Tu n’es pas autorisé.", ephemeral: true });

  const sub = interaction.options.getSubcommand(false);

  // ---------------------- /glx scan ----------------------
  if (interaction.commandName === "glx" && sub === "scan") {
    const guild = await client.guilds.fetch(GUILD_ID);
    const members = await guild.members.fetch({ withPresences: true });

    const logs = [];
    for (const m of members.values()) {
      await checkMember(m, logs);
    }

    if (logs.length === 0)
      return interaction.reply("✔️ Scan terminé. Aucun changement.");

    return interaction.reply("🔍 **Scan terminé :**\n" + logs.join("\n"));
  }

  // ---------------------- /glx stats ----------------------
  if (interaction.commandName === "glx" && sub === "stats") {
    const guild = await client.guilds.fetch(GUILD_ID);
    const members = await guild.members.fetch();
    const count = members.filter(m => m.roles.cache.has(ROLE_ID)).size;

    return interaction.reply(`📊 **Statistiques :**\n👥 ${count} membres ont le rôle soutien.`);
  }

  // ---------------------- /glx roleon ----------------------
  if (interaction.commandName === "glx" && sub === "roleon") {
    const member = interaction.options.getMember("user");
    if (!member) return interaction.reply("❌ Membre invalide.");

    await member.roles.add(ROLE_ID);
    return interaction.reply(`🟩 Rôle **soutien** ajouté à **${member.user.tag}**`);
  }

  // ---------------------- /glx roleoff ----------------------
  if (interaction.commandName === "glx" && sub === "roleoff") {
    const member = interaction.options.getMember("user");
    if (!member) return interaction.reply("❌ Membre invalide.");

    await member.roles.remove(ROLE_ID);
    return interaction.reply(`🟥 Rôle **soutien** retiré à **${member.user.tag}**`);
  }

  // ---------------------- /glx play ----------------------
  if (interaction.commandName === "glx" && sub === "play") {
    autoJoinEnabled = true;
    await connectToVoice();
    player.play(createAudioResource(path.join(__dirname, "son.mp3")));
    return interaction.reply("🎵 Musique lancée !");
  }

  // ---------------------- /glx stop ----------------------
  if (interaction.commandName === "glx" && sub === "stop") {
    autoJoinEnabled = false;
    player.stop();
    if (connection) connection.destroy();
    return interaction.reply("⛔ Musique arrêtée !");
  }

  // ---------------------- /glx help ----------------------
  if (interaction.commandName === "glx" && sub === "help") {
    return interaction.reply(
      `📘 **Liste des commandes**\n
🔹 /glx scan → Scan manuel + montre les changements  
🔹 /glx stats → Nombre de membres avec le rôle  
🔹 /glx roleon @user → Force l'ajout du rôle  
🔹 /glx roleoff @user → Force le retrait du rôle  
🔹 /glx play → Lance la musique en boucle  
🔹 /glx stop → Stop la musique  
`
    );
  }
});

// =====================================================================
// 🔁 Boucle audio
// =====================================================================
player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;
  player.play(createAudioResource(path.join(__dirname, "son.mp3")));
});

// =====================================================================
client.once("ready", () => {
  console.log(`🚀 Connecté en tant que ${client.user.tag}`);
});

client.login(process.env.TOKEN);
