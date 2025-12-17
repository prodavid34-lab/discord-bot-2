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

// ================= VOCAL =================
async function connectToVoice() {
  if (!autoJoinEnabled) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);
  if (!channel || channel.type !== 2) return;

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  connection.subscribe(player);
}

// maintien vocal
client.on("voiceStateUpdate", async (_, newState) => {
  if (!autoJoinEnabled) return;
  if (newState.id !== client.user.id) return;

  try {
    if (newState.serverMute) await newState.setMute(false);
    if (!newState.selfDeaf) await newState.setDeaf(true);
  } catch {}
});

// ================= AUTO ROLE =================
async function checkMember(member) {
  try {
    // ⛔ Hors ligne / inactif → ON NE FAIT RIEN
    if (!member.presence) return;

    const customStatus = member.presence.activities.find(
      a => a.type === ActivityType.Custom
    );

    // ⛔ Pas de statut → on NE RETIRE PAS
    if (!customStatus || !customStatus.state) return;

    const text = customStatus.state.toLowerCase();
    const hasKeyword = KEYWORDS.some(k => text.includes(k));
    const hasRole = member.roles.cache.has(ROLE_ID);

    if (hasKeyword && !hasRole) {
      await member.roles.add(ROLE_ID);
      console.log(`✅ Rôle ajouté → ${member.user.tag}`);
    }

    if (!hasKeyword && hasRole) {
      await member.roles.remove(ROLE_ID);
      console.log(`❌ Rôle retiré → ${member.user.tag}`);
    }
  } catch (err) {
    console.error("AutoRole error:", err);
  }
}

// changement de statut
client.on("presenceUpdate", (_, newPresence) => {
  if (newPresence?.member) checkMember(newPresence.member);
});

// nouveau membre
client.on("guildMemberAdd", member => {
  checkMember(member);
});

// scan au démarrage (safe pour 15k)
client.once("ready", async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch({ withPresences: true });

  console.log("🔍 Scan initial des statuts...");
  members.forEach(m => checkMember(m));
});

// ================= COMMANDES =================
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.author.id !== AUTHORIZED_ID) return;

  if (message.content === "!glxmus2") {
    autoJoinEnabled = true;
    await connectToVoice();
    player.play(createAudioResource(path.join(__dirname, "son.mp3")));
    return message.reply("🎵 Lecture lancée");
  }

  if (message.content === "!glxmus2st") {
    autoJoinEnabled = false;
    player.stop();
    if (connection) connection.destroy();
    return message.reply("⛔ Lecture arrêtée");
  }
});

// boucle audio
player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;
  player.play(createAudioResource(path.join(__dirname, "son.mp3")));
});

client.login(process.env.TOKEN);
