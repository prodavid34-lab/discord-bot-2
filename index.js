require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ActivityType,
  ChannelType
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require("@discordjs/voice");

const path = require("path");

// ================= CONFIG =================
const AUTHORIZED_IDS = [
  "566510674424102922",
  "836677770373103636",
  "1331647713149714513"
];

const GUILD_ID = "719294957856227399";
const VOICE_CHANNEL_ID = "1298632389349740625";
const ROLE_ID = "1450881076359729152";
const KEYWORDS = ["discord.gg/galaxrp", "galaxrp"];
const PREFIX = "!glx";

let autoRoleEnabled = true;
let lastStatuses = new Map();

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

// Audio
const player = createAudioPlayer();
let connection = null;
let autoJoinEnabled = false;

// ============================================================================
// =============  AUTO SCAN ULTRA ALLÉGÉ  (évènements uniquement)  =============
// ============================================================================

async function checkMember(member) {
  if (!autoRoleEnabled) return;

  try {
    if (!member.presence) return;

    const customStatus = member.presence.activities.find(a => a.type === ActivityType.Custom);
    if (!customStatus || !customStatus.state) {
      // Aucun statut → retirer le rôle si présent
      if (member.roles.cache.has(ROLE_ID)) {
        try {
          await member.roles.remove(ROLE_ID);
          console.log(`➖ Retrait auto → ${member.user.tag} (aucun statut)`);
        } catch (err) {
          console.error(`❌ ERREUR retrait ${member.user.tag} (${member.id}) : ${err.message}`);
        }
      }
      return;
    }

    const text = customStatus.state.toLowerCase();
    lastStatuses.set(member.id, text);

    const hasKeyword = KEYWORDS.some(k => text.includes(k));
    const hasRole = member.roles.cache.has(ROLE_ID);

    if (hasKeyword && !hasRole) {
      try {
        await member.roles.add(ROLE_ID);
        console.log(`➕ Ajout auto → ${member.user.tag}`);
      } catch (err) {
        console.error(`❌ ERREUR ajout ${member.user.tag} (${member.id}) : ${err.message}`);
      }
    }

    if (!hasKeyword && hasRole) {
      try {
        await member.roles.remove(ROLE_ID);
        console.log(`➖ Retrait auto → ${member.user.tag}`);
      } catch (err) {
        console.error(`❌ ERREUR retrait ${member.user.tag} (${member.id}) : ${err.message}`);
      }
    }

  } catch (err) {
    console.error("Erreur AutoRole:", err);
  }
}

// ================= EVENTS =================
client.on("presenceUpdate", (_, newPresence) => {
  if (newPresence?.member) checkMember(newPresence.member);
});

client.on("guildMemberAdd", member => {
  checkMember(member);
});

// ============================================================================
// ==========================   VOCAL   =======================================
// ============================================================================
async function connectToVoice() {
  if (!autoJoinEnabled) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  connection.subscribe(player);
}

player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;
  player.play(createAudioResource(path.join(__dirname, "son.mp3")));
});

// ============================================================================
// ========================== COMMANDES =======================================
// ============================================================================
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!AUTHORIZED_IDS.includes(message.author.id)) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(" ");
  const cmd = args.shift()?.toLowerCase();

  if (cmd === "help") {
    return message.reply(
      "**📘 Commandes :**\n" +
      "`!glxhelp`\n" +
      "`!glxforcerole @user`\n" +
      "`!glxroleoff @user`\n" +
      "`!glxlaststatus @user`\n" +
      "`!glxautoroleoff`\n" +
      "`!glxmus2`\n" +
      "`!glxmus2st`"
    );
  }

  if (cmd === "forcerole") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mentionne quelqu’un.");
    await user.roles.add(ROLE_ID);
    return message.reply(`➕ Rôle ajouté à **${user.user.tag}**`);
  }

  if (cmd === "roleoff") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mentionne quelqu’un.");
    await user.roles.remove(ROLE_ID);
    return message.reply(`➖ Rôle retiré à **${user.user.tag}**`);
  }

  if (cmd === "laststatus") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mentionne quelqu’un.");
    const st = lastStatuses.get(user.id);
    return message.reply(`📝 Dernier statut de **${user.user.tag}** :\n\`${st ?? "Aucun"}\``);
  }

  if (cmd === "autoroleoff") {
    autoRoleEnabled = false;
    return message.reply("⛔ AutoRole désactivé.");
  }

  // ---- MUSIQUE ----
  if (cmd === "mus2") {
    autoJoinEnabled = true;
    await connectToVoice();
    player.play(createAudioResource(path.join(__dirname, "son.mp3")));
    return message.reply("🎵 Musique lancée.");
  }

  if (cmd === "mus2st") {
    autoJoinEnabled = false;
    player.stop();
    if (connection) connection.destroy();
    return message.reply("🛑 Musique arrêtée.");
  }
});

// ============================================================================
// ============================ READY =========================================
// ============================================================================
client.once("ready", () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  console.log("⏳ Mode EVENT-ONLY : aucun scan massif, 0 erreur Gateway.");
});

client.login(process.env.TOKEN);
