import disnake
from disnake.ext import commands
from functions.database import database as db
from functions.emoji import emoji
import random
from .listar import CARGOS_OPCOES, CARGOS_CORES
from .cog import ConfigurarCargos
from functions.message import message, embed_message


class MensagensCargos:
    @staticmethod
    def cargo_criado_components(cargo: disnake.Role, auto: bool) -> disnake.ui.Container:
        return disnake.ui.Container(
            disnake.ui.TextDisplay(f"# {emoji.z0}{emoji.z1}{emoji.z2}{emoji.z3}{emoji.z4}\n-# Criar Todos os Cargos Automáticamente > Cargo Criado" if auto else f"# {emoji.z0}{emoji.z1}{emoji.z2}{emoji.z3}{emoji.z4}\n-# Criar Cargo > Cargo Criado"),
            disnake.ui.Separator(),
            disnake.ui.TextDisplay(f"**Informações do cargo:**\nID: `{cargo.id}`\nNome: `{cargo.name}`\nMenção: {cargo.mention}"),
        )

    @staticmethod
    def cargos_criados_components(criados: list[disnake.Role]) -> list[disnake.ui.Container]:
        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(f"""
**Informações dos cargos criados:**
`{len(criados)}` cargos criados com sucesso.
                """),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(", ".join(f"{c.mention} (`{c.id}`)" for c in criados))
            )
        ]

    @staticmethod
    def cargo_criado_embed(cargo: disnake.Role, auto: bool):
        colors = db.get_document("custom_colors")
        primary_color_hex = colors.get("primary")
        embed = disnake.Embed(
            title=f"Cargo Criado",
            description=f"**Informações do cargo:**\nID: `{cargo.id}`\nNome: `{cargo.name}`\nMenção: {cargo.mention}",
        )
        if primary_color_hex:
            primary_color = int(primary_color_hex.replace("#", ""), 16)
            embed.color = primary_color
        return embed, []

    @staticmethod
    def cargos_criados_embed(criados: list[disnake.Role]):
        colors = db.get_document("custom_colors")
        primary_color_hex = colors.get("primary")
        embed = disnake.Embed(
            title=f"Cargos Criados",
            description=f"`{len(criados)}` cargos criados com sucesso.",
        )
        if primary_color_hex:
            primary_color = int(primary_color_hex.replace("#", ""), 16)
            embed.color = primary_color
        embed.add_field(
            name="Cargos:",
            value=f"{', '.join(f'{c.mention} (`{c.id}`)' for c in criados)}"
        )
        return embed, []


class CriarTodosCargos(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @staticmethod
    def panel(inter: disnake.MessageInteraction):
        mode = db.get_document("custom_mode").get("mode")
        if mode == "embed":
            return CriarTodosCargos._panel_embed(inter)
        return CriarTodosCargos._panel_components(inter)

    @staticmethod
    def _panel_components(inter: disnake.MessageInteraction) -> dict:
        roles = inter.guild.roles
        config = db.get_document("config")
        cargos_config = config.get("cargos", {})
        
        criados = []
        for cargo_id, cargo_config in cargos_config.items():
            role = inter.guild.get_role(int(cargo_id))
            if role:
                criados.append(role)

        criados_text = ', '.join(f"{c.mention} (`{c.id}`)" for c in criados) if criados else "Nenhum cargo criado"
        
        color_data = db.get_document("custom_colors")
        primary_color_hex = color_data.get("primary")
        
        container_kwargs = {}
        if primary_color_hex:
            primary_color = int(primary_color_hex.replace("#", ""), 16)
            container_kwargs["accent_colour"] = disnake.Colour(primary_color)

        return {"components": [
            disnake.ui.Container(
                disnake.ui.TextDisplay(f"# {emoji.z0}{emoji.z1}{emoji.z2}{emoji.z3}{emoji.z4}\n-# Painel > **Cargos**"),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay("**Cargos criados pelo bot:**"),
                disnake.ui.TextDisplay(criados_text),
                disnake.ui.Separator(),
                disnake.ui.ActionRow(
                    disnake.ui.Button(label="Criar todos os cargos", style=disnake.ButtonStyle.success, emoji=emoji.check, custom_id="Settings_CriarTodosCargos"),
                ),
                **container_kwargs
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(label="Voltar", style=disnake.ButtonStyle.grey, emoji=emoji.back, custom_id="Painel_Settings"),
            )
        ]}

    @staticmethod
    def _panel_embed(inter: disnake.MessageInteraction) -> dict:
        roles = inter.guild.roles
        config = db.get_document("config")
        cargos_config = config.get("cargos", {})
        
        criados = []
        for cargo_id, cargo_config in cargos_config.items():
            role = inter.guild.get_role(int(cargo_id))
            if role:
                criados.append(role)

        criados_text = ', '.join(f"{c.mention} (`{c.id}`)" for c in criados) if criados else "Nenhum cargo criado"
        
        color_data = db.get_document("custom_colors")
        primary_color_hex = color_data.get("primary")
        
        embed = disnake.Embed(
            title="Cargos criados pelo bot",
            description=criados_text
        )
        if primary_color_hex:
            primary_color = int(primary_color_hex.replace("#", ""), 16)
            embed.color = primary_color

        components = [
            disnake.ui.ActionRow(
                disnake.ui.Button(label="Criar todos os cargos", style=disnake.ButtonStyle.success, emoji=emoji.check, custom_id="Settings_CriarTodosCargos"),
                disnake.ui.Button(label="Voltar", style=disnake.ButtonStyle.grey, emoji=emoji.back, custom_id="Painel_Settings"),
            )
        ]
        return {"embed": embed, "components": components}


def setup(bot: commands.Bot):
    bot.add_cog(CriarTodosCargos(bot))