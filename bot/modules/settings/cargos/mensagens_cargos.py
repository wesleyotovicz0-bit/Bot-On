import random
import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message
from .listar import CARGOS_OPCOES, CARGOS_CORES
from .cog import ConfigurarCargos

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