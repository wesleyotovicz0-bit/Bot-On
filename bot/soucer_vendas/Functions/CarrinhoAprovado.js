const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, Attachment, AttachmentBuilder } = require("discord.js")
const { JsonDatabase } = require("wio.db")
const dbe = new JsonDatabase({ databasePath: "./json/emojis.json" })
const dc = new JsonDatabase({ databasePath: "./json/carrinho.json" })
const dbc = new JsonDatabase({ databasePath: "./json/botconfig.json" })
const dbp = new JsonDatabase({ databasePath: "./json/personalizados.json" })
const db = new JsonDatabase({ databasePath: "./json/produtos.json" })
const dbr = new JsonDatabase({ databasePath: "./json/rendimentos.json" })
const dbs = new JsonDatabase({ databasePath: "./json/saldo.json" })
const dbru = new JsonDatabase({ databasePath: "./json/rankUsers.json" })
const dbrp = new JsonDatabase({ databasePath: "./json/rankProdutos.json" })
const dbcp = new JsonDatabase({ databasePath: "./json/perfil.json" })
const dbinfopag = new JsonDatabase({ databasePath: "./json/infoPagamento.json" })
const fs = require("fs")
const dbep = new JsonDatabase({ databasePath: "./json/emojisGlob.json" })
const { updateEspecifico, sendMessage } = require("./UpdateMessageBuy")
const dbcg = new JsonDatabase({ databasePath: "./json/configGlob.json" })
const { MercadoPagoConfig, Payment, PaymentRefund } = require("mercadopago")
const axios = require("axios")
const EfiPay = require('sdk-node-apis-efi');
const moment = require("moment")
async function deleteMessages(interaction) {
    while (true) {
        try {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            if (messages.size === 0) break;
            await interaction.channel.bulkDelete(messages);
        } catch (error) { return; }
    }
}

async function formatValor(valor) {
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
async function bloquearBanco(interaction, doc, banco) {
    try {
        const acess_token = await dc.get(`${interaction.channel.id}.eSales`) === "ON" ? dbcg.get('acessToken') : dbc.get(`pagamentos.acess_token`);
        const client = new MercadoPagoConfig({ accessToken: acess_token });
        const payment = new Payment(client);
        const refund = new PaymentRefund(client);
        const painel = await dc.get(`${interaction.channel.id}.painel`);
        const pd = db.get(`${painel}`);
        const index = pd.produtos.findIndex(a => a.nome === dc.get(`${interaction.channel.id}.produto`));
        const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`));
        const produto = pdd;
        const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`));
        await deleteMessages(interaction);

        let valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toFixed(2).replace(',', '.');
        if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
            valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toFixed(2).replace(',', '.');
        }

        dbinfopag.set(`${interaction.channel.id}.id`, interaction.channel.id);
        dbinfopag.set(`${interaction.channel.id}.status`, "Recusado");
        dbinfopag.set(`${interaction.channel.id}.valor`, Number(valorForm));
        dbinfopag.set(`${interaction.channel.id}.banco`, banco);
        dbinfopag.set(`${interaction.channel.id}.produtoEntregue`, []);

        // Tenta criar o reembolso
        await refund.create({
            payment_id: doc.data.id,
            body: {}
        });

        const embed = new EmbedBuilder()
            .setAuthor({ name: `❌ Erro na compra!`, iconURL: interaction.guild.iconURL({}) })
            .setColor("Red")
            .setDescription(`Olá ${interaction.user}.\n- Notificamos que você está utilizando o banco **${banco}**.\n> Infelizmente, este banco está bloqueado em nossos registros pelos administradores do servidor.\n> Não se preocupe! Seu dinheiro já foi reembolsado. Se desejar adquirir o produto, por favor, utilize outro banco para realizar a compra.`)
            .setThumbnail(interaction.user.displayAvatarURL({}))
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setTimestamp();

        interaction.channel.send({ embeds: [embed], components: [] });

        const embeda = new EmbedBuilder()
            .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.user.displayAvatarURL({}) })
            .setColor("Red")
            .setDescription(`Olá ${interaction.user} 👋.\n- Seu carrinho foi fechado por ter um banco bloqueado nos registros!`)
            .setThumbnail(interaction.user.displayAvatarURL({}))
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setTimestamp();

        cliente.send({ embeds: [embeda] }).catch(() => { });

        if (dbc.get(`canais.sistema_carrinho`) === "ON") {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.guild.iconURL({}) })
                .setColor("Red")
                .setDescription(`- O usuário ${interaction.user} (${interaction.user.username}) teve o seu carrinho fechado por ter um banco bloqueado nos registros.`)
                .setThumbnail(interaction.user.displayAvatarURL({}))
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .setTimestamp();

            const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`));
            paumito.send({ embeds: [embed] });
        }

        setTimeout(() => {
            dc.set(`${interaction.channel.id}.status`, "banco_bloqueado")
            interaction.channel.delete()
        }, 1000 * 30);
    } catch (error) {
        console.error("Erro ao bloquear banco:", error);

        // Envia uma mensagem para o canal ou usuário avisando do erro, se necessário
        interaction.channel.send({
            content: "Ocorreu um erro ao tentar processar o bloqueio do banco. Por favor, tente novamente mais tarde."
        }).catch(console.error);
    }
}


async function bloquearBancoEfi(interaction, doc, banco, Valortotal) {
    try {
        const painel = await dc.get(`${interaction.channel.id}.painel`);
        const pd = db.get(`${painel}`);
        const index = pd.produtos.findIndex(a => a.nome === dc.get(`${interaction.channel.id}.produto`));
        const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`));
        const produto = pdd;
        const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`));
        await deleteMessages(interaction);

        let valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toFixed(2).replace(',', '.');
        if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
            valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toFixed(2).replace(',', '.');
        }

        dbinfopag.set(`${interaction.channel.id}.id`, interaction.channel.id);
        dbinfopag.set(`${interaction.channel.id}.status`, "Recusado");
        dbinfopag.set(`${interaction.channel.id}.valor`, Number(valorForm));
        dbinfopag.set(`${interaction.channel.id}.banco`, banco);
        dbinfopag.set(`${interaction.channel.id}.produtoEntregue`, []);
        const cdd = dc.get(interaction.channel.id) || []
        console.log(doc)

        const EfiPay = require('sdk-node-apis-efi')
        const options = require("../schema/credenciais.js")
        const efipay = new EfiPay(options)

        const paramstxt = { txid: doc.txid };
        const res = await efipay.pixDetailCharge(paramstxt);
        const endToEndId = res.pix[0].endToEndId

        console.log(res)
        let body = {
            valor: `${valorForm}`,
        }

        let params = {
            e2eId: `${endToEndId}`,
            id: `${res.loc.id}`,
        }

        efipay.pixDevolution(params, body)
            .then((resposta) => {
                return resposta
            })
            .catch((error) => {
                console.log(error)
            })

        const embed = new EmbedBuilder()
            .setAuthor({ name: `❌ Erro na compra!`, iconURL: interaction.guild.iconURL({}) })
            .setColor("Red")
            .setDescription(`Olá ${interaction.user}.\n- Notificamos que você está utilizando o banco **${banco}**.\n> Infelizmente, este banco está bloqueado em nossos registros pelos administradores do servidor.\n> Não se preocupe! Seu dinheiro já foi reembolsado. Se desejar adquirir o produto, por favor, utilize outro banco para realizar a compra.`)
            .setThumbnail(interaction.user.displayAvatarURL({}))
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setTimestamp();

        interaction.channel.send({ embeds: [embed], components: [] });

        const embeda = new EmbedBuilder()
            .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.user.displayAvatarURL({}) })
            .setColor("Red")
            .setDescription(`Olá ${interaction.user} 👋.\n- Seu carrinho foi fechado por ter um banco bloqueado nos registros!`)
            .setThumbnail(interaction.user.displayAvatarURL({}))
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setTimestamp();

        cliente.send({ embeds: [embeda] }).catch(() => { });

        if (dbc.get(`canais.sistema_carrinho`) === "ON") {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.guild.iconURL({}) })
                .setColor("Red")
                .setDescription(`- O usuário ${interaction.user} (${interaction.user.username}) teve o seu carrinho fechado por ter um banco bloqueado nos registros.`)
                .setThumbnail(interaction.user.displayAvatarURL({}))
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .setTimestamp();

            const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`));
            paumito.send({ embeds: [embed] });
        }

        setTimeout(() => {
            dc.set(`${interaction.channel.id}.status`, "banco_bloqueado")
            interaction.channel.delete()
        }, 1000 * 30);
    } catch (error) {
        console.error("Erro ao bloquear banco:", error);

        // Envia uma mensagem para o canal ou usuário avisando do erro, se necessário
        interaction.channel.send({
            content: "Ocorreu um erro ao tentar processar o bloqueio do banco. Por favor, tente novamente mais tarde."
        }).catch(console.error);
    }
}

