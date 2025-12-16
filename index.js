require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const path = require("path");

const AUTHORIZED_ID = "566510674424102922";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = createAudioPlayer();

client.once("ready", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.content !== "!glxmus2") return;

  // 🔒 Vérification de l'ID autorisé
  if (message.author.id !== AUTHORIZED_ID) {
    return message.reply("❌ Tu n’es pas autorisé à utiliser cette commande.");
  }

  if (!message.member.voice.channel) {
    return message.reply("❌ Tu dois être dans un salon vocal.");
  }

  const connection = joinVoiceChannel({
    channelId: message.member.voice.channel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
  });

  const resource = createAudioResource(
    path.join(__dirname, "son.mp3")
  );

  player.play(resource);
  connection.subscribe(player);

  message.reply("🎵 Lecture en boucle lancée !");
});

// 🔁 Boucle automatique
player.on(AudioPlayerStatus.Idle, () => {
  const resource = createAudioResource(
    path.join(__dirname, "son.mp3")
  );
  player.play(resource);
});

client.login(process.env.TOKEN);


