import disnake
from disnake.ext import commands
from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message
from .listar import CANAIS_OPCOES, CANAIS_NOMES_DISCORD


class MensagensCanais:
    @staticmethod
    def canal_criado_components(canal: disnake.abc.GuildChannel, auto: bool) -> disnake.ui.Container:
        return disnake.ui.Container(
            disnake.ui.TextDisplay(
                f"# {emoji.z0}{emoji.z1}{emoji.z2}{emoji.z3}{emoji.z4}\n-# Canal Criado"
            ),
            disnake.ui.TextDisplay(
                f"**Informações do canal:**\nID: `{canal.id}`\nNome: `{canal.name}`\nMenção: {canal.mention}"
            ),
        )

    @staticmethod
    def canal_criado_embed(canal: disnake.abc.GuildChannel, auto: bool):
        colors = db.get_document("custom_colors")
        primary_color_hex = colors.get("primary")
        embed = disnake.Embed(
            title="Canal Criado",
            description=(
                f"**Informações do canal:**\nID: `{canal.id}`\nNome: `{canal.name}`\nMenção: {canal.mention}"
            ),
        )
        if primary_color_hex:
            primary_color = int(primary_color_hex.replace("#", ""), 16)
            embed.color = primary_color
        return embed, []


class CriarTodosCanais(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @staticmethod
    def panel(inter: disnake.MessageInteraction):
        mode = db.get_document("custom_mode").get("mode")
        if mode == "embed":
            return CriarTodosCanais._panel_embed(inter)
        return CriarTodosCanais._panel_components(inter)

    @staticmethod
    def _panel_components(inter: disnake.MessageInteraction) -> dict:
        canais_db = db.get_document("canais") or {}

        criados = []
        for key, _, _ in CANAIS_OPCOES:
            canal_id = canais_db.get(key)
            if canal_id:
                channel = inter.guild.get_channel(int(canal_id))
                if channel:
                    criados.append(channel)

        criados_text = (
            "\n".join(f"{c.mention} (`{c.id}`)" for c in criados)
            if criados
            else "Nenhum canal criado ainda"
        )

        color_data = db.get_document("custom_colors")
        primary_color_hex = color_data.get("primary")

        container_kwargs = {}
        if primary_color_hex:
            primary_color = int(primary_color_hex.replace("#", ""), 16)
            container_kwargs["accent_colour"] = disnake.Colour(primary_color)

        return {
            "components": [
                disnake.ui.Container(
                    disnake.ui.TextDisplay(
                        f"# {emoji.z0}{emoji.z1}{emoji.z2}{emoji.z3}{emoji.z4}\n-# Painel > **Canais**"
                    ),
                    disnake.ui.TextDisplay("**Canais criados pelo bot:**"),
                    disnake.ui.TextDisplay(criados_text),
                    disnake.ui.ActionRow(
                        disnake.ui.Button(
                            label="Criar canais básicos",
                            style=disnake.ButtonStyle.success,
                            emoji=emoji.check,
                            custom_id="Configuracoes_CriarTodosCanais",
                        ),
                    ),
                    **container_kwargs,
                ),
                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label="Voltar",
                        style=disnake.ButtonStyle.grey,
                        emoji=emoji.back,
                        custom_id="Painel_Settings",
                    )
                ),
            ]
        }

    @staticmethod
    def _panel_embed(inter: disnake.MessageInteraction) -> dict:
        canais_db = db.get_document("canais") or {}

        criados = []
        for key, _, _ in CANAIS_OPCOES:
            canal_id = canais_db.get(key)
            if canal_id:
                channel = inter.guild.get_channel(int(canal_id))
                if channel:
                    criados.append(channel)

        criados_text = (
            "\n".join(f"{c.mention} (`{c.id}`)" for c in criados)
            if criados
            else "Nenhum canal criado ainda"
        )

        color_data = db.get_document("custom_colors")
        primary_color_hex = color_data.get("primary")

        embed = disnake.Embed(title="Canais criados pelo bot", description=criados_text)
        if primary_color_hex:
            embed.color = int(primary_color_hex.replace("#", ""), 16)

        components = [
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Criar canais básicos",
                    style=disnake.ButtonStyle.success,
                    emoji=emoji.check,
                    custom_id="Configuracoes_CriarTodosCanais",
                ),
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="Painel_Settings",
                ),
            )
        ]
        return {"embed": embed, "components": components}

    @commands.Cog.listener("on_button_click")
    async def criar_todos_canais_listener(self, inter: disnake.MessageInteraction):
        if inter.component.custom_id != "Configuracoes_CriarTodosCanais":
            return

        mode = db.get_document("custom_mode").get("mode")
        if mode == "embed":
            await embed_message.wait(inter, send=False)
        else:
            await message.wait(inter, send=False)

        canais_db = db.get_document("canais") or {}
        criados = []
        erros = []

        for key, label, _ in CANAIS_OPCOES:
            # Se já existe e ainda é válido, pular
            existing_id = canais_db.get(key)
            if existing_id:
                ch_existing = inter.guild.get_channel(int(existing_id))
                if ch_existing:
                    criados.append(ch_existing)
                    continue

            nome_discord = CANAIS_NOMES_DISCORD.get(
                key, f"📂╺╸ {label.lower().replace(' ', '-')}"
            )
            try:
                ch = await inter.guild.create_text_channel(
                    nome_discord,
                    reason=f"Criação automática de canais básicos - {inter.user.name}",
                )
                canais_db[key] = str(ch.id)
                criados.append(ch)
            except Exception as e:
                erros.append(f"`{nome_discord}`: {e}")

        db.save_document("canais", canais_db)

        criados_text = (
            "\n".join(f"{c.mention} — `{c.name}`" for c in criados)
            if criados
            else "Nenhum canal criado."
        )
        erros_text = ("\n".join(erros)) if erros else None

        resultado = f"**Canais criados/configurados:**\n{criados_text}"
        if erros_text:
            resultado += f"\n\n**Erros:**\n{erros_text}"

        color_data = db.get_document("custom_colors")
        primary_color_hex = color_data.get("primary")

        if mode == "embed":
            embed = disnake.Embed(title="✅ Canais Básicos Criados", description=resultado)
            if primary_color_hex:
                embed.color = int(primary_color_hex.replace("#", ""), 16)
            await inter.edit_original_message(content=None, embed=embed, components=[])
        else:
            container_kwargs = {}
            if primary_color_hex:
                container_kwargs["accent_colour"] = disnake.Colour(
                    int(primary_color_hex.replace("#", ""), 16)
                )
            await inter.edit_original_message(
                components=[
                    disnake.ui.Container(
                        disnake.ui.TextDisplay(
                            f"# {emoji.z0}{emoji.z1}{emoji.z2}{emoji.z3}{emoji.z4}\n-# Canais Básicos Criados"
                        ),
                        disnake.ui.TextDisplay(resultado),
                        **container_kwargs,
                    )
                ]
            )


def setup(bot: commands.Bot):
    bot.add_cog(CriarTodosCanais(bot))
