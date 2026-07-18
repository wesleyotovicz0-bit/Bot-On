const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, Attachment, AttachmentBuilder} = require("discord.js")
const { JsonDatabase } = require("wio.db")
const dbe = new JsonDatabase({ databasePath: "./json/emojis.json"})
const dc = new JsonDatabase({ databasePath: "./json/carrinho.json"})
const dbc = new JsonDatabase({ databasePath: "./json/botconfig.json"})
const dbp = new JsonDatabase({ databasePath: "./json/personalizados.json"})
const dbs = new JsonDatabase({ databasePath: "./json/saldo.json"})
const dbcg = new JsonDatabase({ databasePath: "./json/configGlob.json"})
const db = new JsonDatabase({ databasePath: "./json/produtos.json"})
const dbr = new JsonDatabase({ databasePath: "./json/rendimentos.json"})
const dbru = new JsonDatabase({ databasePath: "./json/rankUsers.json"})
const DbSaldo = new JsonDatabase({ databasePath: "./json/cupons.json" })
const dbrp = new JsonDatabase({ databasePath: "./json/rankProdutos.json"})
const dbinfopag = new JsonDatabase({ databasePath: "./json/infoPagamento.json" })
const dbcp = new JsonDatabase({ databasePath: "./json/perfil.json"})
const fs = require("fs")
const Discord = require("discord.js")
const moment = require("moment")
moment.locale("pt-br");
const dbep = new JsonDatabase({ databasePath: "./json/emojisGlob.json"})
const { updateEspecifico, sendMessage } = require("../../Functions/UpdateMessageBuy")
const { bloquearBanco, enviarProduto, deleteMessages } = require("../../Functions/CarrinhoAprovado")

