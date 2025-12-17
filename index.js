require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
} = require("@discordjs/voice");
const path = require("path");

// ----------------------
// CONFIG
// ----------------------
const AUTHORIZED_ID = "566510674424102922";      // ID autorisé
const GUILD_ID = "719294957856227399";           // ID du serveur
const VOICE_CHANNEL_ID = "1298632389349740625";  // Vocal d'origine
const ROLE_ID = "1450881076359729152";           // rôle soutien
const TAG = "https://discord.gg/galaxrp";         // texte à détecter

// ----------------------
// CLIENT DISCORD
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences, // ⚠️ nécessaire pour lire les statuts
  ],
});

// ----------------------
// AUDIO
// ----------------------
const player = createAudioPlayer();
let connection = null;
let autoJoinEnabled = false;

async function connectToVoice() {
  if (!autoJoinEnabled) return;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

    if (!channel || channel.type !== 2) {
      console.error("❌ Salon vocal invalide");
      return;
    }

    console.log("🔊 Connexion au vocal...");

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log("✅ Connecté au vocal (unmute + deaf)");
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log("⚠️ Déconnecté, reconnexion...");
      if (!autoJoinEnabled) return;
      setTimeout(() => connectToVoice(), 2000);
    });

  } catch (err) {
    console.error("❌ Erreur vocal :", err);
  }
}

// ----------------------
// VOICE UPDATE
// ----------------------
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!autoJoinEnabled) return;
  if (newState.id !== client.user.id) return;

  try {
    if (newState.serverMute) {
      await newState.setMute(false);
      console.log("🔊 Server-unmute appliqué");
    }

    if (!newState.selfDeaf) {
      await newState.setDeaf(true);
      console.log("🔇 Deaf remis");
    }

    if (newState.channelId && newState.channelId !== VOICE_CHANNEL_ID) {
      console.log("⚠️ Bot déplacé → retour...");
      const guild = await client.guilds.fetch(GUILD_ID);
      const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);
      if (channel && channel.type === 2) {
        await newState.setChannel(channel);
        console.log("✅ Retour au salon d'origine");
      }
    }
  } catch (err) {
    console.error("❌ Impossible d'appliquer les changements :", err);
  }
});

// ----------------------
// READY
// ----------------------
client.once("ready", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

// ----------------------
// COMMANDES TEXTE
// ----------------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.author.id !== AUTHORIZED_ID) return;

  // ▶️ START
  if (message.content === "!glxmus2") {
    autoJoinEnabled = true;
    await connectToVoice();

    const resource = createAudioResource(path.join(__dirname, "son.mp3"));
    player.play(resource);

    return message.reply("🎵 Lecture lancée | Bot toujours unmute + sourdine");
  }

  // ⏹️ STOP
  if (message.content === "!glxmus2st") {
    autoJoinEnabled = false;
    player.stop();
    if (connection) {
      connection.destroy();
      connection = null;
    }
    return message.reply("⛔ Arrêt + reconnexion désactivée.");
  }
});

// ----------------------
// LOOP AUDIO
// ----------------------
player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;
  const resource = createAudioResource(path.join(__dirname, "son.mp3"));
  player.play(resource);
});

// ----------------------
// ➕ RÔLE AUTO : vérification du statut
// ----------------------
client.on("presenceUpdate", async (oldPresence, newPresence) => {
  try {
    if (!newPresence || !newPresence.member) return;

    const guild = newPresence.guild;
    if (guild.id !== GUILD_ID) return;

    const member = newPresence.member;
    const role = guild.roles.cache.get(ROLE_ID);

    if (!role) return console.log("⚠️ Rôle introuvable");

    const activities = newPresence.activities || [];
    const statusMsg =
      activities.find(a => a.type === 4)?.state || ""; // type 4 = custom status

    const hasTag = statusMsg.includes(TAG);

    // Ajout du rôle
    if (hasTag && !member.roles.cache.has(ROLE_ID)) {
      await member.roles.add(role);
      console.log(`✅ Rôle ajouté à ${member.user.tag}`);
    }

    // Retrait du rôle
    if (!hasTag && member.roles.cache.has(ROLE_ID)) {
      await member.roles.remove(role);
      console.log(`❌ Rôle retiré à ${member.user.tag}`);
    }

  } catch (err) {
    console.error("❌ Erreur rôle :", err);
  }
});

// ----------------------
client.login(process.env.TOKEN);








