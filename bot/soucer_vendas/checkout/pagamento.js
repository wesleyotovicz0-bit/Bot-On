const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, Attachment, AttachmentBuilder } = require("discord.js")
const { JsonDatabase } = require("wio.db")
const dbe = new JsonDatabase({ databasePath: "./json/emojis.json" })
const dc = new JsonDatabase({ databasePath: "./json/carrinho.json" })
const dbc = new JsonDatabase({ databasePath: "./json/botconfig.json" })
const dbs = new JsonDatabase({ databasePath: "./json/saldo.json" })
const dbp = new JsonDatabase({ databasePath: "./json/personalizados.json" })
const db = new JsonDatabase({ databasePath: "./json/produtos.json" })
const dbr = new JsonDatabase({ databasePath: "./json/rendimentos.json" })
const dbru = new JsonDatabase({ databasePath: "./json/rankUsers.json" })
const dbrp = new JsonDatabase({ databasePath: "./json/rankProdutos.json" })
const dbcp = new JsonDatabase({ databasePath: "./json/perfil.json" })
const fs = require("fs")
const path = require("path")
const https = require("https");
const axios = require("axios");
const Discord = require("discord.js")
const moment = require("moment")
moment.locale("pt-br");
const dbep = new JsonDatabase({ databasePath: "./json/emojisGlob.json" })
const Gerencianet = require("sdk-node-apis-efi");
const { updateEspecifico, sendMessage } = require("../../Functions/UpdateMessageBuy")
const { bloquearBanco, bloquearBancoEfi, enviarProduto, deleteMessages, enviarProduto2, enviarProdutoEsales, bloquearBancoESales } = require("../../Functions/CarrinhoAprovado")
const { paymentMP, paymentEfiPay, paymentMPError, paymentEfiPaySales, paymentMPtimers } = require("../../Functions/GerenciarChekout")
module.exports = {
    name: "interactionCreate",
    run: async (interaction, client) => {
        const customId = interaction.customId
        if (interaction.isButton()) {
            if (customId.endsWith("_pagarpix")) {
                const msg = await interaction.update({ embeds: [], components: [], content: `${dbe.get("16")} | Um momento, estou processando...` })
                const painel = await dc.get(`${interaction.channel.id}.painel`)
                const pd = db.get(`${painel}`)
                const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
                const produto = pdd
                const id = interaction.channel.id;
                const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
                if (dbc.get(`canais.sistema_carrinho`) === "ON") {
                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `🛒 Carrinho criado!`, iconURL: interaction.guild.iconURL({})})
                    .setColor(dbc.get("color"))
                    .setDescription(`- O usuário ${interaction.user} (${interaction.user.username}) acabou de criar um carrinho! Informações abaixo;`)
                    .setThumbnail(interaction.user.displayAvatarURL({}))
                    .addFields(
                        { name: `Detalhes do Carrinho:`, value: `\`1x\` __${produto.nome}__ | R$${Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                        { name: `Estoque:`, value: `${produto.estoque.length}`, inline:true }
                    )
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                    .setTimestamp()
                    if (paumito) await paumito.send({embeds: [embed]}).catch(() => {})
                }
                if (dbs.get("sistema") === "ON") {
                    dc.set(`${id}.eSales`, "ON");

                    let valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`))
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        .replace(',', '.');

                    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                        valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100))
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            .replace(',', '.');
                    }

                    //// Ja definiu o preço
                    const genPay = await paymentEfiPaySales(interaction, msg, produto, valor)
                    const data = genPay.data;
                    if (data === "error") return paymentMPError(interaction, msg, produto, valor);
                    dc.set(`${id}.status`, "esperando2")
                    await setTimeout(() => {
                        if (dc.get(`${id}.status`) === "esperando2") {
                            dc.set(`${id}.status`, "inatividade")
                            interaction.channel.delete()

                            const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`))

                            if (cliente) {
                                if (dbc.get(`canais.sistema_carrinho`) === "ON") {
                                    const embed = new EmbedBuilder()
                                        .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.guild.iconURL({}) })
                                        .setColor("Red")
                                        .setDescription(`- O usuário ${cliente} (${cliente.user.username}) teve o seu carrinho fechado por inatividade.`)
                                        .setThumbnail(cliente.user.displayAvatarURL({}))
                                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                                        .setTimestamp()
                                    const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
                                    paumito.send({ embeds: [embed] }).catch(() => {})
                                }
                                const embeda = new EmbedBuilder()
                                .setAuthor({ name: `❌ Carrinho Fechado`, iconURL: cliente.user.displayAvatarURL({}) })
                                .setColor("Red")
                                .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi fechado por inatividade!`)
                                .setThumbnail(cliente.user.displayAvatarURL({}))
                                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                                .setTimestamp()
    
                                cliente.send({ embeds: [embeda] }).catch(() => {})
                            }
                        }
                    }, 10 * 60000)
                    let certificado = fs.readFileSync(`./Lib/${dbc.get(`esales.certificado`) ? dbc.get(`esales.certificado`) : "undefinied"}.p12`);

                    const httpsAgent = new https.Agent({
                        pfx: certificado,
                        passphrase: "",
                    });

                    var data2 = JSON.stringify({ grant_type: "client_credentials" });
                    var data_credentials = dbc.get(`esales.secret_id`) + ":" + dbc.get(`esales.secret_token`);
                    var auth = Buffer.from(data_credentials).toString("base64");
                    const agent = new https.Agent({
                        pfx: certificado,
                        passphrase: "",
                    });

                    var config = {
                        method: "POST",
                        url: "https://pix.api.efipay.com.br/oauth/token",
                        headers: {
                            Authorization: "Basic " + auth,
                            "Content-Type": "application/json",
                        },
                        httpsAgent: httpsAgent,
                        data: data2,
                    };

                    let access_token = await axios(config).then((response) => {
                        return response.data.access_token;
                    });

                    const url = `https://pix.api.efipay.com.br/v2/cob/${data.txid}`
                    const data24 = {
                        headers: {
                            Authorization: `Bearer ${access_token}`,
                            "Content-Type": "application/json",
                        },
                        httpsAgent: agent,
                    }
                    const checkPaymentStatus = setInterval(async () => {
                        try {
                            const options = {
                                sandbox: false,
                                validateMtls: false,
                                client_id: dbc.get(`esales.secret_id`),
                                client_secret: dbc.get(`esales.secret_token`),
                                certificate: `./schema/${dbc.get(`esales.certificado`) ? dbc.get(`esales.certificado`) : "undefinied"}.p12`,
                            };
                    
                            const gerencianet = new Gerencianet(options);
                            const paramstxt = { txid: data.txid };

                            const response = await gerencianet.pixDetailCharge(paramstxt);
                            
                            if (dc.get(`${id}.status`) === "CANCELADO") {
                                clearInterval(checkPaymentStatus);
                                return;
                            }
                            
                            const paymentGet = response;
                            const paymentStatus = paymentGet.status;
                            
                            if (paymentStatus === "CONCLUIDA") {
                                const params2 = { txid: response.txid };
                                const res2 = await gerencianet.pixDetailCharge(params2);
                    
                                let bank = 'Banco desconhecido';
                                let endToEndId = null;
                                
                                if (res2?.pix?.[0]?.endToEndId) {
                                    endToEndId = res2.pix[0].endToEndId;
                                    const bankCode = endToEndId.substring(1, 9);
                                    const bankName = getBankNameFromCode(bankCode);
                                    bank = bankName ?? `Código do Banco: ${bankCode}`;
                                }
                                
                                
                                if (bank.includes('Banco Inter') || bank.includes('PicPay Ser')) {
                                    clearInterval(checkPaymentStatus);
                                    await bloquearBancoESales(interaction, res2, bank, valorTotal);
                                    return;
                                }
                    
                                dc.set(`${id}.status`, "aprovado");
                                dc.set(`${id}.banco`, bank);
                            }
                    
                            if (dc.get(`${id}.status`) === "aprovado") {
                                clearInterval(checkPaymentStatus);
                                await deleteMessages();
                                await enviarProdutoEsales(interaction, response, dc.get(`${id}.banco`));
                            }
                        } catch (error) {
                        }
                    }, 2000);
                    
                    function getBankNameFromCode(bankCode) {
                        const ispbCodes = {
                            '31872495': 'Banco C6 S.A.',
                            '10573521': 'Mercadopago.com Representações Ltda.',
                            '00416968': 'Banco Inter S.A.',
                            '22896431': 'PicPay Serviços S.A.',
                            '18236120': 'Nu Pagamentos S.A.',
                            '10264663': 'BancoSeguro S.A.',
                            '60746948': 'Banco Bradesco S.A',
                        };
                    
                        return ispbCodes[bankCode] || 'Código ISPB não encontrado';
                    }
                    


                    const { qrGenerator } = require('../../Lib/QRCodeLib')
                    const qr = new qrGenerator({ imagePath: './Lib/zend.png' })
                    const qrcode = await qr.generate(data.pixCopiaECola)


                    const buffer = Buffer.from(qrcode.response, "base64");
                    const attachment = new AttachmentBuilder(buffer, { name: "payment.png" });
                    let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                        valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
                    }
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({}) })
                        .setColor(dbc.get(`color`))
                        .setTimestamp()
                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                        .setDescription(`Olá ${interaction.user} 👋.\n- Pague o valor total. Após pagar o seu carrinho será aprovado automáticamente.`)
                        .addFields(
                            { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` }
                        )
                        .setThumbnail(interaction.guild.iconURL({}))
                    let emjpix = dbep.get(`32`)
                    let emjqrc = dbep.get(`33`)
                    let emjcan = dbep.get(`37`)
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`cpc`)
                                .setLabel(`Chave Pix`)
                                .setEmoji(emjpix),
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`qrc`)
                                .setLabel(`Qr Code`)
                                .setEmoji(emjqrc),
                            new ButtonBuilder()
                                .setStyle(4)
                                .setCustomId(`${interaction.channel.id}_cancelarcarrinho`)
                                .setLabel(`Fechar`)
                                .setEmoji(emjcan)
                        )
                    msg.edit({ content: `${interaction.user}`, embeds: [embed], components: [row] }).then(msg => {
                        const collector = msg.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, })
                        collector.on('collect', interaction2 => {

                            if (interaction2.customId == 'cpc') {
                                interaction2.reply({ content: `${data.pixCopiaECola}`, ephemeral: true });
                            }

                            if (interaction2.customId == 'qrc') {
                                interaction2.reply({ files: [attachment], ephemeral: true });
                            }

                        })
                    })
                } else if (dbs.get("pagamentos.sistema") === "ON" || dbc.get(`pagamentos.sistema_auto`) === "ON") {
                    //// Definir Preço
                    if (dbs.get("sistema") === "ON") dc.set(`${id}.eSales`, "ON")
                    let valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`))
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        .replace(',', '.');

                    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                        valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100))
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            .replace(',', '.');
                    }

                    //// Ja definiu o preço
                    const genPay = await paymentMP(interaction, msg, produto, valor)
                    const data = genPay.data;
                    const acess_token = genPay.acess_token;
                    if (data === "error") return paymentMPError(interaction, msg, produto, valor);
                    dc.set(`${id}.status`, "esperando2")
                    await setTimeout(() => {
                        if (dc.get(`${id}.status`) === "esperando2") {
                            dc.set(`${id}.status`, "inatividade")
                            interaction.channel.delete()

                            const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`))

                            if (cliente) {
                                if (dbc.get(`canais.sistema_carrinho`) === "ON") {
                                    const embed = new EmbedBuilder()
                                        .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.guild.iconURL({}) })
                                        .setColor("Red")
                                        .setDescription(`- O usuário ${cliente} (${cliente.user.username}) teve o seu carrinho fechado por inatividade.`)
                                        .setThumbnail(cliente.user.displayAvatarURL({}))
                                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                                        .setTimestamp()
                                    const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
                                    paumito.send({ embeds: [embed] }).catch(() => {})
                                }
                                const embeda = new EmbedBuilder()
                                .setAuthor({ name: `❌ Carrinho Fechado`, iconURL: cliente.user.displayAvatarURL({}) })
                                .setColor("Red")
                                .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi fechado por inatividade!`)
                                .setThumbnail(cliente.user.displayAvatarURL({}))
                                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                                .setTimestamp()
    
                                cliente.send({ embeds: [embeda] }).catch(() => {})
                            }
                        }
                    }, 10 * 60000)
                    const checkPaymentStatus = setInterval(() => {
                        axios.get(`https://api.mercadopago.com/v1/payments/${data.id}`, {
                            headers: {
                                'Authorization': `Bearer ${acess_token}`
                            }
                        }).then(async (doc) => {
                            if (dc.get(`${id}.status`) === "cancelado") {
                                clearInterval(checkPaymentStatus)
                            }
                            const paymentGet = doc.data
                            const paymentStatus = paymentGet.status;

                            if (paymentStatus === "approved") {
                                const longName = doc.data.point_of_interaction.transaction_data.bank_info.payer.long_name || "N/A";
                                const sistemaStatus = await dbs.get("sistema") === "ON";

                                const blockedBanks = sistemaStatus
                                    ? ["inter", "picpay"]
                                    : await dbc.get("pagamentos.blockbank");

                                const containsTerm = blockedBanks.some(term => {
                                    // Verifica se o nome completo do banco contém o termo bloqueado
                                    return longName.toLowerCase().includes(term.toLowerCase());
                                });

                                if (containsTerm) {
                                    clearInterval(checkPaymentStatus)
                                    await bloquearBanco(interaction, doc, longName)
                                    return;
                                }
                                dc.set(`${id}.status`, "aprovado")
                                dc.set(`${id}.banco`, longName)
                            }
                            if (dc.get(`${id}.status`) === "aprovado") {
                                clearInterval(checkPaymentStatus)
                                if (dc.get(`${id}.forma`) !== "manualmente" && dc.get(`${id}.eSales`) === "ON") await dbs.add("saldo", valor);
                                await deleteMessages()
                                await enviarProduto(interaction, doc, dc.get(`${id}.forma`) === "manualmente" ? "Compra aprovada manualmente." : dc.get(`${id}.banco`))
                            }
                        })
                    }, 1000 * 6)

                    const { qrGenerator } = require('../../Lib/QRCodeLib')
                    const qr = new qrGenerator({ imagePath: './Lib/zend.png' })
                    const qrcode = await qr.generate(data.point_of_interaction.transaction_data.qr_code)


                    const buffer = Buffer.from(qrcode.response, "base64");
                    const attachment = new AttachmentBuilder(buffer, { name: "payment.png" });
                    let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                        valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
                    }
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({}) })
                        .setColor(dbc.get(`color`))
                        .setTimestamp()
                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                        .setDescription(`Olá ${interaction.user} 👋.\n- Pague o valor total. Após pagar o seu carrinho será aprovado automáticamente.`)
                        .addFields(
                            { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` }
                        )
                        .setThumbnail(interaction.guild.iconURL({}))
                    let emjpix = dbep.get(`32`)
                    let emjqrc = dbep.get(`33`)
                    let emjcan = dbep.get(`37`)
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`cpc`)
                                .setLabel(`Chave Pix`)
                                .setEmoji(emjpix),
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`qrc`)
                                .setLabel(`Qr Code`)
                                .setEmoji(emjqrc),
                            new ButtonBuilder()
                                .setStyle(4)
                                .setCustomId(`${interaction.channel.id}_cancelarcarrinho`)
                                .setLabel(`Fechar`)
                                .setEmoji(emjcan)
                        )
                    msg.edit({ content: `${interaction.user}`, embeds: [embed], components: [row] }).then(msg => {
                        const collector = msg.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, })
                        collector.on('collect', interaction2 => {

                            if (interaction2.customId == 'cpc') {
                                interaction2.reply({ content: `${data.point_of_interaction.transaction_data.qr_code}`, ephemeral: true });
                            }

                            if (interaction2.customId == 'qrc') {
                                interaction2.reply({ files: [attachment], ephemeral: true });
                            }

                        })
                    })
                } else if (dbc.get(`pagamentos.sistema_efi`) === "ON") {
                    //// Definir Preço
                    if (dbs.get("sistema") === "ON") dc.set(`${id}.eSales`, "ON")
                    let valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`))
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        .replace(',', '.');

                    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                        valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100))
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            .replace(',', '.');
                    }

                    //// Ja definiu o preço
                    const genPay = await paymentEfiPay(interaction, msg, produto, valor)
                    const data = genPay.data;
                    if (data === "error") return paymentMPError(interaction, msg, produto, valor);
                    
                    dc.set(`${id}.status`, "esperando2")
                    await setTimeout(() => {
                        if (dc.get(`${id}.status`) === "esperando2") {
                            dc.set(`${id}.status`, "inatividade")
                            interaction.channel.delete()

                            const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`))

                            if (cliente) {
                                if (dbc.get(`canais.sistema_carrinho`) === "ON") {
                                    const embed = new EmbedBuilder()
                                        .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.guild.iconURL({}) })
                                        .setColor("Red")
                                        .setDescription(`- O usuário ${cliente} (${cliente.user.username}) teve o seu carrinho fechado por inatividade.`)
                                        .setThumbnail(cliente.user.displayAvatarURL({}))
                                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                                        .setTimestamp()
                                    const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
                                    paumito.send({ embeds: [embed] }).catch(() => {})
                                }
                                const embeda = new EmbedBuilder()
                                .setAuthor({ name: `❌ Carrinho Fechado`, iconURL: cliente.user.displayAvatarURL({}) })
                                .setColor("Red")
                                .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi fechado por inatividade!`)
                                .setThumbnail(cliente.user.displayAvatarURL({}))
                                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                                .setTimestamp()
    
                                cliente.send({ embeds: [embeda] }).catch(() => {})
                            }
                        }
                    }, 10 * 60000)
                    let certificado = fs.readFileSync(`./Lib/${dbc.get(`pagamentos.certificado`) ? dbc.get(`pagamentos.certificado`) : "undefinied"}.p12`);

                    const httpsAgent = new https.Agent({
                        pfx: certificado,
                        passphrase: "",
                    });

                    var data2 = JSON.stringify({ grant_type: "client_credentials" });
                    var data_credentials = dbc.get(`pagamentos.secret_id`) + ":" + dbc.get(`pagamentos.secret_token`);
                    var auth = Buffer.from(data_credentials).toString("base64");
                    const agent = new https.Agent({
                        pfx: certificado,
                        passphrase: "",
                    });

                    var config = {
                        method: "POST",
                        url: "https://pix.api.efipay.com.br/oauth/token",
                        headers: {
                            Authorization: "Basic " + auth,
                            "Content-Type": "application/json",
                        },
                        httpsAgent: httpsAgent,
                        data: data2,
                    };

                    let access_token = await axios(config).then((response) => {
                        return response.data.access_token;
                    });

                    const url = `https://pix.api.efipay.com.br/v2/cob/${data.txid}`
                    const data24 = {
                        headers: {
                            Authorization: `Bearer ${access_token}`,
                            "Content-Type": "application/json",
                        },
                        httpsAgent: agent,
                    }
                    const checkPaymentStatus = setInterval(async () => {
                        try {
                            const response = await axios.get(url, data24);
                            if (dc.get(`${id}.status`) === "CANCELADO") {
                                clearInterval(checkPaymentStatus);
                                return;
                            }

                            const paymentGet = response.data;
                            const paymentStatus = paymentGet.status;
                            const doc = paymentGet

                            if (paymentStatus === "CONCLUIDA") {


                                const options = {
                                    sandbox: false,
                                    client_id: await dbc.get(`pagamentos.secret_id`),
                                    client_secret: await dbc.get(`pagamentos.secret_token`),
                                    certificate: `./Lib/${dbc.get(`pagamentos.certificado`) ? dbc.get(`pagamentos.certificado`) : "undefinied"}.p12`,
                                }

                                const gerencianet = new Gerencianet(options);
                                const params2 = { txid: paymentGet.txid };
                                const res2 = await gerencianet.pixDetailCharge(params2);

                                let bank = 'Banco desconhecido';
                                let endToEndId = null;
                                if (res2?.pix?.[0]?.endToEndId) {
                                    endToEndId = res2.pix[0].endToEndId;
                                    const bankCode = endToEndId.substring(1, 9);
                                    const bankName = getBankNameFromCode(bankCode);
                                    bank = bankName ?? `Código do Banco: ${bankCode}`;
                                };
                                const bloqueados = dbc.get("pagamentos.efiblocks") || [];

                                if (bloqueados.some(banco => bank.includes(banco))) {
                                    clearInterval(checkPaymentStatus);
                                    bloquearBancoEfi(interaction, res2, bank, valorTotal);
                                    return;
                                };


                                function getBankNameFromCode(bankCode) {
                                    const ispbCodes = {
                                        '31872495': 'Banco C6 S.A.',
                                        '10573521': 'Mercadopago.com Representações Ltda.',
                                        '00416968': 'Banco Inter S.A.',
                                        '22896431': 'PicPay Serviços S.A.',
                                        '18236120': 'Nu Pagamentos S.A.',
                                        '10264663': 'BancoSeguro S.A.',
                                        '60746948': 'Banco Bradesco S.A',
                                    };

                                    return ispbCodes[bankCode] || 'Código ISPB não encontrado';
                                }


                                dc.set(`${id}.status`, "aprovado");
                                dc.set(`${id}.banco`, bank);
                            }

                            if (dc.get(`${id}.status`) === "aprovado") {
                                clearInterval(checkPaymentStatus)
                                if (dc.get(`${id}.forma`) !== "manualmente" && dc.get(`${id}.eSales`) === "ON") await dbs.add("saldo", valor);
                                await deleteMessages();
                                await enviarProduto2(interaction, doc, dc.get(`${id}.banco`));
                            }
                        } catch (error) {
                            if (error.response && error.response.data && error.response.data.message === `Payment not found`) {
                                return;
                            }
                        }
                    }, 2000);


                    const { qrGenerator } = require('../../Lib/QRCodeLib')
                    const qr = new qrGenerator({ imagePath: './Lib/zend.png' })
                    const qrcode = await qr.generate(data.pixCopiaECola)


                    const buffer = Buffer.from(qrcode.response, "base64");
                    const attachment = new AttachmentBuilder(buffer, { name: "payment.png" });
                    let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                        valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
                    }
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({}) })
                        .setColor(dbc.get(`color`))
                        .setTimestamp()
                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                        .setDescription(`Olá ${interaction.user} 👋.\n- Pague o valor total. Após pagar o seu carrinho será aprovado automáticamente.`)
                        .addFields(
                            { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` }
                        )
                        .setThumbnail(interaction.guild.iconURL({}))
                    let emjpix = dbep.get(`32`)
                    let emjqrc = dbep.get(`33`)
                    let emjcan = dbep.get(`37`)
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`cpc`)
                                .setLabel(`Chave Pix`)
                                .setEmoji(emjpix),
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`qrc`)
                                .setLabel(`Qr Code`)
                                .setEmoji(emjqrc),
                            new ButtonBuilder()
                                .setStyle(4)
                                .setCustomId(`${interaction.channel.id}_cancelarcarrinho`)
                                .setLabel(`Fechar`)
                                .setEmoji(emjcan)
                        )
                    msg.edit({ content: `${interaction.user}`, embeds: [embed], components: [row] }).then(msg => {
                        const collector = msg.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, })
                        collector.on('collect', interaction2 => {

                            if (interaction2.customId == 'cpc') {
                                interaction2.reply({ content: `${data.pixCopiaECola}`, ephemeral: true });
                            }

                            if (interaction2.customId == 'qrc') {
                                interaction2.reply({ files: [attachment], ephemeral: true });
                            }

                        })
                    })

                } else {
                    const painel = await dc.get(`${interaction.channel.id}.painel`)
                    const pd = db.get(`${painel}`)
                    const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
                    const produto = pdd
                    const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`))
                    let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                        valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
                    }
                    const embedsoli = new EmbedBuilder()
                        .setAuthor({ name: `🛒 Carrinho criado!`, iconURL: interaction.user.displayAvatarURL({}) })
                        .setColor(dbc.get(`color`))
                        .setTimestamp()
                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                        .setDescription(`Olá ${cliente} 👋.\n- Você abriu carrinho e solicitou a compra de um produto, veja as informações abaixo;`)
                        .addFields(
                            { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                            { name: `Valor à Pagar:`, value: `${valorTotal}`, inline: true },
                            { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                        )
                        .setThumbnail(interaction.guild.iconURL({}))

                    cliente.send({ embeds: [embedsoli] })
                    const cargo = interaction.guild.roles.cache.get(dbc.get(`canais.cargo_staff`))
                    let banks = ""
                    dbc.get(`pagamentos.blockbank`).map(entry => {
                        banks += `- ${entry}.\n`
                    })
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({}) })
                        .setColor(dbc.get(`color`))
                        .setTimestamp()
                        .setFooter({ text: `Logo após pagar, envie o comprovante do pagamento no chat!`, iconURL: interaction.guild.iconURL({}) })
                        .setDescription(`Olá ${interaction.user} 👋.\n- Pague o valor total. Após pagar envie o comprovante aqui no chat para um **ADM** aprovar o seu carrinho.`)
                        .addFields(
                            { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` }
                        )
                        .setThumbnail(interaction.guild.iconURL({}))
                    let emjpix = dbep.get(`32`)
                    let emjqrc = dbep.get(`33`)
                    let emjcan = dbep.get(`37`)
                    let emjapr = dbep.get(`38`)
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`${interaction.channel.id}_mostrarchave`)
                                .setLabel(`Chave Pix`)
                                .setEmoji(emjpix),
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`${interaction.channel.id}_mostrarqrcode`)
                                .setLabel(`Qr Code`)
                                .setEmoji(emjqrc),
                            new ButtonBuilder()
                                .setStyle(1)
                                .setCustomId(`${interaction.channel.id}_aprovarpedido`)
                                .setLabel(`Aprovar Carrinho`)
                                .setEmoji(emjapr),
                            new ButtonBuilder()
                                .setStyle(4)
                                .setCustomId(`${interaction.channel.id}_cancelarcarrinho`)
                                .setLabel(`Fechar`)
                                .setEmoji(emjcan)
                        )
                    msg.edit({ content: `${interaction.user} | ${cargo}`, embeds: [embed], components: [row] })
                }
            }

            if (customId.endsWith("_efibankreembolso")) {
                const id = customId.split("_")[0]
                const pddid = customId.split("_")[1]
                const modal = new ModalBuilder()
                    .setCustomId(`${id}_${pddid}_modalreembolso`)
                    .setTitle(`Reembolsar Dinheiro`)
                    .addComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                new TextInputBuilder()
                                    .setCustomId("text")
                                    .setLabel(`Confirmação`)
                                    .setPlaceholder(`Escreva SIM.`)
                                    .setStyle(1)
                            )
                    )
                interaction.showModal(modal)
            }
        }
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            if (customId.endsWith("_modalreembolso")) {
                const id = customId.split("_")[0];
                const pddid = customId.split("_")[1];
                const confir = interaction.fields.getTextInputValue("text").toLowerCase();

                if (confir !== "sim") {
                    await interaction.reply({
                        content: `${dbe.get(`13`)} | Você escreveu "sim" incorretamente!`,
                        ephemeral: true
                    });
                    return;
                }

                const fs = require("fs");
                const https = require("https");
                const axios = require("axios");
                const pd24 = dc.get(pddid) || {};

                if (!pd24.valor || !pd24.loc) {
                    await interaction.reply({
                        content: `❌ As informações necessárias do produto não foram encontradas no sistema.`,
                        ephemeral: true
                    });
                    return;
                }

                try {
                    const EfiPay = require('sdk-node-apis-efi')
                    const options = require("../../schema/credenciais.js")
                    const loc = pd24.loc
                    const txid = pd24.txid


                    const painel = dc.get(`${pddid}.painel`);
                    const pd = db.get(`${painel}`);
                    const pdd = pd.produtos.find((a) => a.nome === dc.get(`${pddid}.produto`));

                    let valor = Number(pdd.preco * dc.get(`${pddid}.quantidade`));
                    if (dc.get(`${pddid}.cupom`) !== "nenhum") {
                        valor = Number(pdd.preco * dc.get(`${pddid}.quantidade`) * (1 - dc.get(`${pddid}.desconto`) / 100));
                    }

                    if (dc.get(`${pddid}.eSales`) === "ON") dbs.substr(`saldo`, valor);
                    const efipay = new EfiPay(options)

                    const paramstxt = { txid: txid };
                    const res = await efipay.pixDetailCharge(paramstxt);
                    const endToEndId = res.pix[0].endToEndId

                    if (valor < 0.02) {
                        await interaction.reply({
                            content: `❌ O valor precisa ser maior ou igual a 0,02.`,
                            ephemeral: true
                        });
                        return;
                    }
                    
                    

                    console.log("Informações atualizadas:", dc.get(pddid));
                    let body = {
                        valor: `${valor}`,
                    }

                    let params = {
                        e2eId: `${endToEndId}`,
                        id: `${res.loc.id}`,
                    }

                    efipay.pixDevolution(params, body)

                    await interaction.message.edit({ components: [] })
                    await interaction.reply({
                        content: `✅ O valor total foi reembolsado com sucesso!`,
                        ephemeral: true
                    });

                } catch (error) {
                    console.log(error);
                    await interaction.reply({
                        content: `${dbe.get(`13`)} | Ocorreu um erro ao tentar reembolsar o valor total. Por favor, verifique os dados e tente novamente.`,
                        ephemeral: true
                    });
                }
            }
        }
    }
}