const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, Attachment, AttachmentBuilder} = require("discord.js")
const { JsonDatabase } = require("wio.db")
const dbe = new JsonDatabase({ databasePath: "./json/emojis.json"})
const dbc = new JsonDatabase({ databasePath: "./json/botconfig.json"})
const dbp = new JsonDatabase({ databasePath: "./json/personalizados.json"})
const db = new JsonDatabase({ databasePath: "./json/produtos.json"})
const fs = require("fs")
const Discord = require("discord.js")

async function sendMessage(interaction, painelId, channelId) {
    const x = db.get(`${painelId}`)
    const channel = interaction.guild.channels.cache.get(channelId)
    if (channel) {
        if (dbp.get(`modo`) === "embed") {
            const embed = new EmbedBuilder()
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic:true })})
            .setTimestamp()
            let titulo = dbp.get(`painel_button.titulo`);
            titulo = titulo.replace("{nome}", x.titulo)
            titulo = titulo.replace("{valor}", Number(x.produtos[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
            titulo = titulo.replace("{estoque}", x.produtos[0].estoque.length)
            let desc = dbp.get(`painel_button.msg`);
            desc = desc.replace("{nome}", x.titulo)
            desc = desc.replace("{valor}", Number(x.produtos[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
            desc = desc.replace("{estoque}", x.produtos[0].estoque.length)
            desc = desc.replace("{desc}", x.desc)
            
            if (x.produtos.length > 1) {
                titulo = dbp.get(`painel_select.titulo`);
                titulo = titulo.replace("{nome}", x.titulo)
                desc = dbp.get(`painel_select.msg`);
                desc = desc.replace("{nome}", x.titulo)
                desc = desc.replace("{desc}", x.desc)
            }
            const dataa = x.button || {}
            embed.setTitle(titulo)
            embed.setDescription(desc)
            embed.setColor(dataa.color || dbc.get(`color`))
            
            const button = new ButtonBuilder()
            .setStyle(db.get(`${x.id}.button.style`) || dbp.get(`painel_button.button.style`))
            .setCustomId(`${x.id}_${x.produtos[0].nome}_produtopainel`)
            .setLabel(`${db.get(`${x.id}.button.text`) || dbp.get(`painel_button.button.text`)}`)
    
            if (db.get(`${x.id}.button.emoji`) || dbp.get(`painel_button.button.emoji`)) {
                button.setEmoji(db.get(`${x.id}.button.emoji`) || dbp.get(`painel_button.button.emoji`))
            }
    
            const actionrowselect = new StringSelectMenuBuilder()
            .setCustomId(x.id)
            .setPlaceholder(dbp.get(`painel_select.select.place`))
            
            for (const c of x.produtos){
                let titulo = dbp.get(`painel_select.select.text`);
                titulo = titulo.replace("{nome}", c.nome)
                titulo = titulo.replace("{valor}", Number(c.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                titulo = titulo.replace("{estoque}", c.estoque.length)
                let desc = dbp.get(`painel_select.select.desc`);
                desc = desc.replace("{nome}", c.nome)
                desc = desc.replace("{desc}", c.desc)
                desc = desc.replace("{valor}", Number(c.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                desc = desc.replace("{estoque}", c.estoque.length)
                const options = {
                    label: `${titulo}`,
                    description: `${desc}`,
                    value: `${c.nome}`
                }
                if (c.emoji) options.emoji = c.emoji
                actionrowselect.addOptions(options)
            }
            let row
            
            if (x.produtos.length === 1) {
                row = new ActionRowBuilder()
                .addComponents(button)
            } else {
                row = new ActionRowBuilder()
                .addComponents(actionrowselect)
            }
            const options = { embeds: [embed], components: [row], content: "", files: [] };

            if (x.banner) {
                if (fs.existsSync(`./Imagens/banners/${x.id}.png`)) {
                    const filePathBanner = `./Imagens/banners/${x.id}.png`; // Caminho original com espaços
                    const sanitizedIdBanner = x.id.replace(/[\s+]/g, "-").replace(/[^\w-]/g, "-");

                    const banner = new AttachmentBuilder(filePathBanner, { name: `${sanitizedIdBanner}.png` }); // Força o nome do arquivo
                    options.files.push(banner); 
                    embed.setImage(`attachment://${sanitizedIdBanner}.png`);
                    
                }
            }
            
            if (x.thumb) {
                embed.setThumbnail(x.thumb)
            }
            channel.send(options).then(msg => {
                db.set(`${painelId}.idmsg`, `${msg.id}`)
                db.set(`${painelId}.idchannel`, `${channel.id}`)
            }).catch((err) => {
                console.log(err)
            })
        } else {
            let desc = dbp.get(`painel_button.msg`);
            desc = desc.replace("{nome}", x.titulo)
            desc = desc.replace("{valor}", Number(x.produtos[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
            desc = desc.replace("{estoque}", x.produtos[0].estoque.length)
            desc = desc.replace("{desc}", x.desc)
            const button = new ButtonBuilder()
            .setStyle(db.get(`${x.id}.button.style`) || dbp.get(`painel_button.button.style`))
            .setCustomId(`${x.id}_${x.produtos[0].nome}_produtopainel`)
            .setLabel(`${db.get(`${x.id}.button.text`) || dbp.get(`painel_button.button.text`)}`)
    
            if (db.get(`${x.id}.button.emoji`) || dbp.get(`painel_button.button.emoji`)) {
                button.setEmoji(db.get(`${x.id}.button.emoji`) || dbp.get(`painel_button.button.emoji`))
            }
            const row = new ActionRowBuilder()
            .addComponents(button)
    
            const options = { embeds: [], components: [row], content: desc, files: []}

            if (x.banner) {
                if (fs.existsSync(`./Imagens/banners/${x.id}.png`)) {
                    const filePathBanner = `./Imagens/banners/${x.id}.png`; // Caminho original com espaços
                    const sanitizedIdBanner = x.id.replace(/[\s+]/g, "-").replace(/[^\w-]/g, "-");

                    const banner = new AttachmentBuilder(filePathBanner, { name: `${sanitizedIdBanner}.png` }); // Força o nome do arquivo
                    options.files.push(banner); 
                }
            }
            channel.send(options).then(msg => {
                db.set(`${painelId}.idmsg`, `${msg.id}`)
                db.set(`${painelId}.idchannel`, `${channel.id}`)
            }).catch((err) => {
                console.log(err)
            })
        }
    }
}
async function updateEspecifico(interaction, painelId) {
    let x = painelId
    if (!painelId.titulo) {
        x = db.get(`${painelId}`);
    }
    const channel = interaction.guild.channels.cache.get(x.idchannel);
        
    if (channel) {
        channel.messages.fetch(x.idmsg).then(async(msg) => {
            if (dbp.get(`modo`) === "embed") {

                const embed = new EmbedBuilder()
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic:true })})
                .setTimestamp()
                let titulo = dbp.get(`painel_button.titulo`);
                titulo = titulo.replace("{nome}", x.titulo)
                titulo = titulo.replace("{valor}", Number(x.produtos[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                titulo = titulo.replace("{estoque}", x.produtos[0].estoque.length)
                let desc = dbp.get(`painel_button.msg`);
                desc = desc.replace("{nome}", x.titulo)
                desc = desc.replace("{valor}", Number(x.produtos[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                desc = desc.replace("{estoque}", x.produtos[0].estoque.length)
                desc = desc.replace("{desc}", x.desc)
                
                if (x.produtos.length > 1) {
                    titulo = dbp.get(`painel_select.titulo`);
                    titulo = titulo.replace("{nome}", x.titulo)
                    desc = dbp.get(`painel_select.msg`);
                    desc = desc.replace("{nome}", x.titulo)
                    desc = desc.replace("{desc}", x.desc)
                }
                const dataa = x.button || {}
                embed.setTitle(titulo)
                embed.setDescription(desc)
                embed.setColor(dataa.color || dbc.get(`color`))
                
                
                const button = new ButtonBuilder()
                .setStyle(db.get(`${x.id}.button.style`) || dbp.get(`painel_button.button.style`))
                .setCustomId(`${x.id}_${x.produtos[0].nome}_produtopainel`)
                .setLabel(`${db.get(`${x.id}.button.text`) || dbp.get(`painel_button.button.text`)}`)

                if (db.get(`${x.id}.button.emoji`) || dbp.get(`painel_button.button.emoji`)) {
                    button.setEmoji(db.get(`${x.id}.button.emoji`) || dbp.get(`painel_button.button.emoji`))
                }

                const actionrowselect = new StringSelectMenuBuilder()
                .setCustomId(x.id)
                .setPlaceholder(dbp.get(`painel_select.select.place`))
                
                for (const c of x.produtos){
                    let titulo = dbp.get(`painel_select.select.text`);
                    titulo = titulo.replace("{nome}", c.nome)
                    titulo = titulo.replace("{valor}", Number(c.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                    titulo = titulo.replace("{estoque}", c.estoque.length)
                    let desc = dbp.get(`painel_select.select.desc`);
                    desc = desc.replace("{nome}", c.nome)
                    desc = desc.replace("{desc}", c.desc)
                    desc = desc.replace("{valor}", Number(c.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                    desc = desc.replace("{estoque}", c.estoque.length)
                    const options = {
                        label: `${titulo}`,
                        description: `${desc}`,
                        value: `${c.nome}`
                    }
                    if (c.emoji) options.emoji = c.emoji
                    actionrowselect.addOptions(options)
                }
                let row
                
                if (x.produtos.length === 1) {
                    row = new ActionRowBuilder()
                    .addComponents(button)
                } else {
                    row = new ActionRowBuilder()
                    .addComponents(actionrowselect)
                }
                const options = { embeds: [embed], components: [row], content: "", files: [] };

                if (x.banner) {
                    if (fs.existsSync(`./Imagens/banners/${x.id}.png`)) {
                        const filePathBanner = `./Imagens/banners/${x.id}.png`; // Caminho original com espaços
                        const sanitizedIdBanner = x.id.replace(/[\s+]/g, "-").replace(/[^\w-]/g, "-");
    
                        const banner = new AttachmentBuilder(filePathBanner, { name: `${sanitizedIdBanner}.png` }); // Força o nome do arquivo
                        options.files.push(banner); 
                        embed.setImage(`attachment://${sanitizedIdBanner}.png`);
                        
                    }
                }
                
                if (x.thumb) {
                    embed.setThumbnail(x.thumb)
                }
                msg.edit(options).then(msg => {
                    db.set(`${x.id}.idmsg`, `${msg.id}`)
                    db.set(`${x.id}.idchannel`, `${msg.channel.id}`)
                }).catch(() => {
                })
            } else {
                let desc = dbp.get(`painel_button.msg`);
                desc = desc.replace("{nome}", x.titulo)
                desc = desc.replace("{valor}", Number(x.produtos[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                desc = desc.replace("{estoque}", x.produtos[0].estoque.length)
                desc = desc.replace("{desc}", x.desc)

                if (x.produtos.length > 1) {
                    desc = dbp.get(`painel_select.msg`);
                    desc = desc.replace("{nome}", x.titulo)
                    desc = desc.replace("{desc}", x.desc)
                }
                const button = new ButtonBuilder()
                .setStyle(db.get(`${x.id}.button.style`) || dbp.get(`painel_button.button.style`))
                .setCustomId(`${x.id}_${x.produtos[0].nome}_produtopainel`)
                .setLabel(`${db.get(`${x.id}.button.text`) || dbp.get(`painel_button.button.text`)}`)

                if (db.get(`${x.id}.button.emoji`) || dbp.get(`painel_button.button.emoji`)) {
                    button.setEmoji(db.get(`${x.id}.button.emoji`) || dbp.get(`painel_button.button.emoji`))
                }
                const actionrowselect = new StringSelectMenuBuilder()
                .setCustomId(x.id)
                .setPlaceholder(dbp.get(`painel_select.select.place`))
                
                for (const c of x.produtos){
                    let titulo = dbp.get(`painel_select.select.text`);
                    titulo = titulo.replace("{nome}", c.nome)
                    titulo = titulo.replace("{valor}", Number(c.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                    titulo = titulo.replace("{estoque}", c.estoque.length)
                    let desc = dbp.get(`painel_select.select.desc`);
                    desc = desc.replace("{nome}", c.nome)
                    desc = desc.replace("{desc}", c.desc)
                    desc = desc.replace("{valor}", Number(c.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                    desc = desc.replace("{estoque}", c.estoque.length)
                    const options = {
                        label: `${titulo}`,
                        description: `${desc}`,
                        value: `${c.nome}`
                    }
                    if (c.emoji) options.emoji = c.emoji
                    actionrowselect.addOptions(options)
                }
                let row
                
                if (x.produtos.length === 1) {
                    row = new ActionRowBuilder()
                    .addComponents(button)
                } else {
                    row = new ActionRowBuilder()
                    .addComponents(actionrowselect)
                }

                const options = { embeds: [], components: [row], content: desc, files: [] };

                if (x.banner) {
                    if (fs.existsSync(`./Imagens/banners/${x.id}.png`)) {
                        const filePathBanner = `./Imagens/banners/${x.id}.png`; // Caminho original com espaços
                        const sanitizedIdBanner = x.id.replace(/[\s+]/g, "-").replace(/[^\w-]/g, "-");
    
                        const banner = new AttachmentBuilder(filePathBanner, { name: `${sanitizedIdBanner}.png` }); // Força o nome do arquivo
                        options.files.push(banner); 
                    }
                }
                msg.edit(options).then(msg => {
                    db.set(`${x.id}.idmsg`, `${msg.id}`)
                    db.set(`${x.id}.idchannel`, `${msg.channel.id}`)
                }).catch(() => {
                })
            }
        }).catch((err) => {
            console.log(err)
        })
    }
}

module.exports = {
    updateEspecifico,
    sendMessage
}