require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ActivityType,
  Routes,
  REST
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

const KEYWORDS = ["discord.gg/galaxrp", "galaxrp"];
let autoRoleEnabled = true;
let autoJoinEnabled = false;
let scanIntervalMinutes = 10;
let scanInterval = null;

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const player = createAudioPlayer();
let connection = null;

// ==================================================
// ⚡ AUTO ROLE CHECK
// ==================================================
async function checkMember(member) {
  try {
    if (!member.presence) return;

    const customStatus = member.presence.activities.find(a => a.type === ActivityType.Custom);
    if (!customStatus || !customStatus.state) return;

    const text = customStatus.state.toLowerCase();
    const hasKeyword = KEYWORDS.some(k => text.includes(k));
    const hasRole = member.roles.cache.has(ROLE_ID);

    if (hasKeyword && !hasRole) {
      await member.roles.add(ROLE_ID);
      console.log(`🟩 Rôle ajouté à ${member.user.tag}`);
    }

    if (!hasKeyword && hasRole) {
      await member.roles.remove(ROLE_ID);
      console.log(`🟥 Rôle retiré à ${member.user.tag}`);
    }
  } catch (err) {
    console.error("Erreur AutoRole:", err.message);
  }
}

async function fullScan() {
  console.log("🔍 Scan en cours...");
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch({ withPresences: true });

  for (const m of members.values()) {
    await checkMember(m);
  }

  console.log("✅ Scan terminé !");
  return members.size;
}

function startScanInterval() {
  if (scanInterval) clearInterval(scanInterval);
  scanInterval = setInterval(() => fullScan(), scanIntervalMinutes * 60000);
}

// ==================================================
// 🔊 VOCAL
// ==================================================
async function connectVoice() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

  if (!channel) return console.log("❌ Salon vocal introuvable.");

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });

  connection.subscribe(player);
}

player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;
  player.play(createAudioResource(path.join(__dirname, "son.mp3")));
});

// ==================================================
// 🧊 SLASH COMMANDS
// ==================================================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!AUTHORIZED_IDS.includes(interaction.user.id)) {
    return interaction.reply({ content: "⛔ Non autorisé.", ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();

  // 🎵 PLAY
  if (sub === "play") {
    autoJoinEnabled = true;
    await connectVoice();
    player.play(createAudioResource(path.join(__dirname, "son.mp3")));
    return interaction.reply("🎵 Musique lancée.");
  }

  // 🔇 STOP
  if (sub === "stop") {
    autoJoinEnabled = false;
    if (connection) connection.destroy();
    player.stop();
    return interaction.reply("⛔ Musique arrêtée.");
  }

  // 📊 STAT
  if (sub === "stat") {
    const guild = await client.guilds.fetch(GUILD_ID);
    const role = guild.roles.cache.get(ROLE_ID);
    const count = role?.members.size || 0;

    return interaction.reply(`📊 **Stats :**  
• AutoRole : ${autoRoleEnabled ? "🟢 ON" : "🔴 OFF"}  
• Soutiens : **${count} membres**  
• Intervalle scan : ${scanIntervalMinutes} min`);
  }

  // 🔄 SCAN
  if (sub === "scan") {
    const n = await fullScan();
    return interaction.reply(`🔍 Scan terminé. (${n} membres analysés)`);
  }

  // 🟢 ROLE ON
  if (sub === "roleon") {
    const user = interaction.options.getMember("user");
    await user.roles.add(ROLE_ID);
    return interaction.reply(`🟩 Rôle ajouté à ${user.user.tag}`);
  }

  // 🔴 ROLE OFF
  if (sub === "roleoff") {
    const user = interaction.options.getMember("user");
    await user.roles.remove(ROLE_ID);
    return interaction.reply(`🟥 Rôle retiré à ${user.user.tag}`);
  }

  // ⏱ INTERVAL
  if (sub === "scaninterval") {
    const min = interaction.options.getInteger("minutes");
    scanIntervalMinutes = min;
    startScanInterval();
    return interaction.reply(`⏱ Intervalle réglé sur **${min} minutes**`);
  }

  // ℹ HELP
  if (sub === "help") {
    return interaction.reply(
      "**📘 Aide :**\n" +
      "/glx play — lance la musique\n" +
      "/glx stop — arrête la musique\n" +
      "/glx stat — affiche les stats\n" +
      "/glx scan — scan immédiat\n" +
      "/glx scaninterval — règle l’intervalle auto\n" +
      "/glx roleon — ajoute rôle soutien\n" +
      "/glx roleoff — retire rôle soutien\n" +
      "/glx teststatus — simule un statut"
    );
  }
});

// ==================================================
// READY
// ==================================================
client.once("ready", async () => {
  console.log(`🚀 Bot connecté : ${client.user.tag}`);
  await fullScan();
  startScanInterval();
});

client.login(process.env.TOKEN);
