require("dotenv").config();
const { 
  Client, 
  GatewayIntentBits, 
  ActivityType 
} = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
} = require("@discordjs/voice");
const path = require("path");

// ================= CONFIG =================
const AUTHORIZED_ID = "566510674424102922";
const GUILD_ID = "719294957856227399";
const VOICE_CHANNEL_ID = "1298632389349740625";
const ROLE_ID = "1450881076359729152"; // rôle soutien
const KEYWORDS = [
  "discord.gg/galaxrp",
  "galaxrp"
];

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = createAudioPlayer();
let connection = null;
let autoJoinEnabled = false;

// ==================================================
// 🔊 VOCAL — Connexion au salon
// ==================================================
async function connectToVoice() {
  if (!autoJoinEnabled) {
    console.log("⛔ Ignoré : autoJoin désactivé");
    return;
  }

  console.log("🎧 Tentative de connexion au vocal...");

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

  if (!channel || channel.type !== 2) {
    console.log("❌ Le salon vocal est invalide.");
    return;
  }

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  console.log("✅ Bot connecté au salon vocal !");
  connection.subscribe(player);
}

// maintien vocal
client.on("voiceStateUpdate", async (_, newState) => {
  if (!autoJoinEnabled) return;
  if (newState.id !== client.user.id) return;

  console.log("🎤 Mise à jour du voiceState : surveillance...");

  try {
    if (newState.serverMute) {
      console.log("⚠️ Le bot est server-mute → correction…");
      await newState.setMute(false);
      console.log("✔️ Server-unmute appliqué");
    }

    if (!newState.selfDeaf) {
      console.log("⚠️ Le bot n'est plus sourdine → correction...");
      await newState.setDeaf(true);
      console.log("✔️ Sourdine restaurée");
    }

  } catch (err) {
    console.error("❌ Erreur voiceState :", err);
  }
});

// ==================================================
// 🟦 AUTO ROLE — Gestion du rôle soutien
// ==================================================
async function checkMember(member) {
  try {
    console.log(`🔍 Vérification du membre : ${member.user.tag}`);

    // Hors ligne
    if (!member.presence) {
      console.log(`⛔ ${member.user.tag} est hors‑ligne → ignoré`);
      return;
    }

    const customStatus = member.presence.activities.find(
      a => a.type === ActivityType.Custom
    );

    if (!customStatus || !customStatus.state) {
      console.log(`ℹ️ ${member.user.tag} n’a pas de statut personnalisé → pas de retrait`);
      return;
    }

    const text = customStatus.state.toLowerCase();
    const hasKeyword = KEYWORDS.some(k => text.includes(k));
    const hasRole = member.roles.cache.has(ROLE_ID);

    console.log(`📌 Statut détecté : "${text}"`);
    console.log(`🔎 Mot‑clé trouvé ? →`, hasKeyword);

    if (hasKeyword && !hasRole) {
      await member.roles.add(ROLE_ID);
      console.log(`🟩 Rôle SOUTIEN ajouté → ${member.user.tag}`);
    }

    if (!hasKeyword && hasRole) {
      await member.roles.remove(ROLE_ID);
      console.log(`🟥 Rôle SOUTIEN retiré → ${member.user.tag}`);
    }

  } catch (err) {
    console.error("❌ AutoRole error:", err);
  }
}

// On surveille les changements de statut
client.on("presenceUpdate", (_, newPresence) => {
  if (!newPresence?.member) return;
  console.log("⚡ Mise à jour présence → check du membre");
  checkMember(newPresence.member);
});

// Nouveau membre
client.on("guildMemberAdd", member => {
  console.log(`🟦 Nouveau membre : ${member.user.tag} → check auto`);
  checkMember(member);
});

// Scan initial
client.once("ready", async () => {
  console.log(`🚀 Bot lancé en tant que ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch({ withPresences: true });

  console.log(`🔎 Scan initial des ${members.size} membres...`);
  members.forEach(m => checkMember(m));

  console.log("✅ Scan initial terminé !");
});

// ==================================================
// 📩 COMMANDES (musique + vocal)
// ==================================================
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.author.id !== AUTHORIZED_ID) return;

  if (message.content === "!glxmus2") {
    console.log("▶️ Commande START reçue");

    autoJoinEnabled = true;
    await connectToVoice();

    player.play(createAudioResource(path.join(__dirname, "son.mp3")));
    return message.reply("🎵 **Musique lancée !**\n🔊");
  }

  if (message.content === "!glxmus2st") {
    console.log("⏹️ Commande STOP reçue");

    autoJoinEnabled = false;
    player.stop();
    if (connection) connection.destroy();

    return message.reply("⛔ **Musique arrêtée !**\n🔇");
  }
});

// boucle audio
player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;
  console.log("🔁 Boucle audio — redémarrage de la musique");
  player.play(createAudioResource(path.join(__dirname, "son.mp3")));
});

client.login(process.env.TOKEN);
