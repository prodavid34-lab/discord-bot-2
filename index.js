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

const AUTHORIZED_ID = "566510674424102922";      // ID autorisé
const GUILD_ID = "719294957856227399";           // ID du serveur
const VOICE_CHANNEL_ID = "1298632389349740625";  // ID du salon d'origine

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = createAudioPlayer();
let connection = null;
let autoJoinEnabled = false;

// -------------------------
// Fonction pour rejoindre le vocal
// -------------------------
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
      selfDeaf: true,  // sourdine
      selfMute: false, // toujours unmute
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

// -------------------------
// Gestion des changements de voix
// -------------------------
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!autoJoinEnabled) return;
  if (newState.id !== client.user.id) return;

  try {
    // 1️⃣ Si le bot est server-muted → se server-unmute
    if (newState.serverMute) {
      await newState.setMute(false);
      console.log("🔊 Server-unmute appliqué automatiquement");
    }

    // 2️⃣ Toujours sourdine (selfDeaf)
    if (!newState.selfDeaf) {
      await newState.setDeaf(true);
      console.log("🔇 Deaf remise automatiquement");
    }

    // 3️⃣ Si le bot est déplacé dans un autre vocal → retour au vocal origin
    if (newState.channelId && newState.channelId !== VOICE_CHANNEL_ID) {
      console.log("⚠️ Bot déplacé dans un autre salon, retour à l'origin...");
      const guild = await client.guilds.fetch(GUILD_ID);
      const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

      if (channel && channel.type === 2) {
        await newState.setChannel(channel);
        console.log("✅ Bot revenu dans le salon d'origine");
      }
    }

  } catch (err) {
    console.error("❌ Impossible d'appliquer les changements :", err);
  }
});

// -------------------------
// Ready
// -------------------------
client.once("ready", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

// -------------------------
// Commandes messages
// -------------------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.author.id !== AUTHORIZED_ID) return;

  // ▶️ START
  if (message.content === "!glxmus2") {
    autoJoinEnabled = true;
    await connectToVoice();

    const resource = createAudioResource(
      path.join(__dirname, "son.mp3")
    );
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

// -------------------------
// Boucle audio
// -------------------------
player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;

  const resource = createAudioResource(
    path.join(__dirname, "son.mp3")
  );
  player.play(resource);
});

client.login(process.env.TOKEN);