module.exports = {
    name: "interactionCreate",
    run: async (interaction, client) => {
        async function formatValor(valor) {
            return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        }
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId.endsWith("_continuar")) {
                const painel = await dc.get(`${interaction.channel.id}.painel`)
                const pd = db.get(`${painel}`)
                const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
                const produto = pdd
                let valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`))
                if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                    valor = `${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100))}`
                }

                if (valor > produto.condições.valormaximo) {
                    return interaction.reply({ content: `${dbe.get(`13`)} | Valor máximo de **R$${Number(produto.condições.valormaximo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** atingido! Escolha menos produtos.`, ephemeral:true})
                }
                if (valor < produto.condições.valorminimo) {
                    return interaction.reply({ content: `${dbe.get(`13`)} | Valor mínimo de **R$${Number(produto.condições.valorminimo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** atingido! Escolha mais produtos.`, ephemeral:true})
                }
                
                let emjpix = dbep.get(`39`)
                let emjpay = dbep.get(`40`)
                let emjvol = dbep.get(`29`)
                const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                    .setStyle(2)
                    .setCustomId(`${interaction.channel.id}_pagarpix`)
                    .setLabel(`Pix`)
                    .setEmoji(emjpix),
                    new ButtonBuilder()
                    .setStyle(2)
                    .setCustomId(`${interaction.channel.id}_paypal`)
                    .setLabel(`PayPal`)
                    .setDisabled(true)
                    .setEmoji(emjpay),
                    new ButtonBuilder()
                    .setStyle(1)
                    .setCustomId(`${interaction.channel.id}_carrinhovoltar`)
                    .setLabel(`Voltar`)
                    .setEmoji(emjvol)
                )
                interaction.update({ embeds: [], content: `Escolha qual a forma de pagamento.`, components: [row]})
            }
            if (customId.endsWith("_aprovarpedido")) {
                const painel = await dc.get(`${interaction.channel.id}.painel`)
                const pd = db.get(`${painel}`)
                const index = pd.produtos.findIndex(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
                const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
                const produto = pdd
                const carrinho = await dc.get(`${interaction.channel.id}`)
                const userId = await interaction.user;
                const user = await interaction.guild.members.cache.get(userId.id)
                const rolevery = user.roles.cache.has(dbc.get(`canais.cargo_staff`))
                if (!rolevery) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Você não tem permissão para mexer aqui!`, ephemeral:true})
                    return;
                }

                await interaction.channel.bulkDelete(5)
                let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                    valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
                }
                let valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toFixed(2).replace(',', '.');
                if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                    valorForm = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toFixed(2).replace(',', '.');
                }
                if (pdd.estoque.length <= 0) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Peça para um staff reembolsa-lo! O estoque do produto que você deseja comprar acabou.`, ephemeral:true})
                    return;
                }

                let nmrentregas = Number(dc.get(`${interaction.channel.id}.quantidade`));
                let faltou = false;
                let quantos = 0;
                
                const produtos = pd.produtos[index].estoque.splice(0, nmrentregas);
                const total = produtos.reduce((acc, item) => acc + item.length, 0);
                db.set(`${painel}`, pd);
                
                if (pd.produtos[index].estoque.length < nmrentregas) {
                    faltou = true;
                    quantos = nmrentregas - pd.produtos[index].estoque.length;
                    
                    while (produtos.length < nmrentregas) {
                        produtos.push("Faltou Produto! Peça reembolso para o adm!");
                    }
                }
                
                if (total > 1500) {
                    fs.writeFile(`./entrega-${interaction.channel.id}.txt`, `${produtos.map((produto, index) => `- ${produto}`).join('\n')}`, (err) => {
                        if (err) throw err;
                    })
                } 
                let filed = `./entrega-${interaction.channel.id}.txt`;
                const roleClient = interaction.guild.roles.cache.get(dbc.get(`canais.cargo_cliente`))
                const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`)) 
                if (roleClient) {
                    cliente.roles.add(roleClient).catch(a => {})
                }

                dbr.add("pedidostotal", 1)
                dbr.add("gastostotal", Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)))
                dbr.add(`${moment().format('L')}.pedidos`, 1)
                dbr.add(`${moment().format('L')}.recebimentos`, Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)))
                
                dbru.add(`${cliente.id}.gastosaprovados`, Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)))
                dbru.add(`${cliente.id}.pedidosaprovados`, `1`)

                dbrp.set(`${produto.nome}.idproduto`, `${produto.nome}`)
                dbrp.add(`${produto.nome}.vendasfeitas`, 1)
                dbrp.add(`${produto.nome}.valoresganhos`, Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)))

                dbcp.set(`${cliente.id}.userid`, cliente.id);
                dbcp.add(`${cliente.id}.comprasrealizadas`, 1);
                dbcp.add(`${cliente.id}.valoresganhos`, Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`))); 

                dbinfopag.set(`${interaction.channel.id}.id`, interaction.channel.id)
                dbinfopag.set(`${interaction.channel.id}.status`, "Aprovado");
                dbinfopag.set(`${interaction.channel.id}.valor`, Number(valorForm));
                dbinfopag.set(`${interaction.channel.id}.banco`, "Aprovado manualmente usando o sistema semiauto.");
                dbinfopag.set(`${interaction.channel.id}.produtoEntregue`, produtos);

                let txt = false
                if (total < 1500) {
                    filed = `${produtos.map((produto, index) => `${produto}`).join('\n')}`;               
                } else txt = true
                setTimeout(() => {
                    interaction.channel.delete()
                    if (total > 1500) {
                        fs.unlink(filed, (err) => {
                            if (err) {
                                console.error(`Erro ao apagar o arquivo: ${err}`);
                            return;
                            }
                        });
                    }
                }, 1000 * 120);
                
                const embedentrega = new EmbedBuilder()
                .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
                .setColor(dbc.get("color"))
                .setTimestamp()
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .setDescription(`Olá ${cliente} 👋\n- Seu carrinho foi aprovado com sucesso!`)
                .addFields(
                    { name: `Detalhes do carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                    { name: `Entrega do pedido:`, value: `${txt === false ? `${filed}` : `**Todos os produtos estão em um arquivo acima.**`}` }
                )
                .setThumbnail(interaction.guild.iconURL({}));
                await cliente.send({ embeds: [embedentrega], components: []}).then(async(msg) => {
                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `✅ Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({}) })
                    .setColor(dbc.get("color"))
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                    .setDescription(`Olá ${cliente} 👋\n- Seu carrinho foi aprovado com sucesso!`)
                    .addFields(
                        { name: `Detalhes do carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` }
                    )
                    .setThumbnail(interaction.guild.iconURL({}));
                    const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                        .setStyle(5)
                        .setLabel(`Atalho para a DM`)
                        .setURL(msg.url)
                    )
                    await interaction.channel.send({ embeds: [embed], components: [row]})
                    if (total < 1500) {
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
                            await cliente.send({ components: [row]})
                            channel.send({ content: `${dbe.get(`28`)} | ${cliente}, avalie a sua compra por gentileza!`}).then((msg) => {
                                setTimeout(() => { msg.delete() }, 1000 * 10)
                            })
                        }
                    } else {
                        await cliente.send({ files: [filed] })
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
                            await cliente.send({ components: [row]})
                            channel.send({ content: `${dbe.get(`28`)} | ${cliente}, avalie a sua compra por gentileza!`}).then((msg) => {
                                setTimeout(() => { msg.delete() }, 1000 * 10)
                            })
                        }
                    }
                }).catch(async() => {
                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `🛒 Carrinho aprovado!`, iconURL: cliente.displayAvatarURL({})})
                    .setColor()
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                    .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi aprovado!`)
                    .addFields(
                        { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline:true }
                    )
                    .setThumbnail(interaction.guild.iconURL({}))
                    await interaction.channel.send({ embeds: [embed]})
                    if (total < 1500) {
                        await interaction.channel.send({ content: `**${dbe.get(`2`)} Como sua DM estava fechada, resolvi mandar o's produto's comprado's aqui mesmo.**\n- Lembre-se, o canal será fechado daqui a 2 minutos!`})
                        await interaction.channel.send({ content: `${filed}`})
                    } else {
                        await interaction.channel.send({ content: `**${dbe.get(`2`)} Como sua DM estava fechada, resolvi mandar o's produto's comprado's aqui mesmo.**\n- Lembre-se, o canal será fechado daqui a 2 minutos!`, files: [filed]})
                    }
                })
                if (total < 1500) {
                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `🎉 Nova Venda!`, iconURL: cliente.displayAvatarURL({})})
                    .setColor(dbc.get("color"))
                    .setTimestamp()
                    .setDescription(`O carrinho de ${cliente} (${cliente.user.username}) foi aprovado! \n- Veja outras informações abaixo.`)
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                    .addFields(
                        { name: `Detalhes do carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                        { name: `Banco Usado:`, value: `\`Aprovado manualmente.\``, inline:true },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline:true }
                    )
                    .setThumbnail(interaction.guild.iconURL({}))
                    
                    const embed2 = new EmbedBuilder()
                    .setAuthor({ name: `📦 Produtos entregues:`, iconURL: cliente.displayAvatarURL({}) })
                    .setColor(dbc.get("color"))
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                    .setDescription(`${filed}`)
                    .setThumbnail(cliente.displayAvatarURL());
                    const logspriv = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))

                    if (logspriv) {
                        await logspriv.send({ embeds: [embed, embed2]})
                    }
                } else {
                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `🎉 Nova Venda!`, iconURL: cliente.displayAvatarURL({})})
                    .setColor(dbc.get("color"))
                    .setTimestamp()
                    .setDescription(`O carrinho de ${cliente} (${cliente.user.username}) foi aprovado! \n- Veja outras informações abaixo.`)
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                    .addFields(
                        { name: `Detalhes do carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                        { name: `Banco Usado:`, value: `\`Aprovado manualmente.\``, inline:true },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> \n(<t:${~~(new Date() / 1000)}:R>)`, inline:true }
                    )
                    .setThumbnail(interaction.guild.iconURL({}))

                    const embed2 = new EmbedBuilder()
                    .setAuthor({ name: `📦 Produtos entregues:`, iconURL: cliente.displayAvatarURL({}) })
                    .setColor(dbc.get("color"))
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                    .setDescription(`**Todos os produtos estão em um arquivo acima.**`)
                    .setThumbnail(cliente.displayAvatarURL());
                    const logspriv = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))

                    if (logspriv) {
                        await logspriv.send({ embeds: [embed, embed2], files: [filed]})
                    }
                }
                dc.set(`${interaction.channel.id}.status`, "aprovado")

                const x = db.get(`${painel}`)
                const channel = interaction.guild.channels.cache.get(x.idchannel)
                const embedPublic = new EmbedBuilder()
                .setAuthor({ name: `💸 Venda Aprovada`, iconURL: cliente.displayAvatarURL({})})
                .setColor(dbc.get(`color`))
                .setTimestamp()
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                .setDescription(`O cliente \`${cliente.user.username}\` realizou uma compra!`)
                .addFields(
                    { name: `Detalhes do carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                    { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> (<t:${~~(new Date() / 1000)}:R>)`, inline:false }
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
                    vendasPublic.send({ embeds: [embedPublic], components: [row]})
                }
                updateEspecifico(interaction, x)
            }
            if (customId.endsWith("_mostrarchave")) {
                interaction.reply({ content: `${dbc.get(`pagamentos.semiauto.chave`) ? `**Tipo da chave:** ${dbc.get(`pagamentos.semiauto.tipo`)} - **Chave:** \n\`\`\`${dbc.get(`pagamentos.semiauto.chave`)}\`\`\``: "Chave não definida! Chame o ADM e peça a chave pix dele."}`, ephemeral:true})
            }
            if (customId.endsWith("_mostrarqrcode")) {
                const fs = require('fs');
                const filePath = './Imagens/pagamentos/qrcode.png';
                
                if (fs.existsSync(filePath)) { // Verifica se o arquivo existe
                    interaction.reply({
                        files: [filePath], // Anexa a imagem local
                        ephemeral: true
                    });
                } else {
                    interaction.reply({
                        content: `Não tem QR Code! Peça para um **ADM** fornecer um.`,
                        ephemeral: true
                    });
                }
                
            }
            if (customId.endsWith("_carrinhovoltar")) {
                const painel = await dc.get(`${interaction.channel.id}.painel`)
                const pd = db.get(`${painel}`)
                const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
                const produto = pdd
                let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                    valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
                }
                const embed = new EmbedBuilder()
                .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({})})
                .setColor(dbc.get(`color`))
                .setTimestamp()
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                .setDescription(`Olá ${interaction.user} 👋.\n- Gerencie a sua compra do produto **${produto.nome}** como desejar.`)
                .addFields(
                    { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                    { name: `Valor Unidade:`, value: `R$${Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline:true },
                    { name: `Estoque:`, value: `${produto.estoque.length}`, inline:true },
                )
                .setThumbnail(interaction.guild.iconURL({}))
                let emjdin = dbep.get(`9`)
                let emjlap = dbep.get(`1`)
                let emjeti = dbep.get(`14`)
                let emjcan = dbep.get(`37`)

                const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                    .setStyle(3)
                    .setCustomId(`${interaction.channel.id}_continuar`)
                    .setLabel(`Continuar`)
                    .setEmoji(emjdin),
                    new ButtonBuilder()
                    .setStyle(2)
                    .setCustomId(`${interaction.channel.id}_editarqtd`)
                    .setLabel(`Editar Quantidade`)
                    .setEmoji(emjlap),
                    new ButtonBuilder()
                    .setStyle(1)
                    .setCustomId(`${interaction.channel.id}_addcumpom`)
                    .setLabel(`Usar Cupom`)
                    .setDisabled(dc.get(`${interaction.channel.id}.cupom`) === "nenhum" ? false : true)
                    .setEmoji(emjeti),
                    new ButtonBuilder()
                    .setStyle(4)
                    .setCustomId(`${interaction.channel.id}_cancelarcarrinho`)
                    .setLabel(`Fechar`)
                    .setEmoji(emjcan)
                )
                await interaction.update({ content: "", embeds: [embed], components: [row]})
            }
            if (customId.endsWith("_editarqtd")) {
                const modal = new ModalBuilder()
                .setCustomId(`carrinho_mudarqtd`)
                .setTitle(`Mudar Quantidade`)
                .addComponents(
                    new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                        .setCustomId("text")
                        .setLabel(`Quantidade`)
                        .setPlaceholder(`Escreva aqui a quantidade de produtos que você deseja comprar.`)
                        .setStyle(1)
                    )
                )
                interaction.showModal(modal)
            }
            if (customId.endsWith("_addcumpom")) {
                const modal = new ModalBuilder()
                .setCustomId(`carrinho_addcupom`)
                .setTitle(`Usar Cupom`)
                .addComponents(
                    new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                        .setCustomId("text")
                        .setLabel(`Cupom`)
                        .setPlaceholder(`Escreva aqui o nome do cupom.`)
                        .setStyle(1)
                    )
                )
                interaction.showModal(modal)
            }
            if (customId.endsWith("_cancelarcarrinho")) {
                if (dc.get(`${interaction.channel.id}.status`) === "esperando2") {
                    dc.set(`${interaction.channel.id}.status`, "cancelado")
                    interaction.channel.delete()
    
                    const cliente = interaction.guild.members.cache.get(dc.get(`${interaction.channel.id}.user`))
    
                    if (cliente) {
                        if (dbc.get(`canais.sistema_carrinho`) === "ON") {
                            const embed = new EmbedBuilder()
                                .setAuthor({ name: `❌ Carrinho fechado!`, iconURL: interaction.guild.iconURL({}) })
                                .setColor("Red")
                                .setDescription(`- O usuário ${cliente} (${cliente.user.username}) teve o seu carrinho fechado.`)
                                .setThumbnail(cliente.user.displayAvatarURL({}))
                                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                                .setTimestamp()
                            const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
                            paumito.send({ embeds: [embed] }).catch(() => {})
                        }
                        const embeda = new EmbedBuilder()
                        .setAuthor({ name: `❌ Carrinho Fechado`, iconURL: cliente.user.displayAvatarURL({}) })
                        .setColor("Red")
                        .setDescription(`Olá ${cliente} 👋.\n- Seu carrinho foi fechado.`)
                        .setThumbnail(cliente.user.displayAvatarURL({}))
                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                        .setTimestamp()
    
                        cliente.send({ embeds: [embeda] }).catch(() => {})
                    }
                } else {
                    dc.set(`${interaction.channel.id}.status`, "cancelado")
                    interaction.channel.delete()
                }
            }

        
            if (customId.endsWith("_reembolsarproduto")) {
                const id2 = customId.split("_")[0]
                const pddid2 = customId.split("_")[1]
                const modal = new ModalBuilder()
                .setCustomId(`${id2}_${pddid2}_modal_reembolsarproduto`)
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
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId.endsWith("_pedidos_mostrar")) {
                const id = customId.split("_")[0]

                const pdInfo = dbinfopag.get(id) || {}

                if (!pdInfo) return interaction.reply({ content: `${dbe.get("13")} | Pedido não encontrado!`, ephemeral:true });

                let txt = false
                const total = pdInfo.produtoEntregue.reduce((acc, item) => acc + item.length, 0);
                if (pdInfo.produtoEntregue.length <= 5 && total < 1500) {
                    filed = `${pdInfo.produtoEntregue.map((produto, index) => `${produto}`).join('\n')}`;
                } else {
                    txt = true
                }

                await interaction.reply({ content: `${txt === false ? `${filed}` : `**Todos os produtos estão em um arquivo acima.**`}`, ephemeral:true })
            }
        }
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            if (customId.endsWith("_modal_reembolsarproduto")) {
                const id = customId.split("_")[0]
                const pddid = customId.split("_")[1]
                const confir = interaction.fields.getTextInputValue("text").toLowerCase()

                if (confir !== "sim") {
                    interaction.reply({ content: `${dbe.get(`13`)} | Você escreveu sim incorretamente!`, ephemeral:true})
                    return;
                }
                const { MercadoPagoConfig, Payment, PaymentRefund} = require("mercadopago")
                const acess_token = dc.get(`${pddid}.eSales`) === "ON" ? dbcg.get('acessToken') : dbc.get(`pagamentos.acess_token`)
                const client = new MercadoPagoConfig({ accessToken: acess_token });
                const payment = new Payment(client);
                const refund = new PaymentRefund(client);
                await refund.create({
                    payment_id: id,
                    body: {}
                }).then(async() => {
                    interaction.reply({ content: `${dbe.get(`6`)} | O valor total foi reembolsado!`, ephemeral:true})
                    const painel = await dc.get(`${pddid}.painel`)
                    const pd = db.get(`${painel}`)
                    const pdd = pd.produtos.find(a => a.nome === dc.get(`${pddid}.produto`))
                    const produto = pdd
                    let valor = Number(produto.preco * dc.get(`${pddid}.quantidade`))
                
                    if (dc.get(`${pddid}.cupom`) !== "nenhum") {
                        valor = Number(produto.preco * dc.get(`${pddid}.quantidade`) * (1 - dc.get(`${pddid}.desconto`) / 100))
                    }
                    if (dc.get(`${pddid}.eSales`) === "ON") dbs.substr(`saldo`, valor)
                        console.log(dc.get(pddid))
                    interaction.message.edit({ components: []})
                }).catch(() => {
                    interaction.reply({ content: `${dbe.get(`13`)} | Ocorreu um erro ao tentar reembolsar o valor total!`, ephemeral:true})
                })
            }

            if (customId === "carrinho_addcupom") {
                const cupomUsado = interaction.fields.getTextInputValue("text")
                const painel = await dc.get(`${interaction.channel.id}.painel`)
                const pd = db.get(`${painel}`)
                const pdd = pd.produtos.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))
                const cupons = db.get(`${painel}.cupons`) || []
            
                const cupomEncontrado = cupons.find(a => a.nome === cupomUsado)
                const CupomGlobal = DbSaldo.get(cupomUsado) || []

                if (CupomGlobal.nome === cupomUsado) {
                    const produto = pdd
                    let valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`))
                    
                    if (CupomGlobal.valormax && valor > CupomGlobal.valormax) {
                        interaction.reply({ content: `${dbe.get(`13`)} | Valor máximo atingido de **R$${Number(CupomGlobal.valormax).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**! Escolha menos produtos ou não use o cupom.`, ephemeral:true})
                        return;
                    }
                    if (CupomGlobal.valormin && valor < CupomGlobal.valormin) {
                        interaction.reply({ content: `${dbe.get(`13`)} | Valor mínimo atingido de **R$${Number(cupomEncontrado.valormin).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**! Escolha mais produtos ou não use o CupomGlobal.`, ephemeral:true})
                        return;
                    }
                    if (CupomGlobal.cargo) {
                        const userId = await interaction.user;
                        const user = await interaction.guild.members.cache.get(userId.id)
                        const rolevery = user.roles.cache.has(CupomGlobal.cargo)
                        if (!rolevery) {
                            interaction.reply({ content: `${dbe.get(`13`)} | Você não tem o cargo necessário para usar este cupom!`, ephemeral:true})
                            return;
                        }
                    }
            
                    dc.set(`${interaction.channel.id}.cupom`, cupomUsado)
                    dc.set(`${interaction.channel.id}.desconto`, Number(CupomGlobal.desconto))
                    dc.set(`${interaction.channel.id}.valormax`, Number(CupomGlobal.valormax))
                    dc.set(`${interaction.channel.id}.valormin`, Number(CupomGlobal.valormin))
                    
                    let banks = ""
                    dbc.get(`pagamentos.blockbank`).map(entry => {
                        banks += `- ${entry}.\n`
                    })
                    
                    let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                        valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
                    }
            
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({})})
                        .setColor(dbc.get(`color`))
                        .setTimestamp()
                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                        .setDescription(`Olá ${interaction.user} 👋.\n- Gerencie a sua compra do produto **${produto.nome}** como desejar.`)
                        .addFields(
                            { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                            { name: `Valor Unidade:`, value: `R$${Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline:true },
                            { name: `Estoque:`, value: `${produto.estoque.length}`, inline:true },
                        )
                        .setThumbnail(interaction.guild.iconURL({}))
            
                    let emjdin = dbep.get(`9`)
                    let emjlap = dbep.get(`1`)
                    let emjeti = dbep.get(`14`)
                    let emjcan = dbep.get(`37`)
            
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(3)
                                .setCustomId(`${interaction.channel.id}_continuar`)
                                .setLabel(`Continuar`)
                                .setEmoji(emjdin),
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`${interaction.channel.id}_editarqtd`)
                                .setLabel(`Editar Quantidade`)
                                .setEmoji(emjlap),
                            new ButtonBuilder()
                                .setStyle(1)
                                .setCustomId(`${interaction.channel.id}_addcumpom`)
                                .setLabel(`Usar Cupom`)
                                .setDisabled(dc.get(`${interaction.channel.id}.cupom`) === "nenhum" ? false : true)
                                .setEmoji(emjeti),
                            new ButtonBuilder()
                                .setStyle(4)
                                .setCustomId(`${interaction.channel.id}_cancelarcarrinho`)
                                .setLabel(`Fechar`)
                                .setEmoji(emjcan)
                        )
            
                    await interaction.update({ embeds: [embed], components: [row] })
                    interaction.followUp({ content: `${dbe.get(`6`)} | Cupom adicionado!`, ephemeral:true })
                    return;
                }
            
                if (cupomEncontrado) {
                    const produto = pdd
                    let valor = Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`))
                    
                    if (cupomEncontrado.valormax && valor > cupomEncontrado.valormax) {
                        interaction.reply({ content: `${dbe.get(`13`)} | Valor máximo atingido de **R$${Number(cupomEncontrado.valormax).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**! Escolha menos produtos ou não use o cupom.`, ephemeral:true})
                        return;
                    }
                    if (cupomEncontrado.valormin && valor < cupomEncontrado.valormin) {
                        interaction.reply({ content: `${dbe.get(`13`)} | Valor mínimo atingido de **R$${Number(cupomEncontrado.valormin).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**! Escolha mais produtos ou não use o cupom.`, ephemeral:true})
                        return;
                    }
                    if (cupomEncontrado.cargo) {
                        const userId = await interaction.user;
                        const user = await interaction.guild.members.cache.get(userId.id)
                        const rolevery = user.roles.cache.has(cupomEncontrado.cargo)
                        if (!rolevery) {
                            interaction.reply({ content: `${dbe.get(`13`)} | Você não tem o cargo necessário para usar este cupom!`, ephemeral:true})
                            return;
                        }
                    }
            
                    dc.set(`${interaction.channel.id}.cupom`, cupomUsado)
                    dc.set(`${interaction.channel.id}.desconto`, Number(cupomEncontrado.porcentagem))
                    dc.set(`${interaction.channel.id}.valormax`, Number(cupomEncontrado.valormax))
                    dc.set(`${interaction.channel.id}.valormin`, Number(cupomEncontrado.valormin))
                    
                    let banks = ""
                    dbc.get(`pagamentos.blockbank`).map(entry => {
                        banks += `- ${entry}.\n`
                    })
                    
                    let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                        valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
                    }
            
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({})})
                        .setColor(dbc.get(`color`))
                        .setTimestamp()
                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                        .setDescription(`Olá ${interaction.user} 👋.\n- Gerencie a sua compra do produto **${produto.nome}** como desejar.`)
                        .addFields(
                            { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                            { name: `Valor Unidade:`, value: `R$${Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline:true },
                            { name: `Estoque:`, value: `${produto.estoque.length}`, inline:true },
                        )
                        .setThumbnail(interaction.guild.iconURL({}))
            
                    let emjdin = dbep.get(`9`)
                    let emjlap = dbep.get(`1`)
                    let emjeti = dbep.get(`14`)
                    let emjcan = dbep.get(`37`)
            
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(3)
                                .setCustomId(`${interaction.channel.id}_continuar`)
                                .setLabel(`Continuar`)
                                .setEmoji(emjdin),
                            new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`${interaction.channel.id}_editarqtd`)
                                .setLabel(`Editar Quantidade`)
                                .setEmoji(emjlap),
                            new ButtonBuilder()
                                .setStyle(1)
                                .setCustomId(`${interaction.channel.id}_addcumpom`)
                                .setLabel(`Usar Cupom`)
                                .setDisabled(dc.get(`${interaction.channel.id}.cupom`) === "nenhum" ? false : true)
                                .setEmoji(emjeti),
                            new ButtonBuilder()
                                .setStyle(4)
                                .setCustomId(`${interaction.channel.id}_cancelarcarrinho`)
                                .setLabel(`Fechar`)
                                .setEmoji(emjcan)
                        )
            
                    await interaction.update({ embeds: [embed], components: [row] })
                    interaction.followUp({ content: `${dbe.get(`6`)} | Cupom adicionado!`, ephemeral:true })
                    return;
                }
            
                interaction.reply({ content: `${dbe.get(`13`)} | Cupom não encontrado!`, ephemeral:true })
            }
            
            if (customId === "carrinho_mudarqtd") {
                const qtd = Number(interaction.fields.getTextInputValue("text"))

                if (isNaN(qtd)) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Quantidade inválida!`, ephemeral:true})
                    return;
                }
                const nomep = await dc.get(`${interaction.channel.id}.painel`)
                const nomepd = db.get(`${nomep}.produtos`) || []

                const pd = nomepd.find(a => a.nome === dc.get(`${interaction.channel.id}.produto`))

                if (pd.estoque.length < qtd) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Quantidade inválida! A quantidade não pode ser maior que o estoque.`, ephemeral:true})
                    return;
                }
                if (qtd <= 0) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Quantidade inválida! A quantidade não pode ser menor que o estoque.`, ephemeral:true})
                    return;
                }
                let valor = Number(pd.preco * qtd)
                if (dc.get(`${interaction.channel.id}.valormax`) && valor > dc.get(`${interaction.channel.id}.valormax`)) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Valor máximo atingido de **R$${Number(dc.get(`${interaction.channel.id}.valormax`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**! Escolha menos produtos ou não use o cupom.`, ephemeral:true})
                    return;
                }
                if (dc.get(`${interaction.channel.id}.valormin`) && valor < dc.get(`${interaction.channel.id}.valormin`)) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Valor mínimo atingido de **R$${Number(dc.get(`${interaction.channel.id}.valormin`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**! Escolha mais produtos ou não use o cupom.`, ephemeral:true})
                    return;
                }
                await dc.set(`${interaction.channel.id}.quantidade`, qtd)
                const produto = pd
                let valorTotal = `R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                if (dc.get(`${interaction.channel.id}.cupom`) !== "nenhum") {
                    valorTotal = `~~R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}~~ **R$${Number(produto.preco * dc.get(`${interaction.channel.id}.quantidade`) * (1 - dc.get(`${interaction.channel.id}.desconto`) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- Cupom usado: **${dc.get(`${interaction.channel.id}.cupom`)}** (**${dc.get(`${interaction.channel.id}.desconto`)}%** de desconto).`
                }
                
                const embed = new EmbedBuilder()
                .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({}) })
                .setColor(dbc.get(`color`))
                .setTimestamp()
                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({}) })
                .setDescription(`Olá ${interaction.user} 👋.\n- Gerencie a sua compra do produto **${produto.nome}** como desejar.`)
                .addFields(
                    { name: `Detalhes do Carrinho:`, value: `\`${dc.get(`${interaction.channel.id}.quantidade`)}x\` __${produto.nome}__ | ${valorTotal}` },
                    { name: `Valor Unidade:`, value: `R$${Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline:true },
                    { name: `Estoque:`, value: `${produto.estoque.length}`, inline:true },
                )
                .setThumbnail(interaction.guild.iconURL({}))
                
                let emjdin = dbep.get(`9`)
                let emjlap = dbep.get(`1`)
                let emjeti = dbep.get(`14`)
                let emjcan = dbep.get(`37`)

                const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                    .setStyle(3)
                    .setCustomId(`${interaction.channel.id}_continuar`)
                    .setLabel(`Continuar`)
                    .setEmoji(emjdin),
                    new ButtonBuilder()
                    .setStyle(2)
                    .setCustomId(`${interaction.channel.id}_editarqtd`)
                    .setLabel(`Editar Quantidade`)
                    .setEmoji(emjlap),
                    new ButtonBuilder()
                    .setStyle(1)
                    .setCustomId(`${interaction.channel.id}_addcumpom`)
                    .setLabel(`Usar Cupom`)
                    .setDisabled(dc.get(`${interaction.channel.id}.cupom`) === "nenhum" ? false : true)
                    .setEmoji(emjeti),
                    new ButtonBuilder()
                    .setStyle(4)
                    .setCustomId(`${interaction.channel.id}_cancelarcarrinho`)
                    .setLabel(`Fechar`)
                    .setEmoji(emjcan)
                )
                await interaction.update({ embeds: [embed], components: [row]})
                interaction.followUp({ content: `${dbe.get(`6`)} | Quantidade alterada!`, ephemeral:true})
                return;
            }
        }
    }
}