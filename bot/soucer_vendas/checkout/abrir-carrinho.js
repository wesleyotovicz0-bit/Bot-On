const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, Attachment, AttachmentBuilder} = require("discord.js")
const { JsonDatabase } = require("wio.db")
const dbe = new JsonDatabase({ databasePath: "./json/emojis.json"})
const dc = new JsonDatabase({ databasePath: "./json/carrinho.json"})
const dbc = new JsonDatabase({ databasePath: "./json/botconfig.json"})
const dbp = new JsonDatabase({ databasePath: "./json/personalizados.json"})
const db = new JsonDatabase({ databasePath: "./json/produtos.json"})
const Discord = require("discord.js")
const dbep = new JsonDatabase({ databasePath: "./json/emojisGlob.json"})
const { updateEspecifico, sendMessage } = require("../../Functions/UpdateMessageBuy")
module.exports = {
    name: "interactionCreate",
    run: async (interaction, client) => {
        async function formatValor(valor) {
            return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        }
        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;
            if (db.has(customId)) {
                const value = interaction.values[0]
                const pd = db.get(`${customId}`)
                const produto = pd.produtos.find(a => a.nome === value)
                const x = pd
                const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
                const de = interaction.guild.roles.cache.get(dbc.get(`canais.cargo_staff`))
                const frango = interaction.guild.roles.cache.get(dbc.get(`canais.cargo_cliente`))
                const userId =  interaction.user.id
                const user = interaction.guild.members.cache.get(userId)
                const rolevery = user.roles.cache.has(produto.condições.cargo)
                const cargos = produto.cargosLiberados || []

                if (cargos.length > 0) {
                    let hasRole = cargos.some(a => user.roles.cache.has(a));
                
                    if (hasRole) {
                        return interaction.reply({ content: `${dbe.get(`13`)} | Você não pode comprar este produto porque tem um cargo proibido!`, ephemeral: true });
                    }
                }

                if (produto.condições.cargo && !rolevery) {
                    return interaction.reply({ content: `${dbe.get(`13`)} | Você não tem o cargo necessário para comprar este produto!`, ephemeral:true})
                }
                if (!paumito) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Canal logs privadas inválido!`, ephemeral:true})
                    return;
                }
                if (!de) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Cargo staff inválido!`, ephemeral:true})
                    return;
                }
                if (!frango) {
                    interaction.reply({ content: `${dbe.get(`13`)} | Cargo cliente inválido!`, ephemeral:true})
                    return;
                }
                
                if (dbc.get(`pagamentos.sistema`) === "OFF") {
                    interaction.reply({ content: `${dbe.get(`13`)} | Sistema de vendas desligado!`, ephemeral:true})
                    return;
                }
                updateEspecifico(interaction, x)
                if (produto) {
                    if (produto.estoque.length <= 0) {
                        const embed = new Discord.EmbedBuilder()
                        .setAuthor({ name: "Produto sem Estoque!", iconURL: interaction.user.displayAvatarURL({})})
                        .setDescription(`- Este produto está sem estoque no momento, aguarde um reabastecimento!`)
                        .setColor(dbc.get(`color`) || "Default")
                        .setTimestamp()
                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
        
                        const row = new ActionRowBuilder()
                        .addComponents(
                            new Discord.ButtonBuilder()
                            .setCustomId(`${customId}_${produto.nome}_ativarnotify`)
                            .setEmoji(dbe.get(`31`))
                            .setLabel('Ativar Notificação de Estoque')
                            .setStyle(2)
                            .setDisabled(false)
                        )
                        interaction.reply({ embeds: [embed], components: [row], ephemeral:true})
                        return;
                    }
                    const msg = await interaction.reply({ content: `${dbe.get(`16`)} | Aguarde, estamos criando o carrinho.`, ephemeral:true})
                    const th = interaction.channel.threads.cache.find(x => x.name === `🛒・${interaction.user.username}`);
                    if (th) {
                        const row4 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setURL(`https://discord.com/channels/${interaction.guild.id}/${th.id}`)
                                    .setLabel('Ir para o carrinho')
                                    .setStyle(5)
                            )
            
                        interaction.editReply({ content: `${dbe.get(`13`)} | Você já possui um carrinho aberto.`, components: [row4] })
                        return
                    }
                    await interaction.channel.threads.create({
                        name: `🛒・${interaction.user.username}`,
                        autoArchiveDuration: 60,
                        type: Discord.ChannelType.PrivateThread,
                        reason: 'Carrinho',
                        members: [interaction.user.id],
                    }).then(async(thread) => {
                        const embed = new EmbedBuilder()
                        .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({})})
                        .setColor(dbc.get(`color`))
                        .setTimestamp()
                        .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                        .setDescription(`Olá ${interaction.user} 👋.\n- Gerencie a sua compra do produto **${produto.nome}** como desejar.`)
                        .addFields(
                            { name: `Detalhes do Carrinho:`, value: `\`1x\` __${produto.nome}__ | R$${Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
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
                            .setCustomId(`${thread.id}_continuar`)
                            .setLabel(`Continuar`)
                            .setEmoji(emjdin),
                            new ButtonBuilder()
                            .setStyle(2)
                            .setCustomId(`${thread.id}_editarqtd`)
                            .setLabel(`Editar Quantidade`)
                            .setEmoji(emjlap),
                            new ButtonBuilder()
                            .setStyle(1)
                            .setCustomId(`${thread.id}_addcumpom`)
                            .setLabel(`Usar Cupom`)
                            .setEmoji(emjeti),
                            new ButtonBuilder()
                            .setStyle(4)
                            .setCustomId(`${thread.id}_cancelarcarrinho`)
                            .setLabel(`Fechar`)
                            .setEmoji(emjcan)
                        )
                        thread.send({ embeds: [embed], components: [row], content: `${interaction.user} | ${de}`}).then(async(msgg) => {

                            const row4 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setURL(msgg.url)
                                    .setLabel('Ir para o carrinho.')
                                    .setStyle(5)
                            )

                            dc.set(`${thread.id}`, {
                                id: thread.id,
                                valor: produto.preco,
                                quantidade: 1,
                                cupom: "nenhum",
                                desconto: 0,
                                painel: x.id,
                                user: interaction.user.id,
                                produto: produto.nome,
                                status: "esperando"
                            })
                            msg.edit({ content: `${dbe.get(`6`)} | Carrinho criado com sucesso!`, components: [row4] })
                            if (dbc.get(`pagamentos.sistema_auto`) === "ON") {
                                await setTimeout((a) => {
                                    if (dc.get(`${thread.id}.status`) === "esperando") {
                                        thread.delete()
                                        
                                        if (dbc.get(`canais.sistema_carrinho`) === "ON") {
                                            const embeda = new EmbedBuilder()
                                            .setAuthor({ name: `🛒 Carrinho fechado!`, iconURL: interaction.user.displayAvatarURL({})})
                                            .setColor("Red")
                                            .setDescription(`Olá ${interaction.user} 👋.\n- Seu carrinho foi fechado por inatividade!`)
                                            .setThumbnail(interaction.user.displayAvatarURL({}))
                                            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                                            .setTimestamp()
                
                                            interaction.user.send({ embeds: [embeda]}).catch(() => {
                                                
                                            })
                                            const embed = new EmbedBuilder()
                                            .setAuthor({ name: `🛒 Carrinho fechado!`, iconURL: interaction.guild.iconURL({})})
                                            .setColor("Red")
                                            .setDescription(`- O usuário ${interaction.user} (${interaction.user.username}) teve o seu carrinho fechado por inatividade.`)
                                            .setThumbnail(interaction.user.displayAvatarURL({}))
                                            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                                            .setTimestamp()
            
                                            paumito.send({embeds: [embed]})
                                        }
                                    }
                                }, 1000 * 60 * 20)
                            }
                        }).catch(async(err) => {
                            console.log(err)
                            msg.edit({ content: `${dbe.get(`13`)} | Ocorreu um erro ao criar o carrinho! Tente novamente.`})
                            thread.delete()
                        })
                    }).catch(async(err) => {
                        console.log(err)
                        msg.edit({ content: `${dbe.get(`13`)} | Ocorreu um erro ao criar o carrinho! Tente novamente.`})
                        
                    })
                } else {
                    interaction.reply({ content: `${dbe.get(`13`)} | Produto não encontrado! Fale com o suporte do servidor.`, ephemeral:true})
                }
            }
        }
        if (interaction.isButton()) {
            const customId = interaction.customId;
            const pd = customId.split("_")[0]
            const nome = customId.split("_")[1]

            if (customId.endsWith(`_produtopainel`)) {
                if (db.has(`${customId.split("_")[0]}`) && db.get(`${customId.split("_")[0]}`).produtos[0].nome === nome) {
                    const pd = db.get(`${customId.split("_")[0]}`)
                    const produto = pd.produtos.find(a => a.nome === nome)
                    const x = pd
                    const paumito = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
                    const de = interaction.guild.roles.cache.get(dbc.get(`canais.cargo_staff`))
                    const frango = interaction.guild.roles.cache.get(dbc.get(`canais.cargo_cliente`))
                    const userId =  interaction.user.id
                    const user = interaction.guild.members.cache.get(userId)
                    const rolevery = user.roles.cache.has(produto.condições.cargo)
                    const cargos = produto.cargosLiberados || []


                    if (cargos.length > 0) {
                        let hasRole = cargos.some(a => user.roles.cache.has(a));
                    
                        if (hasRole) {
                            return interaction.reply({ content: `${dbe.get(`13`)} | Você não pode comprar este produto porque tem um cargo proibido!`, ephemeral: true });
                        }
                    }
    
                    if (produto.condições.cargo && !rolevery) {
                        return interaction.reply({ content: `${dbe.get(`13`)} | Você não tem o cargo necessário para comprar este produto!`, ephemeral:true})
                    }
                    if (!paumito) {
                        interaction.reply({ content: `${dbe.get(`13`)} | Canal logs privadas inválido!`, ephemeral:true})
                        return;
                    }
                    if (!de) {
                        interaction.reply({ content: `${dbe.get(`13`)} | Cargo staff inválido!`, ephemeral:true})
                        return;
                    }
                    if (!frango) {
                        interaction.reply({ content: `${dbe.get(`13`)} | Cargo cliente inválido!`, ephemeral:true})
                        return;
                    }
                    if (dbc.get(`pagamentos.sistema`) === "OFF") {
                        interaction.reply({ content: `${dbe.get(`13`)} | Sistema de vendas desligado!`, ephemeral:true})
                        return;
                    }
                    updateEspecifico(interaction, x)
                    if (produto) {
                        if (produto.estoque.length <= 0) {
                            const embed = new Discord.EmbedBuilder()
                            .setAuthor({ name: "Produto sem Estoque!", iconURL: interaction.user.displayAvatarURL({})})
                            .setDescription(`- Este produto está sem estoque no momento, aguarde um reabastecimento!`)
                            .setColor(dbc.get(`color`) || "Default")
                            .setTimestamp()
                            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
            
                            const row = new ActionRowBuilder()
                            .addComponents(
                                new Discord.ButtonBuilder()
                                .setCustomId(`${x.id}_${x.produtos[0].nome}_ativarnotify`)
                                .setEmoji(dbe.get(`31`))
                                .setLabel('Ativar Notificação de Estoque')
                                .setStyle(2)
                                .setDisabled(false)
                            )
                            interaction.reply({ embeds: [embed], components: [row], ephemeral:true})
                            return;
                        }
                        const msg = await interaction.reply({ content: `${dbe.get(`16`)} | Aguarde, estamos criando o carrinho.`, ephemeral:true})
                        const th = interaction.channel.threads.cache.find(x => x.name === `🛒・${interaction.user.username}`);
                        if (th) {
                            const row4 = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setURL(`https://discord.com/channels/${interaction.guild.id}/${th.id}`)
                                        .setLabel('Ir para o carrinho')
                                        .setStyle(5)
                                )
                
                            interaction.editReply({ content: `${dbe.get(`13`)} | Você já possui um carrinho aberto.`, components: [row4] })
                            return
                        }
                        await interaction.channel.threads.create({
                            name: `🛒・${interaction.user.username}`,
                            autoArchiveDuration: 60 * 24 * 7,
                            type: Discord.ChannelType.PrivateThread,
                            reason: 'Carrinho',
                            members: [interaction.user.id],
                        }).then(async(thread) => {
                            const embed = new EmbedBuilder()
                            .setAuthor({ name: `🛒 Carrinho de ${interaction.user.displayName}.`, iconURL: interaction.user.displayAvatarURL({})})
                            .setColor(dbc.get(`color`))
                            .setTimestamp()
                            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                            .setDescription(`Olá ${interaction.user} 👋.\n- Gerencie a sua compra do produto **${produto.nome}** como desejar.`)
                            .addFields(
                                { name: `Detalhes do Carrinho:`, value: `\`1x\` __${produto.nome}__ | R$${Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
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
                                .setCustomId(`${thread.id}_continuar`)
                                .setLabel(`Continuar`)
                                .setEmoji(emjdin),
                                new ButtonBuilder()
                                .setStyle(2)
                                .setCustomId(`${thread.id}_editarqtd`)
                                .setLabel(`Editar Quantidade`)
                                .setEmoji(emjlap),
                                new ButtonBuilder()
                                .setStyle(1)
                                .setCustomId(`${thread.id}_addcumpom`)
                                .setLabel(`Usar Cupom`)
                                .setEmoji(emjeti),
                                new ButtonBuilder()
                                .setStyle(4)
                                .setCustomId(`${thread.id}_cancelarcarrinho`)
                                .setLabel(`Fechar`)
                                .setEmoji(emjcan)
                            )
                            thread.send({ embeds: [embed], components: [row], content: `${interaction.user} | ${de}`}).then(async(msgg) => {
                                const row4 = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setURL(msgg.url)
                                        .setLabel('Ir para o carrinho.')
                                        .setStyle(5)
                                )
                                dc.set(`${thread.id}`, {
                                    id: thread.id,
                                    valor: produto.preco,
                                    quantidade: 1,
                                    cupom: "nenhum",
                                    desconto: 0,
                                    painel: x.id,
                                    produto: produto.nome,
                                    user: interaction.user.id,
                                    status: "esperando"
                                })
                                msg.edit({ content: `${dbe.get(`6`)} | Carrinho criado com sucesso!`, components: [row4] })
                                if (dbc.get(`pagamentos.sistema_auto`) === "ON") {
                                    await setTimeout((a) => {
                                        if (dc.get(`${thread.id}.status`) === "esperando") {
                                            thread.delete()
                                            const embed = new EmbedBuilder()
                                            .setAuthor({ name: `🛒 Carrinho fechado!`, iconURL: interaction.guild.iconURL({})})
                                            .setColor("Red")
                                            .setDescription(`- O usuário ${interaction.user} (${interaction.user.username}) teve o seu carrinho fechado por inatividade.`)
                                            .setThumbnail(interaction.user.displayAvatarURL({}))
                                            .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                                            .setTimestamp()
            
                                            paumito.send({embeds: [embed]})
                                            if (dbc.get(`canais.sistema_carrinho`) === "ON") {
                                                const embeda = new EmbedBuilder()
                                                .setAuthor({ name: `🛒 Carrinho fechado!`, iconURL: interaction.user.displayAvatarURL({})})
                                                .setColor("Red")
                                                .setDescription(`Olá ${interaction.user} 👋.\n- Seu carrinho foi fechado por inatividade!`)
                                                .setThumbnail(interaction.user.displayAvatarURL({}))
                                                .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
                                                .setTimestamp()
                    
                                                interaction.user.send({ embeds: [embeda]})
                                            }
                                        }
                                    }, 1000 * 60 * 20)
                                }
                            }).catch(async(err) => {
                                console.log(err)
                                msg.edit({ content: `${dbe.get(`13`)} | Ocorreu um erro ao criar o carrinho! Tente novamente.`})
                            })
                        }).catch(async(err) => {
                            console.log(err)
                                msg.edit({ content: `${dbe.get(`13`)} | Ocorreu um erro ao criar o carrinho! Tente novamente.`})
                            })
                    } else {
                        interaction.reply({ content: `${dbe.get(`13`)} | Produto não encontrado! Fale com o suporte do servidor.`, ephemeral:true})
                    }
                }
            }
        }
        // Notificar Estoque

        if (interaction.isButton()) {
            const customId = interaction.customId;
            const pd = customId.split("_")[0]
            const nome = customId.split("_")[1]

            if (customId.endsWith("_ativarnotify")) {
                const userId = interaction.user.id;
                const user = interaction.user;
                const pdd = db.get(`${pd}`)
                const pddd = pdd.produtos.findIndex(id => id.nome === nome)
                
                const notusers = pdd.produtos[pddd].notificados || []

                const findUser = notusers.find(a => a === userId)
                if (findUser) {
                    interaction.reply({ content: `${dbe.get(`2`)} | Você ja está na lista de notificação deste produto!`, ephemeral:true})
                    return
                } else {
                    const ami = pdd.produtos[pddd].notificados || []
                    await ami.push(userId)
                    pdd.produtos[pddd].notificados = ami

                    await db.set(`${pd}`, pdd)

                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `Pedido de estoque!`, iconURL: interaction.guild.iconURL({})})
                    .setColor("Gold")
                    .setDescription(`- O usuário ${user} (${user.username}) fez um pedido de estoque!`)
                    .setFields(
                        { name: `Painel:`, value: `${pd}`, inline:true },
                        { name: `Produto:`, value: `${nome}`, inline:false },
                        { name: `Data / Horário:`, value: `<t:${Math.floor(new Date() / 1000)}:f> (<t:${~~(new Date() / 1000)}:R>)`}
                    )
                    .setThumbnail(interaction.user.displayAvatarURL({}))
                    .setTimestamp()
                    .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({})})
    
                    const channel = interaction.guild.channels.cache.get(dbc.get(`canais.vendas_privado`))
    
                    if (channel) {
                        channel.send({ embeds: [embed]})
                    }
                    interaction.reply({ content: `${dbe.get(`6`)} | Você foi adicionado à lista de notificação deste produto com sucesso!`, ephemeral:true})
                }
            }
        }
    }
}