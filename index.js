require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ActivityType,
  SlashCommandBuilder,
  REST,
  Routes
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
  "566510674424102922",
  "836677770373103636",
  "1331647713149714513"
];

const GUILD_ID = "719294957856227399";
const VOICE_CHANNEL_ID = "1298632389349740625";
const ROLE_ID = "1450881076359729152";

const KEYWORDS = ["discord.gg/galaxrp", "galaxrp"];

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
let autoJoin = false;

let forcedRoles = new Set(); // pour roleon/roleoff

// ==================================================
// 🔊 VOCAL
// ==================================================
async function connectToVoice() {
  if (!autoJoin) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });

  connection.subscribe(player);
}

player.on(AudioPlayerStatus.Idle, () => {
  if (!autoJoin) return;
  player.play(createAudioResource(path.join(__dirname, "son.mp3")));
});

// ==================================================
// 🟦 AUTO ROLE SYSTEM
// ==================================================
async function checkMember(member) {
  try {
    if (!member.presence) return;
    if (forcedRoles.has(member.id)) return;

    const custom = member.presence.activities.find(a => a.type === ActivityType.Custom);
    const state = custom?.state?.toLowerCase() || "";

    const hasKeyword = KEYWORDS.some(k => state.includes(k));
    const hasRole = member.roles.cache.has(ROLE_ID);

    if (hasKeyword && !hasRole) {
      await member.roles.add(ROLE_ID);
      return `🟩 Ajout : ${member.user.tag}`;
    }

    if (!hasKeyword && hasRole) {
      await member.roles.remove(ROLE_ID);
      return `🟥 Retrait : ${member.user.tag}`;
    }

    return null;
  } catch {
    return null;
  }
}

async function manualScan(guild) {
  const members = await guild.members.fetch({ withPresences: true });
  const logs = [];

  for (const mem of members.values()) {
    const r = await checkMember(mem);
    if (r) logs.push(r);
  }
  return logs;
}

// ==================================================
// 🔧 SLASH COMMANDS
// ==================================================
const commands = [
  new SlashCommandBuilder()
    .setName("glx")
    .setDescription("Commandes GalaxRP")
    .addSubcommand(s => s.setName("help").setDescription("Aide"))
    .addSubcommand(s => s.setName("stats").setDescription("Nombre de soutiens"))
    .addSubcommand(s => s.setName("scan").setDescription("Scan manuel + changements"))
    .addSubcommand(s =>
      s
        .setName("roleon")
        .setDescription("Forcer l’ajout du rôle")
        .addUserOption(o =>
          o.setName("membre").setDescription("Membre").setRequired(true)
        )
    )
    .addSubcommand(s =>
      s
        .setName("roleoff")
        .setDescription("Forcer retrait du rôle")
        .addUserOption(o =>
          o.setName("membre").setDescription("Membre").setRequired(true)
        )
    )
    .addSubcommand(s => s.setName("play").setDescription("Lancer la musique"))
    .addSubcommand(s => s.setName("stop").setDescription("Stopper la musique"))
].map(c => c.toJSON());

// DEPLOY
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("✔️ Commandes mises à jour");
})();

// ==================================================
// 🟣 COMMAND HANDLER
// ==================================================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // On répond tout de suite pour éviter les interactions expirées
  await interaction.deferReply({ ephemeral: true });

  if (!AUTHORIZED_IDS.includes(interaction.user.id))
    return interaction.editReply("⛔ Non autorisé.");

  const guild = await client.guilds.fetch(GUILD_ID);
  const sub = interaction.options.getSubcommand();

  // HELP
  if (sub === "help") {
    return interaction.editReply(
      "**/glx help** – Liste des commandes\n" +
      "**/glx stats** – Nombre de soutiens\n" +
      "**/glx scan** – Scan manuel\n" +
      "**/glx roleon** – Force rôle ON\n" +
      "**/glx roleoff** – Force rôle OFF\n" +
      "**/glx play** – Lancer musique\n" +
      "**/glx stop** – Stop musique"
    );
  }

  // STATS
  if (sub === "stats") {
    const members = await guild.members.fetch();
    const count = members.filter(m => m.roles.cache.has(ROLE_ID)).size;
    return interaction.editReply(`📊 **${count}** membres ont le rôle soutien.`);
  }

  // SCAN
  if (sub === "scan") {
    const logs = await manualScan(guild);
    if (logs.length === 0)
      return interaction.editReply("Aucun changement.");

    return interaction.editReply("📥 **Changements :**\n" + logs.join("\n"));
  }

  // ROLEON
  if (sub === "roleon") {
    const m = interaction.options.getUser("membre");
    forcedRoles.add(m.id);

    const gm = await guild.members.fetch(m.id);
    await gm.roles.add(ROLE_ID);

    return interaction.editReply(`🟩 Rôle ajouté à **${m.tag}** (forcé).`);
  }

  // ROLEOFF
  if (sub === "roleoff") {
    const m = interaction.options.getUser("membre");
    forcedRoles.add(m.id);

    const gm = await guild.members.fetch(m.id);
    await gm.roles.remove(ROLE_ID);

    return interaction.editReply(`🟥 Rôle retiré à **${m.tag}** (forcé).`);
  }

  // PLAY
  if (sub === "play") {
    autoJoin = true;
    await connectToVoice();
    player.play(createAudioResource(path.join(__dirname, "son.mp3")));

    return interaction.editReply("🎵 Musique lancée.");
  }

  // STOP
  if (sub === "stop") {
    autoJoin = false;
    player.stop();
    if (connection) connection.destroy();
    return interaction.editReply("⛔ Musique stoppée.");
  }
});

// ==================================================
// 🔄 SCAN AUTO
// ==================================================
setInterval(async () => {
  const guild = await client.guilds.fetch(GUILD_ID);
  await manualScan(guild);
}, 5 * 60 * 1000); // toutes les 5 minutes

// READY
client.once("ready", () => console.log("🚀 Bot prêt"));
client.login(process.env.TOKEN);
