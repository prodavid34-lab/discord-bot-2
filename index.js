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
  "566510674424102922", // toi
  "836677770373103636", // Ten
  "1331647713149714513" // Antoine
];

const GUILD_ID = "719294957856227399";
const VOICE_CHANNEL_ID = "1298632389349740625";
const ROLE_ID = "1450881076359729152";

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
    selfDeaf: true,
    selfMute: false
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

    const customStatus = member.presence.activities.find(a => a.type === ActivityType.Custom);

    const state = customStatus?.state?.toLowerCase() || "";
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
  } catch (_) {
    return null;
  }
}

async function manualScan(guild) {
  const members = await guild.members.fetch({ withPresences: true });

  const changes = [];
  for (const member of members.values()) {
    const c = await checkMember(member);
    if (c) changes.push(c);
  }
  return changes;
}

// ==================================================
// 🟪 SLASH COMMANDS
// ==================================================
const commands = [
  new SlashCommandBuilder()
    .setName("glx")
    .setDescription("Commandes GalaxRP")
    .addSubcommand(sub =>
      sub.setName("help").setDescription("Liste des commandes")
    )
    .addSubcommand(sub =>
      sub.setName("stats").setDescription("Voir le nombre de membres avec le rôle")
    )
    .addSubcommand(sub =>
      sub.setName("scan").setDescription("Scan manuel + liste des changements")
    )
    .addSubcommand(sub =>
      sub
        .setName("roleon")
        .setDescription("Force l’ajout du rôle soutien à un membre")
        .addUserOption(o =>
          o.setName("membre").setDescription("Le membre à modifier").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("roleoff")
        .setDescription("Force le retrait du rôle soutien à un membre")
        .addUserOption(o =>
          o.setName("membre").setDescription("Le membre à modifier").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("play").setDescription("Lancer la musique en boucle")
    )
    .addSubcommand(sub =>
      sub.setName("stop").setDescription("Arrêter la musique")
    )
].map(c => c.toJSON());

// ===== DEPLOY COMMANDS =====
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✔️ Commands registered");
  } catch (e) {
    console.error(e);
  }
})();

// ==================================================
// 🔵 COMMAND HANDLER
// ==================================================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!AUTHORIZED_IDS.includes(interaction.user.id))
    return interaction.reply({ content: "⛔ Non autorisé.", ephemeral: true });

  const guild = await client.guilds.fetch(GUILD_ID);

  // --- HELP ---
  if (interaction.options.getSubcommand() === "help") {
    return interaction.reply({
      ephemeral: true,
      content:
        "**/glx help** – Liste des commandes\n" +
        "**/glx stats** – Combien ont le rôle soutien\n" +
        "**/glx scan** – Scan manuel + changements\n" +
        "**/glx roleon** – Force rôle ON\n" +
        "**/glx roleoff** – Force rôle OFF\n" +
        "**/glx play** – Lance la musique\n" +
        "**/glx stop** – Stop la musique"
    });
  }

  // --- STATS ---
  if (interaction.options.getSubcommand() === "stats") {
    const members = await guild.members.fetch();
    const count = members.filter(m => m.roles.cache.has(ROLE_ID)).size;

    return interaction.reply({
      ephemeral: true,
      content: `📊 **${count}** membres possèdent le rôle soutien`
    });
  }

  // --- SCAN ---
  if (interaction.options.getSubcommand() === "scan") {
    const changes = await manualScan(guild);
    if (changes.length === 0)
      return interaction.reply({ ephemeral: true, content: "Aucun changement." });

    return interaction.reply({
      ephemeral: true,
      content: "📥 **Changements détectés :**\n" + changes.join("\n")
    });
  }

  // --- ROLEON ---
  if (interaction.options.getSubcommand() === "roleon") {
    const member = interaction.options.getUser("membre");
    forcedRoles.add(member.id);

    const guildMember = await guild.members.fetch(member.id);
    await guildMember.roles.add(ROLE_ID);

    return interaction.reply({
      ephemeral: true,
      content: `🟩 Rôle ajouté à **${member.tag}** (forcé)`
    });
  }

  // --- ROLEOFF ---
  if (interaction.options.getSubcommand() === "roleoff") {
    const member = interaction.options.getUser("membre");
    forcedRoles.add(member.id);

    const guildMember = await guild.members.fetch(member.id);
    await guildMember.roles.remove(ROLE_ID);

    return interaction.reply({
      ephemeral: true,
      content: `🟥 Rôle retiré à **${member.tag}** (forcé)`
    });
  }

  // --- PLAY ---
  if (interaction.options.getSubcommand() === "play") {
    autoJoin = true;
    await connectToVoice();
    player.play(createAudioResource(path.join(__dirname, "son.mp3")));

    return interaction.reply({ ephemeral: true, content: "🎵 Musique lancée." });
  }

  // --- STOP ---
  if (interaction.options.getSubcommand() === "stop") {
    autoJoin = false;
    player.stop();
    if (connection) connection.destroy();

    return interaction.reply({ ephemeral: true, content: "⛔ Musique stoppée." });
  }
});

client.once("ready", () => console.log("🚀 Bot prêt"));
client.login(process.env.TOKEN);