async function bloquearBancoESales(interaction, doc, banco, Valortotal) {
    try {
        const painel = await dc.get(`${interaction.channel.id}.painel`);
        const pd = db.get(`${painel}`);
        const index = pd.produtos.findIndex(a => a.nome === dc.get(`${interaction.channel.id}.produto`));
        const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`));
        const produto = pdd;
        const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`));
        await deleteMessages(interaction);

        let valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toFixed(2).replace(',', '.');
        if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
            valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toFixed(2).replace(',', '.');
        }

        dbinfopag.set(`${interaction.channel.id}.id`, interaction.channel.id);
        dbinfopag.set(`${interaction.channel.id}.status`, "Recusado");
        dbinfopag.set(`${interaction.channel.id}.valor`, Number(valorForm));
        dbinfopag.set(`${interaction.channel.id}.banco`, banco);
        dbinfopag.set(`${interaction.channel.id}.produtoEntregue`, []);
        const cdd = dc.get(interaction.channel.id) || []
        console.log(doc)

        const EfiPay = require('sdk-node-apis-efi')
        const options = require("../schema/ESalesCredencias.js")
        const efipay = new EfiPay(options)

        const paramstxt = { txid: doc.txid };
        const res = await efipay.pixDetailCharge(paramstxt);
        const endToEndId = res.pix[0].endToEndId

        let body = {
            valor: `${valorForm}`,
        }

        let params = {
            e2eId: `${endToEndId}`,
            id: `${res.loc.id}`,
        }

        efipay.pixDevolution(params, body)
            .then((resposta) => {
            })
            .catch((error) => {
            })

        const embed = new EmbedBuilder()
            .setAuthor({ name: `❌ Erro na compra!`, iconURL: interaction.guild.iconURL({}) })
            .setColor("Red")
            .setDescription(`Olá ${interaction.user}.\n- Notificamos que você está utilizando o banco **${banco}**.\n> Infelizmente, este banco está bloqueado em nossos registros pelos administradores do servidor.\n> Não se preocupe! Seu dinheiro já foi reembolsado. Se desejar adquirir o produto, por favor, utilize outro banco para realizar a compra.`)
            .setThumbnail(interaction.user.displayAvatarURL({}))
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setTimestamp();

        interaction.channel.send({ embeds: [embed], components: [] });

        const embeda = new EmbedBuilder()
            .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.user.displayAvatarURL({}) })
            .setColor("Red")
            .setDescription(`Olá ${interaction.user} 👋.\n- Seu carrinho foi fechado por ter um banco bloqueado nos registros!`)
            .setThumbnail(interaction.user.displayAvatarURL({}))
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setTimestamp();

        cliente.send({ embeds: [embeda] }).catch(() => { });

        if (dbc.get(`canais.sistema_carrinho`) === "ON") {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.guild.iconURL({}) })
                .setColor("Red")
                .setDescription(`- O usuário ${interaction.user} (${interaction.user.username}) teve o seu carrinho fechado por ter um banco bloqueado nos registros.`)
                .setThumbnail(interaction.user.displayAvatarURL({}))
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .setTimestamp();

            const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`));
            paumito.send({ embeds: [embed] });
        }

        setTimeout(() => {
            dc.set(`${interaction.channel.id}.status`, "banco_bloqueado")
            interaction.channel.delete()
        }, 1000 * 30);
    } catch (error) {
        console.log(error);

        interaction.channel.send({
            content: "Contacte o suporte, aconteceu um error."
        }).catch(console.error);
    }
}

async function enviarProduto(interaction, doc, banco) {

    const painel = await dc.get(`${interaction.channel.id}.painel`)
    const carrinho = await dc.get(`${interaction.channel.id}`)
    const pd = db.get(`${painel}`)
    const index = pd.produtos.findIndex(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
    const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
    const produto = pdd
    const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`))
    await deleteMessages(interaction)

    let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
        valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
    }
    let valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toFixed(2).replace(',', '.');
    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
        valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toFixed(2).replace(',', '.');
    }
    if (pdd.estoque.length <= 0) {
        if (doc === "manual") {
            interaction.channel.send({ embeds: [], components: [], content: `${dbe.get("13")} | Produto sem estoque!` }).then(() => {
                setTimeout(() => {
                    interaction.channel.delete()
                }, 1 * 60000);
            })
            return
        }
        await refund.create({
            payment_id: doc.data.id,
            body: {}
        }).then(async () => {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `❌ Erro na compra!`, iconURL: cliente.displayAvatarURL({}) })
                .setColor("Red")
                .setTimestamp()
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .setDescription(`- A venda foi reembolsada porque faltou produtos para entregar!`)
                .addFields(
                    { name: `Usuário:`, value: `${cliente} (\`${cliente.user.username} - ${cliente.id}\`)` },
                    { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                    { name: `Valor Pago:`, value: `${valorTotal}`, inline: true },
                    { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                )
                .setThumbnail(interaction.guild.iconURL({}))

            const logspriv = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))

            if (logspriv) {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setStyle(2)
                            .setCustomId(`${doc.data.id}_${interaction.channel.id}_reembolsarproduto`)
                            .setLabel(`Reembolsar Compra (Ja foi reembolsado)`)
                            .setDisabled((true))
                            .setEmoji(dbep.get(`3`))
                    )
                await logspriv.send({ embeds: [embed], components: [row] })
            }
            const embedEnv = new EmbedBuilder()
                .setAuthor({ name: `❌ Erro na Compra!`, iconURL: interaction.user.displayAvatarURL({}) })
                .setColor("Red")
                .setTimestamp()
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .setDescription(`Olá ${cliente}.\n- O produto que você tentou comprar está esgotado. O valor total da sua compra foi reembolsado.`)
                .addFields(
                    { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                    { name: `Valor Total:`, value: `${valorTotal}`, inline: true },
                    { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                );

            interaction.channel.send({ content: ``, embeds: [embedEnv]})
            const embedsoli = new EmbedBuilder()
                .setAuthor({ name: `❌ Erro na compra!`, iconURL: interaction.user.displayAvatarURL({}) })
                .setColor("Red")
                .setTimestamp()
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .setDescription(`Olá ${cliente} 👋.\n- O estoque do produto que você tentou comprar acabou! O valor total foi reembolsado.`)
                .addFields(
                    { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                    { name: `Valor Total:`, value: `${valorTotal}`, inline: true },
                    { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                )
                .setThumbnail(interaction.guild.iconURL({}))

            cliente.send({ embeds: [embedsoli] })
            setTimeout(() => {
                interaction.channel.delete()
            }, 1000 * 30)

        })
        return;
    }
    let nmrentregas = Number(dc.get(`${interaction.channel.id}.quantidade`));

    const produtos = pd.produtos[index].estoque.splice(0, nmrentregas);
    const total = produtos.reduce((acc, item) => acc + item.length, 0);
    db.set(`${painel}`, pd);

    if (pd.produtos[index].estoque.length < nmrentregas) {
        faltou = true;
        quantos = nmrentregas - pd.produtos[index].estoque.length;


        while (produtos.length < nmrentregas) {
            produtos.push("Peça para um staff reembolsar você! Faltou produto.");
        }
    }
    let filed = `./entrega-${interaction.channel.id}.txt`;
    let txt = false
    if (produtos.length <= 5 && total < 1500) {
        filed = `${produtos.map((produto, index) => `${produto}`).join('\n')}`;
    } else {
        txt = true
        fs.writeFileSync(filed, `${produtos.join('\n')}`);
    }
    const roleClient = interaction.guild.roles.cache.get(dbc.get(`canais.cargo_cliente`))
    if (roleClient) {
        cliente.roles.add(roleClient).catch(a => { })
    }
    dbinfopag.set(`${interaction.channel.id}.id`, interaction.channel.id)
    dbinfopag.set(`${interaction.channel.id}.status`, "Aprovado");
    dbinfopag.set(`${interaction.channel.id}.valor`, Number(valorForm));
    dbinfopag.set(`${interaction.channel.id}.banco`, banco);
    dbinfopag.set(`${interaction.channel.id}.produtoEntregue`, produtos);

    const formatador = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });

    // Obtém a data atual no horário do Brasil
    const brasilDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const formattedDate = formatador.format(brasilDate);
    const valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(",", ".")
    dbr.add("pedidostotal", 1);
    dbr.add("gastostotal", valor);
    dbr.add(`${formattedDate}.pedidos`, 1);
    dbr.add(`${formattedDate}.recebimentos`, valor);

    dbru.add(`${cliente.id}.gastosaprovados`, valor);
    dbru.add(`${cliente.id}.pedidosaprovados`, `1`);

    dbrp.set(`${produto.nome}.idproduto`, `${produto.nome}`);
    dbrp.add(`${produto.nome}.vendasfeitas`, 1);
    dbrp.add(`${produto.nome}.valoresganhos`, valor);

    dbcp.set(`${cliente.id}.userid`, cliente.id);
    dbcp.add(`${cliente.id}.comprasrealizadas`, 1);
    dbcp.add(`${cliente.id}.valoresganhos`, valor);

    setTimeout(() => {
        if (produtos.length > 5 || total > 1500) {
            fs.unlink(filed, (err) => {
                if (err) {
                    console.error(`Erro ao apagar o arquivo: ${err}`);
                    return;
                }
            });
        }
    }, 1000 * 120);
    setTimeout(() => {
        interaction.channel.delete()
    }, 1000 * 30)
    const x = db.get(`${painel}`)
    await updateEspecifico(interaction, x)
    const embedPublic = new EmbedBuilder()
        .setAuthor({ name: `💸 Venda Aprovada`, iconURL: cliente.displayAvatarURL({}) })
        .setColor(dbc.get(`color`))
        .setTimestamp()
        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
        .setDescription(`O cliente \`${cliente.user.username}\` realizou uma compra!`)
        .addFields(
            { name: `Detalhes do carrinho:`, value: `\`${produto.nome} ${carrinho.quantidade}x | R$${await formatValor(valor)} \`` },
            { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> (<t:${~~(new Date() / 1000)}:R>)`, inline: false }
        )
    if (x.thumb) {
        embedPublic.setThumbnail(x.thumb)
    } else {
        embedPublic.setThumbnail(cliente.displayAvatarURL())
    }
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setStyle(5)
                .setLabel(`Comprar Produto`)
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${x.idchannel}/${x.idmsg}`)
        )

    const vendasPublic = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_public`))
    if (vendasPublic) {
        vendasPublic.send({ embeds: [embedPublic], components: [row] })
    }
    const embedentrega = new EmbedBuilder()
        .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
        .setColor(dbc.get("color"))
        .setTimestamp()
        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
        .setDescription(`Olá ${cliente} 👋\n- Seu carrinho foi aprovado com sucesso!`)
        .addFields(
            { name: `Detalhes do carrinho:`, value: `\`${carrinho.quantidade}x\` __${produto.nome}__ | R$${await formatValor(valor)}` },
            { name: `Entrega do pedido:`, value: `${txt === false ? `${filed}` : `**Todos os produtos estão em um arquivo acima.**`}` }
        )
        .setThumbnail(interaction.guild.iconURL({}));

        const rowPd = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(`${interaction.channel.id}_pedidos_mostrar`)
            .setStyle(1)
            .setLabel("Copiar Produto(s)")
            .setEmoji(dbep.get("13"))
        )
    const options = { embeds: [embedentrega], components: [rowPd] }
    if (produtos.length > 5 || total > 1500) options.files = [filed]
    await cliente.send(options).then(async (msg) => {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
            .setColor("Green")
            .setTimestamp()
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi aprovado!`)
            .addFields(
                { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
            )
            .setThumbnail(interaction.guild.iconURL({}))
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(5)
                    .setLabel(`Atalho para a DM`)
                    .setURL(msg.url)
            )
        await interaction.channel.send({ embeds: [embed], components: [row] })
        const channel = interaction.guild.channels.cache.get(dbc.get(`canais.feedback`))
        if (channel) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(5)
                        .setLabel(`Avaliar Compra`)
                        .setEmoji(dbe.get(`28`))
                        .setURL(channel.url)
                )
            setTimeout(async () => {
                await cliente.send({ content: `Olá ${cliente}, tudo certo com a compra? Se sim por favor, deixe uma avaliação por gentileza. 😚`, components: [row] }).catch(() => { })
                channel.send({ content: `${dbe.get(`28`)} | Prezado(a) ${cliente}, solicitamos que, por gentileza, avalie a sua compra.` }).then((msg) => {
                    setTimeout(() => { msg.delete() }, 1000 * 20)
                })
            }, 1000 * 60);
        }
        const logspriv = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))

        if (logspriv) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `🎉 Nova Venda!`, iconURL: cliente.displayAvatarURL({}) })
                .setColor(dbc.get("color"))
                .setTimestamp()
                .setDescription(`O carrinho de ${cliente} (${cliente.user.username}) foi aprovado! \n- Veja outras informações abaixo.`)
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .addFields(
                    { name: `Detalhes do carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                    { name: `Banco Usado:`, value: `\`${banco}\``, inline: true },
                    { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                )
                .setThumbnail(interaction.guild.iconURL({}))
            let row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(4)
                        .setCustomId(`${doc.data.id}_${interaction.channel.id}_reembolsarproduto`)
                        .setLabel(`Reembolsar Compra`)
                        .setEmoji(dbep.get(`3`))
                )
            if (doc === "manual") row = ""
            embedentrega.data.description = ''
            embedentrega.data.fields = [{ name: `Entrega do pedido:`, value: `${txt === false ? `${filed}` : `**Todos os produtos estão em um arquivo acima.**`}` }]
            const options = { embeds: [embed, embedentrega], components: [row] }
            if (produtos.length > 5 || total > 1500) options.files = [filed]
            await logspriv.send(options)
        }
    }).catch(async () => {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
            .setColor(dbc.get("color"))
            .setTimestamp()
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi aprovado!`)
            .addFields(
                { name: `Detalhes do carrinho:`, value: `\`${produto.nome} ${carrinho.quantidade}x | R$${await formatValor(valor)} \`` },
                { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
            )
            .setThumbnail(interaction.guild.iconURL({}))

        await interaction.channel.send({ embeds: [embed], content: `` })
        if (produtos.length > 5 || total > 1500) {
            await interaction.channel.send({ content: `**${dbe.get(`2`)} Como sua DM estava fechada, resolvi mandar o's produto's comprado's aqui mesmo.**\n- Lembre-se, o canal será fechado daqui a 2 minutos!` })
            await interaction.channel.send({ content: `${filed}` })
        } else {
            await interaction.channel.send({ content: `**${dbe.get(`2`)} Como sua DM estava fechada, resolvi mandar o's produto's comprado's aqui mesmo.**\n- Lembre-se, o canal será fechado daqui a 2 minutos!`, files: [filed] })
        }
    })
}


