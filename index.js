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

// -------------------------
// CONFIG
// -------------------------
const AUTHORIZED_ID = "566510674424102922";      // ID autorisé
const GUILD_ID = "719294957856227399";           // ID du serveur
const VOICE_CHANNEL_ID = "1298632389349740625";  // ID du salon vocal
const ROLE_ID = "1450881076359729152";           // Rôle soutien
const KEYWORD = "discord.gg/galaxrp";            // Mot clé statut

// -------------------------
// CLIENT
// -------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = createAudioPlayer();
let connection = null;
let autoJoinEnabled = false;

// -------------------------
// Fonction Vocal
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
      selfDeaf: true,
      selfMute: false,
    });

    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log("✅ Connecté au vocal");
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
// Contrôle vocal automatique
// -------------------------
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!autoJoinEnabled) return;
  if (newState.id !== client.user.id) return;

  try {
    if (newState.serverMute) {
      await newState.setMute(false);
      console.log("🔊 Unmute auto");
    }

    if (!newState.selfDeaf) {
      await newState.setDeaf(true);
      console.log("🔇 Deaf auto");
    }

    if (newState.channelId && newState.channelId !== VOICE_CHANNEL_ID) {
      console.log("⚠️ Déplacement détecté, retour au salon d’origine...");
      const guild = await client.guilds.fetch(GUILD_ID);
      const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);
      await newState.setChannel(channel);
      console.log("✅ Revenu au salon d’origine");
    }
  } catch (err) {
    console.error("❌ Erreur voiceState:", err);
  }
});

// -------------------------
// COMMANDES
// -------------------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.author.id !== AUTHORIZED_ID) return;

  if (message.content === "!glxmus2") {
    autoJoinEnabled = true;
    await connectToVoice();
    const resource = createAudioResource(path.join(__dirname, "son.mp3"));
    player.play(resource);
    return message.reply("🎵 Lecture lancée | Bot unmute + sourdine");
  }

  if (message.content === "!glxmus2st") {
    autoJoinEnabled = false;
    player.stop();
    if (connection) {
      connection.destroy();
      connection = null;
    }
    return message.reply("⛔ Arrêt + maintien désactivé");
  }
});

// -------------------------
// Boucle musique
// -------------------------
player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;
  const resource = createAudioResource(path.join(__dirname, "son.mp3"));
  player.play(resource);
});

// ===================================================================
//  AUTO ROLE — détecte statut contenant : discord.gg/galaxrp
// ===================================================================

// Vérifie si un membre doit recevoir/retirer le rôle
async function checkStatus(member) {
  try {
    const status = member?.presence?.activities?.find(a => a.type === 4);
    const hasLink = status?.state?.toLowerCase()?.includes(KEYWORD);
    const hasRole = member.roles.cache.has(ROLE_ID);

    if (hasLink && !hasRole) {
      await member.roles.add(ROLE_ID);
      console.log(`🎉 Rôle ajouté à ${member.user.tag}`);
    }

    if (!hasLink && hasRole) {
      await member.roles.remove(ROLE_ID);
      console.log(`❌ Rôle retiré à ${member.user.tag}`);
    }
  } catch (err) {
    console.error("Erreur checkStatus:", err);
  }
}

// Mise à jour de présence
client.on("presenceUpdate", (oldPresence, newPresence) => {
  if (newPresence?.member) checkStatus(newPresence.member);
});

// Nouveau membre
client.on("guildMemberAdd", (member) => {
  checkStatus(member);
});

// Scan complet au démarrage
client.on("ready", async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();

  console.log("🔍 Scan des membres pour statut GLX...");
  members.forEach(m => checkStatus(m));
});

// -------------------------
client.login(process.env.TOKEN);








