const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } = require("discord.js")
const { JsonDatabase, } = require("wio.db");
const Discord = require("discord.js")
const dbc = new JsonDatabase({ databasePath:"./json/botconfig.json" });
const dbcar = new JsonDatabase({ databasePath:"./json/carrinho.json" });
const dbe = new JsonDatabase({ databasePath:"./json/emojis.json" });
const dbep = new JsonDatabase({ databasePath: "./json/emojisGlob.json"})
const { MercadoPagoConfig, Payment, PaymentRefund} = require("mercadopago")
const axios = require("axios")
const moment = require("moment")
const client = new MercadoPagoConfig({ accessToken: `${dbc.get(`pagamentos.acess_token`)}` });
const payment = new Payment(client);
const refund = new PaymentRefund(client);
const dbr = new JsonDatabase({ databasePath: "./json/rendimentos.json"})
const dbru = new JsonDatabase({ databasePath: "./json/rankUsers.json"})
const dbcp = new JsonDatabase({ databasePath: "./json/perfil.json"})

async function formatValor(valor) {
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function sendMessagePixGerado(interaction, valor) {
    const embed = new EmbedBuilder()
    .setAuthor({ name: `Solicitação para gerar pix.`, iconURL: interaction.user.displayAvatarURL()})
    .setThumbnail(interaction.user.displayAvatarURL())
    .setDescription(`- O usuário ${interaction.user} (${interaction.user.username} - ${interaction.user.id}) fez uma solicitação para gerar um pix.`)
    .setColor(dbc.get("color"))
    .setFields(
        { name: `Valor:`, value: `R$${await formatValor(valor)}`, inline:true },
        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline:true }
    )
    const channel = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
    channel.send({ embeds: [embed]})
}
async function sendMessagePixCancelado(interaction, valor) {
    const embed = new EmbedBuilder()
    .setAuthor({ name: `Pix Cancelado.`, iconURL: interaction.user.displayAvatarURL()})
    .setThumbnail(interaction.user.displayAvatarURL())
    .setDescription(`- O usuário ${interaction.user} (${interaction.user.username} - ${interaction.user.id}) cancelou a solicitação de pix.`)
    .setColor("Red")
    .setFields(
        { name: `Valor:`, value: `R$${await formatValor(valor)}`, inline:true },
        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline:true }
    )
    const channel = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
    channel.send({ embeds: [embed]})
}
async function sendMessagePixBlocked(interaction, valor, banco) {
    const embed = new EmbedBuilder()
    .setAuthor({ name: `Pix Cancelado.`, iconURL: interaction.user.displayAvatarURL()})
    .setThumbnail(interaction.user.displayAvatarURL())
    .setDescription(`- O usuário ${interaction.user} (${interaction.user.username} - ${interaction.user.id}) foi recusado porque o banco utilizado consta como bloqueado em nossos registros.`)
    .setColor("Red")
    .setFields(
        { name: `Banco:`, value: `__${banco}__`, inline:true },
        { name: `Valor:`, value: `R$${await formatValor(valor)}`, inline:true },
        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline:true }
    )
    const channel = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
    channel.send({ embeds: [embed]})
}
async function sendMessagePixSucesso(interaction, valor, doc) {
    const embed = new EmbedBuilder()
    .setAuthor({ name: `Pagamento recebido!`, iconURL: interaction.user.displayAvatarURL()})
    .setThumbnail(interaction.user.displayAvatarURL())
    .setDescription(`- O usuário ${interaction.user} (${interaction.user.username} - ${interaction.user.id}) pagou o pix gerado!`)
    .setColor("Green")
    .setFields(
        { name: `Valor:`, value: `R$${await formatValor(valor)}`, inline:true },
        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline:true }
    )
    const row = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
        .setStyle(2)
        .setCustomId(`${doc.data.id}_reembolsarproduto`)
        .setLabel(`Reembolsar Compra`)
        .setEmoji(dbep.get(`3`))
    )
    const brasilDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const formattedDate = brasilDate;
    dbr.add("gastostotal", valor);
    dbr.add(`${formattedDate}.pedidos`, 1);
    dbr.add(`${formattedDate}.recebimentos`, valor);

    dbru.add(`${interaction.user.id}.gastosaprovados`, valor);
    dbru.add(`${interaction.user.id}.pedidosaprovados`, `1`);

    dbcp.set(`${interaction.user.id}.userid`, interaction.user.id);
    dbcp.add(`${interaction.user.id}.comprasrealizadas`, 1);
    dbcp.add(`${interaction.user.id}.valoresganhos`, valor);
    const channel = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
    channel.send({ embeds: [embed], components: [row]})
}

async function sendMessagePixExpirado(interaction, valor) {
    const embed = new EmbedBuilder()
    .setAuthor({ name: `Pix Cancelado.`, iconURL: interaction.guild.iconURL()})
    .setThumbnail(interaction.guild.iconURL())
    .setDescription(`- A solicitação foi cancelada pois durou mais de 20 minutos com inatividade.`)
    .setColor("Red")
    .setFields(
        { name: `Valor:`, value: `R$${await formatValor(valor)}`, inline:true },
        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline:true }
    )
    const channel = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
    channel.send({ embeds: [embed]})
}
module.exports = {
    sendMessagePixGerado,
    sendMessagePixCancelado,
    sendMessagePixExpirado,
    sendMessagePixSucesso,
    sendMessagePixBlocked,
    formatValor
}