async function enviarProduto2(interaction, doc, banco) {

    const painel = await dc.get(`${interaction.channel.id}.painel`)
    const carrinho = await dc.get(`${interaction.channel.id}`)
    const pd = db.get(`${painel}`)
    const index = pd.produtos.findIndex(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
    const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
    const produto = pdd
    const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`))
    dc.set(`${interaction.channel.id}.loc`, doc.loc.id)
    dc.set(`${interaction.channel.id}.txid`, doc.txid)
    await deleteMessages(interaction)

    let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
        valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
    }
    let valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toFixed(2).replace(',', '.');
    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
        valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toFixed(2).replace(',', '.');
    }
    if (pdd.estoque.length <= 0) {
        if (doc === "manual") {
            interaction.channel.send({ embeds: [], components: [], content: `${dbe.get("13")} | Produto sem estoque!` }).then(() => {
                setTimeout(() => {
                    interaction.channel.delete()
                }, 1 * 60000);
            })
            return
        }
        const EfiPay = require('sdk-node-apis-efi')
        const options = require("../schema/credenciais.js")

        let body = {
            valor: `${valorTotal}`,
        }

        let params = {
            e2eId: `${doc.txid}`,
            id: `${doc.loc.id}`,
        }

        const efipay = new EfiPay(options)

        efipay.pixDevolution(params, body)
            .then((resposta) => {
                return resposta
            })
            .catch((error) => {
                console.log(error)
            }).then(async () => {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `❌ Erro na compra!`, iconURL: cliente.displayAvatarURL({}) })
                    .setColor("Red")
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                    .setDescription(`- A venda foi reembolsada porque faltou produtos para entregar!`)
                    .addFields(
                        { name: `Usuário:`, value: `${cliente} (\`${cliente.user.username} - ${cliente.id}\`)` },
                        { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                        { name: `Valor Pago:`, value: `${valorTotal}`, inline: true },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                    )
                    .setThumbnail(interaction.guild.iconURL({}))

                const logspriv = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))

                if (logspriv) {
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`${doc.data.id}_${interaction.channel.id}_reembolsarproduto`)
                                .setLabel(`Reembolsar Compra (Ja foi reembolsado)`)
                                .setDisabled((true))
                                .setEmoji(dbep.get(`3`))
                        )
                    await logspriv.send({ embeds: [embed], components: [row] })
                }
                const embedEnv = new EmbedBuilder()
                    .setAuthor({ name: `❌ Erro na Compra!`, iconURL: interaction.user.displayAvatarURL({}) })
                    .setColor("Red")
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                    .setDescription(`Olá ${cliente}.\n- O produto que você tentou comprar está esgotado. O valor total da sua compra foi reembolsado.`)
                    .addFields(
                        { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                        { name: `Valor Total:`, value: `${valorTotal}`, inline: true },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                    );

                interaction.channel.send({ content: ``, embeds: [embedEnv], ephemeral: true })
                const embedsoli = new EmbedBuilder()
                    .setAuthor({ name: `❌ Erro na compra!`, iconURL: interaction.user.displayAvatarURL({}) })
                    .setColor("Red")
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                    .setDescription(`Olá ${cliente} 👋.\n- O estoque do produto que você tentou comprar acabou! O valor total foi reembolsado.`)
                    .addFields(
                        { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                        { name: `Valor Total:`, value: `${valorTotal}`, inline: true },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                    )
                    .setThumbnail(interaction.guild.iconURL({}))

                cliente.send({ embeds: [embedsoli] })
                setTimeout(() => {
                    interaction.channel.delete()
                }, 1000 * 30)

            })
        return;
    }
    let nmrentregas = Number(dc.get(`${interaction.channel.id}.quantidade`));

    const produtos = pd.produtos[index].estoque.splice(0, nmrentregas);
    const total = produtos.reduce((acc, item) => acc + item.length, 0);
    db.set(`${painel}`, pd);

    if (pd.produtos[index].estoque.length < nmrentregas) {
        faltou = true;
        quantos = nmrentregas - pd.produtos[index].estoque.length;


        while (produtos.length < nmrentregas) {
            produtos.push("Peça para um staff reembolsar você! Faltou produto.");
        }
    }
    let filed = `./entrega-${interaction.channel.id}.txt`;
    let txt = false
    if (produtos.length <= 5 && total < 1500) {
        filed = `${produtos.map((produto, index) => `${produto}`).join('\n')}`;
    } else {
        txt = true
        fs.writeFileSync(filed, `${produtos.join('\n')}`);
    }
    const roleClient = interaction.guild.roles.cache.get(dbc.get(`canais.cargo_cliente`))
    if (roleClient) {
        cliente.roles.add(roleClient).catch(a => { })
    }
    dbinfopag.set(`${interaction.channel.id}.id`, interaction.channel.id)
    dbinfopag.set(`${interaction.channel.id}.status`, "Aprovado");
    dbinfopag.set(`${interaction.channel.id}.valor`, Number(valorForm));
    dbinfopag.set(`${interaction.channel.id}.banco`, banco);
    dbinfopag.set(`${interaction.channel.id}.produtoEntregue`, produtos);

    const formatador = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });

    // Obtém a data atual no horário do Brasil
    const brasilDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const formattedDate = formatador.format(brasilDate);
    const valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(",", ".")
    dbr.add("pedidostotal", 1);
    dbr.add("gastostotal", valor);
    dbr.add(`${formattedDate}.pedidos`, 1);
    dbr.add(`${formattedDate}.recebimentos`, valor);

    dbru.add(`${cliente.id}.gastosaprovados`, valor);
    dbru.add(`${cliente.id}.pedidosaprovados`, `1`);

    dbrp.set(`${produto.nome}.idproduto`, `${produto.nome}`);
    dbrp.add(`${produto.nome}.vendasfeitas`, 1);
    dbrp.add(`${produto.nome}.valoresganhos`, valor);

    dbcp.set(`${cliente.id}.userid`, cliente.id);
    dbcp.add(`${cliente.id}.comprasrealizadas`, 1);
    dbcp.add(`${cliente.id}.valoresganhos`, valor);

    setTimeout(() => {
        if (produtos.length > 5 || total > 1500) {
            fs.unlink(filed, (err) => {
                if (err) {
                    console.error(`Erro ao apagar o arquivo: ${err}`);
                    return;
                }
            });
        }
    }, 1000 * 120);
    setTimeout(() => {
        interaction.channel.delete()
    }, 1000 * 30)
    const x = db.get(`${painel}`)
    await updateEspecifico(interaction, x)
    const embedPublic = new EmbedBuilder()
        .setAuthor({ name: `💸 Venda Aprovada`, iconURL: cliente.displayAvatarURL({}) })
        .setColor(dbc.get(`color`))
        .setTimestamp()
        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
        .setDescription(`O cliente \`${cliente.user.username}\` realizou uma compra!`)
        .addFields(
            { name: `Detalhes do carrinho:`, value: `\`${produto.nome} ${carrinho.quantidade}x | R$${await formatValor(valor)} \`` },
            { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> (<t:${~~(new Date() / 1000)}:R>)`, inline: false }
        )
    if (x.thumb) {
        embedPublic.setThumbnail(x.thumb)
    } else {
        embedPublic.setThumbnail(cliente.displayAvatarURL())
    }
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setStyle(5)
                .setLabel(`Comprar Produto`)
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${x.idchannel}/${x.idmsg}`)
        )

    const vendasPublic = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_public`))
    if (vendasPublic) {
        vendasPublic.send({ embeds: [embedPublic], components: [row] })
    }
    const embedentrega = new EmbedBuilder()
        .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
        .setColor(dbc.get("color"))
        .setTimestamp()
        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
        .setDescription(`Olá ${cliente} 👋\n- Seu carrinho foi aprovado com sucesso!`)
        .addFields(
            { name: `Detalhes do carrinho:`, value: `\`${produto.nome} ${carrinho.quantidade}x | R$${await formatValor(valor)} \`` },
            { name: `Entrega do pedido:`, value: `${txt === false ? `${filed}` : `**Todos os produtos estão em um arquivo acima.**`}` }
        )
        .setThumbnail(interaction.guild.iconURL({}));
        const rowPd = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(`${interaction.channel.id}_pedidos_mostrar`)
            .setStyle(1)
            .setLabel("Copiar Produto(s)")
            .setEmoji(dbep.get("13"))
        )
        const options = { embeds: [embedentrega], components: [rowPd] }
    if (produtos.length > 5 || total > 1500) options.files = [filed]
    await cliente.send(options).then(async (msg) => {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
            .setColor(dbc.get("color"))
            .setTimestamp()
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi aprovado!`)
            .addFields(
                { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
            )
            .setThumbnail(interaction.guild.iconURL({}))
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(5)
                    .setLabel(`Atalho para a DM`)
                    .setURL(msg.url)
            )
        await interaction.channel.send({ embeds: [embed], components: [row] })
        const channel = interaction.guild.channels.cache.get(dbc.get(`canais.feedback`))
        if (channel) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(5)
                        .setLabel(`Avaliar Compra`)
                        .setEmoji(dbe.get(`28`))
                        .setURL(channel.url)
                )
            setTimeout(async () => {
                await cliente.send({ content: `Olá ${cliente}, tudo certo com a compra? Se sim por favor, deixe uma avaliação por gentileza. 😚`, components: [row] }).catch(() => { })
                channel.send({ content: `${dbe.get(`28`)} | Prezado(a) ${cliente}, solicitamos que, por gentileza, avalie a sua compra.` }).then((msg) => {
                    setTimeout(() => { msg.delete() }, 1000 * 20)
                })
            }, 1000 * 60);
        }
        const logspriv = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))

        if (logspriv) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `🎉 Nova Venda!`, iconURL: cliente.displayAvatarURL({}) })
                .setColor(dbc.get("color"))
                .setTimestamp()
                .setDescription(`O carrinho de ${cliente} (${cliente.user.username}) foi aprovado! \n- Veja outras informações abaixo.`)
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .addFields(
                    { name: `Detalhes do carrinho:`, value: `\`${produto.nome} ${carrinho.quantidade}x | R$${await formatValor(valor)} \`` },
                    { name: `Banco Usado:`, value: `\`${banco}\``, inline: true },
                    { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                )
                .setThumbnail(interaction.guild.iconURL({}))

            const options2 = require("../schema/credenciais.js");

            const efipay = new EfiPay(options2);

            const params = { txid: doc.txid };
            const res = await efipay.pixDetailCharge(params);
            const endToEndId = res.pix[0].endToEndId


            let row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(4)
                        .setCustomId(`${endToEndId}_${interaction.channel.id}_efibankreembolso`)
                        .setLabel(`Reembolsar Compra`)
                        .setEmoji(dbep.get(`3`))
                )
            if (doc === "manual") row = ""
            embedentrega.data.description = ''
            embedentrega.data.fields = [{ name: `Entrega do pedido:`, value: `${txt === false ? `${filed}` : `**Todos os produtos estão em um arquivo acima.**`}` }]
            const options = { embeds: [embed, embedentrega], components: [row] }
            if (produtos.length > 5 || total > 1500) options.files = [filed]
            await logspriv.send(options)
        }
    }).catch(async (err) => {
        console.log(err)
        const embed = new EmbedBuilder()
            .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
            .setColor(dbc.get("color"))
            .setTimestamp()
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi aprovado!`)
            .addFields(
                { name: `Detalhes do carrinho:`, value: `\`${produto.nome} ${carrinho.quantidade}x | R$${await formatValor(valor)} \`` },
                { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
            )
            .setThumbnail(interaction.guild.iconURL({}))

        await interaction.channel.send({ embeds: [embed], content: `` })
        if (produtos.length > 5 || total > 1500) {
            await interaction.channel.send({ content: `**${dbe.get(`2`)} Como sua DM estava fechada, resolvi mandar o's produto's comprado's aqui mesmo.**\n- Lembre-se, o canal será fechado daqui a 2 minutos!` })
            await interaction.channel.send({ content: `${filed}` })
        } else {
            await interaction.channel.send({ content: `**${dbe.get(`2`)} Como sua DM estava fechada, resolvi mandar o's produto's comprado's aqui mesmo.**\n- Lembre-se, o canal será fechado daqui a 2 minutos!`, files: [filed] })
        }
    })
}

