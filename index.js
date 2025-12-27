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
} = require("@discordjs/voice");
const path = require("path");

// ================= CONFIG =================
const AUTHORIZED_ID = "566510674424102922";
const GUILD_ID = "719294957856227399";
const VOICE_CHANNEL_ID = "1298632389349740625";
const ROLE_ID = "1450881076359729152"; // rôle soutien
const KEYWORDS = ["discord.gg/galaxrp", "galaxrp"];
const PREFIX = "!glx";

let autoRoleEnabled = true;
let autoScanInterval = 10 * 60 * 1000;
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

player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoinEnabled) return;
  player.play(createAudioResource(path.join(__dirname, "son.mp3")));
});

// ================= AUTO ROLE =================
async function checkMember(member) {
  if (!autoRoleEnabled) return;

  try {
    if (!member.presence) return;

    const customStatus = member.presence.activities.find(a => a.type === ActivityType.Custom);
    if (!customStatus || !customStatus.state) return;

    const text = customStatus.state.toLowerCase();
    lastStatuses.set(member.id, text);

    const hasKeyword = KEYWORDS.some(k => text.includes(k));
    const hasRole = member.roles.cache.has(ROLE_ID);

    if (hasKeyword && !hasRole) {
      await member.roles.add(ROLE_ID);
      console.log(`➕ Ajout du rôle → ${member.user.tag}`);
    }

    if (!hasKeyword && hasRole) {
      await member.roles.remove(ROLE_ID);
      console.log(`➖ Retrait du rôle → ${member.user.tag}`);
    }
  } catch (err) {
    console.error("Erreur AutoRole:", err);
  }
}

// présence
client.on("presenceUpdate", (_, newPresence) => {
  if (newPresence?.member) checkMember(newPresence.member);
});

// nouveau membre
client.on("guildMemberAdd", member => {
  checkMember(member);
});

// ================= SCAN AUTO =================
async function fullScan() {
  console.log("🔍 Scan complet démarré...");
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch({ withPresences: true });

  let count = 0;
  for (const member of members.values()) {
    await checkMember(member);
    count++;
  }

  console.log(`✅ Scan terminé (${count} membres analysés)`);
  return count;
}

// intervalle auto
setInterval(() => {
  if (autoRoleEnabled) fullScan();
}, autoScanInterval);

// ================= COMMANDES =================
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.author.id !== AUTHORIZED_ID) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(" ");
  const cmd = args.shift()?.toLowerCase();

  // HELP  
  if (cmd === "help") {
    return message.reply(
      "**📘 Commandes disponibles :**\n" +
      "`!glxhelp`\n" +
      "`!glxscan`\n" +
      "`!glxforcerole @user`\n" +
      "`!glxroleoff @user`\n" +
      "`!glxlaststatus @user`\n" +
      "`!glxstats`\n" +
      "`!glxscaninterval <minutes>`\n" +
      "`!glxteststatus @user <texte>`\n" +
      "`!glxautoroleoff`\n" +
      "`!glxmus2`\n" +
      "`!glxmus2st`"
    );
  }

  // scan manuel
  if (cmd === "scan") {
    const n = await fullScan();
    return message.reply(`🔍 Scan terminé : **${n} membres** analysés.`);
  }

  // force le rôle
  if (cmd === "forcerole") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mentionne quelqu’un.");
    await user.roles.add(ROLE_ID);
    return message.reply(`➕ Rôle ajouté à **${user.user.tag}**`);
  }

  // retire le rôle
  if (cmd === "roleoff") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mentionne quelqu’un.");
    await user.roles.remove(ROLE_ID);
    return message.reply(`➖ Rôle retiré à **${user.user.tag}**`);
  }

  // dernier statut
  if (cmd === "laststatus") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mentionne quelqu’un.");
    const st = lastStatuses.get(user.id);
    return message.reply(`📝 Dernier statut de **${user.user.tag}** :\n\`${st ?? "Aucun"}\``);
  }

  // stats
  if (cmd === "stats") {
    return message.reply(
      `📊 **Stats bot :**\n` +
      `AutoRole : ${autoRoleEnabled ? "🟢 ON" : "🔴 OFF"}\n` +
      `Intervalle scan : ${(autoScanInterval / 60000)} min`
    );
  }

  // changer intervalle
  if (cmd === "scaninterval") {
    const min = parseInt(args[0]);
    if (isNaN(min) || min < 1) return message.reply("❌ Mets un nombre en minutes.");
    autoScanInterval = min * 60000;
    return message.reply(`⏱️ Nouvel intervalle : **${min} min**`);
  }

  // teststatus
  if (cmd === "teststatus") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mentionne quelqu’un.");
    const fake = args.slice(1).join(" ").toLowerCase();
    if (!fake) return message.reply("❌ Fournis un texte.");
    lastStatuses.set(user.id, fake);
    return message.reply(`🧪 Statut simulé : \`${fake}\``);
  }

  // autoRoleOff
  if (cmd === "autoroleoff") {
    autoRoleEnabled = false;
    return message.reply("⛔ AutoRole désactivé.");
  }

  // musique ON
  if (cmd === "mus2") {
    autoJoinEnabled = true;
    await connectToVoice();
    player.play(createAudioResource(path.join(__dirname, "son.mp3")));
    return message.reply("🎵 Musique lancée.");
  }

  // musique STOP
  if (cmd === "mus2st") {
    autoJoinEnabled = false;
    player.stop();
    if (connection) connection.destroy();
    return message.reply("🛑 Musique arrêtée.");
  }
});

// ================= READY =================
client.once("ready", async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  console.log("🔍 Scan initial...");
  await fullScan();
  console.log("✅ Ready.");
});

client.login(process.env.TOKEN);
