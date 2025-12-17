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

const AUTHORIZED_ID = "566510674424102922";
const GUILD_ID = "719294957856227399";
const VOICE_CHANNEL_ID = "1298632389349740625";

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

async function connectToVoice() {
  if (!autoJoinEnabled) return;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

    if (!channel || channel.type !== 2) {
      console.error("❌ Salon vocal introuvable ou invalide");
      return;
    }

    console.log("🔊 Tentative de connexion au vocal...");

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log("✅ Connecté au vocal !");
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log("⚠️ Déconnecté du vocal, reconnexion...");
      if (!autoJoinEnabled) return;

      setTimeout(() => connectToVoice(), 2000);
    });

  } catch (err) {
    console.error("❌ Erreur connexion vocal :", err);
  }
}

client.once("ready", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.author.id !== AUTHORIZED_ID) return;

  // ▶️ START
  if (message.content === "!glxmus1") {
    autoJoinEnabled = true;

    await connectToVoice();

    const resource = createAudioResource(
      path.join(__dirname, "son.mp3")
    );
    player.play(resource);

    return message.reply("🎵 Lecture lancée + connexion automatique activée.");
  }

  // ⏹️ STOP
  if (message.content === "!glxmus1st") {
    autoJoinEnabled = false;

    player.stop();

    if (connection) {
      connection.destroy();
      connection = null;
    }

    return message.reply("⛔ Lecture arrêtée et reconnexion désactivée.");
  }
});

// 🔁 LOOP AUDIO
player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;

  const resource = createAudioResource(
    path.join(__dirname, "son.mp3")
  );
  player.play(resource);
});

client.login(process.env.TOKEN);