async function enviarProdutoEsales(interaction, doc, banco) {

    const painel = await dc.get(`${interaction.channel.id}.painel`)
    const carrinho = await dc.get(`${interaction.channel.id}`)
    const pd = db.get(`${painel}`)
    const index = pd.produtos.findIndex(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
    const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
    const produto = pdd
    const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`))
    dc.set(`${interaction.channel.id}.loc`, doc.loc.id)
    dc.set(`${interaction.channel.id}.txid`, doc.txid)
    await deleteMessages(interaction)

    let valorTotal2 = produto.preco * dc.get(`${interaction.channel.id}.quantidade`);
    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
        valorTotal2 *= (1 - dc.get(`${interaction.channel.id}.desconto`) / 100);
    }



    let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
        valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
    }
    let valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toFixed(2).replace(',', '.');
    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
        valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toFixed(2).replace(',', '.');
    }
    await dbs.add("saldo", Number(valorForm).toFixed(2))

    if (pdd.estoque.length <= 0) {
        if (doc === "manual") {
            interaction.channel.send({ embeds: [], components: [], content: `${dbe.get("13")} | Produto sem estoque!` }).then(() => {
                setTimeout(() => {
                    interaction.channel.delete()
                }, 1 * 60000);
            })
            return
        }
        const EfiPay = require('sdk-node-apis-efi')
        const options = require("../schema/ESalesCredencias.js")
        const efipay = new EfiPay(options);
        const params2 = { txid: doc.txid };
        const res = await efipay.pixDetailCharge(params2);
        const endToEndId = res.pix[0].endToEndId

        let body = {
            valor: `${valorTotal}`,
        }

        let params = {
            e2eId: `${endToEndId}`,
            id: `${res.loc.id}`,
        }

        efipay.pixDevolution(params, body)
            .then((resposta) => {
                return resposta
            })
            .catch((error) => {
                console.log(error)
            }).then(async () => {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `❌ Erro na compra!`, iconURL: cliente.displayAvatarURL({}) })
                    .setColor("Red")
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                    .setDescription(`- A venda foi reembolsada porque faltou produtos para entregar!`)
                    .addFields(
                        { name: `Usuário:`, value: `${cliente} (\`${cliente.user.username} - ${cliente.id}\`)` },
                        { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                        { name: `Valor Pago:`, value: `${valorTotal}`, inline: true },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                    )
                    .setThumbnail(interaction.guild.iconURL({}))

                const logspriv = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))

                if (logspriv) {
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`${doc.data.id}_${interaction.channel.id}_reembolsarproduto`)
                                .setLabel(`Reembolsar Compra (Ja foi reembolsado)`)
                                .setDisabled((true))
                                .setEmoji(dbep.get(`3`))
                        )
                    await logspriv.send({ embeds: [embed], components: [row] })
                }
                const embedEnv = new EmbedBuilder()
                    .setAuthor({ name: `❌ Erro na Compra!`, iconURL: interaction.user.displayAvatarURL({}) })
                    .setColor("Red")
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                    .setDescription(`Olá ${cliente}.\n- O produto que você tentou comprar está esgotado. O valor total da sua compra foi reembolsado.`)
                    .addFields(
                        { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                        { name: `Valor Total:`, value: `${valorTotal}`, inline: true },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                    );

                interaction.channel.send({ content: ``, embeds: [embedEnv]})
                const embedsoli = new EmbedBuilder()
                    .setAuthor({ name: `❌ Erro na compra!`, iconURL: interaction.user.displayAvatarURL({}) })
                    .setColor("Red")
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                    .setDescription(`Olá ${cliente} 👋.\n- O estoque do produto que você tentou comprar acabou! O valor total foi reembolsado.`)
                    .addFields(
                        { name: `Produto:`, value: `${pdd.nome} \`x${dc.get(`${interaction.channel.id}.quantidade`)}\``, inline: true },
                        { name: `Valor Total:`, value: `${valorTotal}`, inline: true },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                    )
                    .setThumbnail(interaction.guild.iconURL({}))

                cliente.send({ embeds: [embedsoli] })
                setTimeout(() => {
                    interaction.channel.delete()
                }, 1000 * 30)

            })
        return;
    }
    let nmrentregas = Number(dc.get(`${interaction.channel.id}.quantidade`));

    const produtos = pd.produtos[index].estoque.splice(0, nmrentregas);
    const total = produtos.reduce((acc, item) => acc + item.length, 0);
    db.set(`${painel}`, pd);

    if (pd.produtos[index].estoque.length < nmrentregas) {
        faltou = true;
        quantos = nmrentregas - pd.produtos[index].estoque.length;


        while (produtos.length < nmrentregas) {
            produtos.push("Peça para um staff reembolsar você! Faltou produto.");
        }
    }
    let filed = `./entrega-${interaction.channel.id}.txt`;
    let txt = false
    if (produtos.length <= 5 && total < 1500) {
        filed = `${produtos.map((produto, index) => `${produto}`).join('\n')}`;
    } else {
        txt = true
        fs.writeFileSync(filed, `${produtos.join('\n')}`);
    }
    const roleClient = interaction.guild.roles.cache.get(dbc.get(`canais.cargo_cliente`))
    if (roleClient) {
        cliente.roles.add(roleClient).catch(a => { })
    }
    dbinfopag.set(`${interaction.channel.id}.id`, interaction.channel.id)
    dbinfopag.set(`${interaction.channel.id}.status`, "Aprovado");
    dbinfopag.set(`${interaction.channel.id}.valor`, Number(valorForm));
    dbinfopag.set(`${interaction.channel.id}.banco`, banco);
    dbinfopag.set(`${interaction.channel.id}.produtoEntregue`, produtos);

    const formatador = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });

    // Obtém a data atual no horário do Brasil
    const brasilDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const formattedDate = formatador.format(brasilDate);
    const valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(",", ".")
    dbr.add("pedidostotal", 1);
    dbr.add("gastostotal", valor);
    dbr.add(`${formattedDate}.pedidos`, 1);
    dbr.add(`${formattedDate}.recebimentos`, valor);

    dbru.add(`${cliente.id}.gastosaprovados`, valor);
    dbru.add(`${cliente.id}.pedidosaprovados`, `1`);

    dbrp.set(`${produto.nome}.idproduto`, `${produto.nome}`);
    dbrp.add(`${produto.nome}.vendasfeitas`, 1);
    dbrp.add(`${produto.nome}.valoresganhos`, valor);

    dbcp.set(`${cliente.id}.userid`, cliente.id);
    dbcp.add(`${cliente.id}.comprasrealizadas`, 1);
    dbcp.add(`${cliente.id}.valoresganhos`, valor);

    setTimeout(() => {
        if (produtos.length > 5 || total > 1500) {
            fs.unlink(filed, (err) => {
                if (err) {
                    console.error(`Erro ao apagar o arquivo: ${err}`);
                    return;
                }
            });
        }
    }, 1000 * 120);
    setTimeout(() => {
        interaction.channel.delete()
    }, 1000 * 30)
    const x = db.get(`${painel}`)
    await updateEspecifico(interaction, x)
    const embedPublic = new EmbedBuilder()
        .setAuthor({ name: `💸 Venda Aprovada`, iconURL: cliente.displayAvatarURL({}) })
        .setColor(dbc.get(`color`))
        .setTimestamp()
        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
        .setDescription(`O cliente \`${cliente.user.username}\` realizou uma compra!`)
        .addFields(
            { name: `Detalhes do carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | R$${await formatValor(valor)} ` },
            { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> (<t:${~~(new Date() / 1000)}:R>)`, inline: false }
        )
    if (x.thumb) {
        embedPublic.setThumbnail(x.thumb)
    } else {
        embedPublic.setThumbnail(cliente.displayAvatarURL())
    }
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setStyle(5)
                .setLabel(`Comprar Produto`)
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${x.idchannel}/${x.idmsg}`)
        )

    const vendasPublic = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_public`))
    if (vendasPublic) {
        vendasPublic.send({ embeds: [embedPublic], components: [row] })
    }
    const embedentrega = new EmbedBuilder()
        .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
        .setColor(dbc.get("color"))
        .setTimestamp()
        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
        .setDescription(`Olá ${cliente} 👋\n- **Seu carrinho foi aprovado com sucesso!**\n-# **Esta venda foi feita através do sistema eSales, em casos de problemas ou golpes com esse sistema, por favor, entre em contato com o Suporte [clicando aqui](https://zendapplications.com) **`)
        .addFields(
            { name: `Detalhes do carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
            { name: `Entrega do pedido:`, value: `${txt === false ? `${filed}` : `**Todos os produtos estão em um arquivo acima.**`}` }
        )
        .setThumbnail(interaction.guild.iconURL({}));
        const rowPd = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(`${interaction.channel.id}_pedidos_mostrar`)
            .setStyle(1)
            .setLabel("Copiar Produto(s)")
            .setEmoji(dbep.get("13"))
        )
        const options = { embeds: [embedentrega], components: [rowPd] }
    if (produtos.length > 5 || total > 1500) options.files = [filed]
    await cliente.send(options).then(async (msg) => {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
            .setColor("Green")
            .setTimestamp()
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi aprovado!`)
            .addFields(
                { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
            )
            .setThumbnail(interaction.guild.iconURL({}))
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(5)
                    .setLabel(`Atalho para a DM`)
                    .setURL(msg.url)
            )
        await interaction.channel.send({ embeds: [embed], components: [row] })
        const channel = interaction.guild.channels.cache.get(dbc.get(`canais.feedback`))
        if (channel) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(5)
                        .setLabel(`Avaliar Compra`)
                        .setEmoji(dbe.get(`28`))
                        .setURL(channel.url)
                )
            setTimeout(async () => {
                await cliente.send({ content: `Olá ${cliente}, tudo certo com a compra? Se sim por favor, deixe uma avaliação por gentileza. 😚`, components: [row] }).catch(() => { })
                channel.send({ content: `${dbe.get(`28`)} | Prezado(a) ${cliente}, solicitamos que, por gentileza, avalie a sua compra.` }).then((msg) => {
                    setTimeout(() => { msg.delete() }, 1000 * 20)
                })
            }, 1000 * 60);
        }

        const logspriv = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))


        if (logspriv) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `🎉 Nova Venda!`, iconURL: cliente.displayAvatarURL({}) })
                .setColor(dbc.get("color"))
                .setTimestamp()
                .setDescription(`O carrinho de ${cliente} (${cliente.user.username}) foi aprovado! \n- Veja outras informações abaixo.`)
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .addFields(
                    { name: `Detalhes do carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                    { name: `Banco Usado:`, value: `\`${banco}\``, inline: true },
                    { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
                )
                .setThumbnail(interaction.guild.iconURL({}))

            const options2 = require("../schema/ESalesCredencias.js")
            const efipay = new EfiPay(options2);
            const params = { txid: doc.txid };
            const res = await efipay.pixDetailCharge(params);
            const endToEndId = res.pix[0].endToEndId


            if (doc === "manual") row = ""
            embedentrega.data.description = ''
            embedentrega.data.fields = [{ name: `Entrega do pedido:`, value: `${txt === false ? `${filed}` : `**Todos os produtos estão em um arquivo acima.**`}` }]
            const options = { embeds: [embed, embedentrega], components: [] }
            if (produtos.length > 5 || total > 1500) options.files = [filed]
            await logspriv.send(options)
        }
    }).catch(async (err) => {
        console.log(err)
        const embed = new EmbedBuilder()
            .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
            .setColor(dbc.get("color"))
            .setTimestamp()
            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
            .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi aprovado!`)
            .addFields(
                { name: `Detalhes do carrinho:`, value: `\`${produto.nome} ${carrinho.quantidade}x | R$${await formatValor(valor)} \`` },
                { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline: true }
            )
            .setThumbnail(interaction.guild.iconURL({}))

        await interaction.channel.send({ embeds: [embed], content: `` })
        if (produtos.length > 5 || total > 1500) {
            await interaction.channel.send({ content: `**${dbe.get(`2`)} Como sua DM estava fechada, resolvi mandar o's produto's comprado's aqui mesmo.**\n- Lembre-se, o canal será fechado daqui a 2 minutos!` })
            await interaction.channel.send({ content: `${filed}` })
        } else {
            await interaction.channel.send({ content: `**${dbe.get(`2`)} Como sua DM estava fechada, resolvi mandar o's produto's comprado's aqui mesmo.**\n- Lembre-se, o canal será fechado daqui a 2 minutos!`, files: [filed] })
        }
    })
}

module.exports = {
    bloquearBanco,
    enviarProduto,
    enviarProduto2,
    deleteMessages,
    bloquearBancoEfi,
    enviarProdutoEsales,
    bloquearBancoESales
}