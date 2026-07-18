"""
Comando /separar — Envia painel de separador de login em um canal.
Permite configurar thumbnail e título antes de enviar.
Ao clicar em "Separar Login", o usuário cola os logins num modal
e recebe os dados separados em ephemeral.
"""

import disnake
from disnake.ext import commands
from functions.emoji import emoji
from functions.database import database as db
from functions.perms import perms
from functions.utils import utils


# Chave usada para persistir config do separador
_CONFIG_KEY = "separar_config"

PANEL_IMAGE_DEFAULT = None  # sem thumbnail por padrão


def _load_config() -> dict:
    return db.get_document(_CONFIG_KEY) or {}


def _save_config(data: dict):
    db.save_document(_CONFIG_KEY, data)


def _parse_logins(raw: str) -> list[dict]:
    """
    Separa cada linha em partes divididas por ':'.
    Retorna lista de dicts com as partes nomeadas.
    """
    results = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(":")
        entry = {"raw": line, "parts": parts}
        # Tentar nomear as partes por posição
        labels = ["Email", "Senha", "Token", "Senha DC", "Senha Site", "Extra"]
        named = {}
        for i, part in enumerate(parts):
            label = labels[i] if i < len(labels) else f"Campo {i+1}"
            named[label] = part.strip()
        entry["named"] = named
        results.append(entry)
    return results


def _build_panel(thumbnail_url: str | None, title: str, description: str) -> tuple[list, str]:
    """
    Constrói o container do painel de separador de login.
    Retorna (components, flags_needed)
    """
    container_items = [
        disnake.ui.TextDisplay(f"**{title}**\n-# {description}"),
        disnake.ui.Separator(),
        disnake.ui.TextDisplay(
            f"-# Como funciona\n"
            f"Cole o login recebido no botão abaixo e o bot separa automaticamente cada informação em blocos individuais."
        ),
        disnake.ui.Separator(),
        disnake.ui.TextDisplay(
            f"-# Formatos suportados\n"
            f"`EMAIL:SENHA`\n"
            f"`EMAIL:SENHA:TOKEN`\n"
            f"`EMAIL:SENHADC:SENHASITE:TOKEN`"
        ),
        disnake.ui.Separator(),
        disnake.ui.TextDisplay(
            f"-# Privacidade\n"
            f"O resultado é enviado apenas para quem clicou no botão, em mensagem privada/ephemeral."
        ),
    ]

    # Thumbnail (se configurada)
    if thumbnail_url:
        container_items.insert(0, disnake.ui.MediaGallery(
            disnake.MediaGalleryItem(media=thumbnail_url)
        ))
        container_items.insert(1, disnake.ui.Separator())

    components = [
        disnake.ui.Container(*container_items),
        disnake.ui.ActionRow(
            disnake.ui.Button(
                label="Separar Login",
                style=disnake.ButtonStyle.grey,
                custom_id="separar_login_btn"
            )
        )
    ]
    return components


class SepararLoginModal(disnake.ui.Modal):
    """Modal para o usuário colar os logins."""

    def __init__(self):
        super().__init__(
            title="Separar Login",
            custom_id="separar_login_modal",
            components=[
                disnake.ui.TextInput(
                    label="Logins",
                    custom_id="logins_input",
                    style=disnake.TextInputStyle.paragraph,
                    placeholder="email:senha\nemail:senha:token\nemail:senhadc:senhasite:token",
                    required=True,
                    max_length=4000,
                )
            ]
        )

    async def callback(self, inter: disnake.ModalInteraction):
        raw = inter.text_values.get("logins_input", "").strip()
        if not raw:
            await inter.response.send_message(
                f"{emoji.wrong} Nenhum login fornecido.",
                ephemeral=True
            )
            return

        parsed = _parse_logins(raw)
        if not parsed:
            await inter.response.send_message(
                f"{emoji.wrong} Não foi possível separar os logins. Verifique o formato.",
                ephemeral=True
            )
            return

        # Montar resultado em container
        result_items = [
            disnake.ui.TextDisplay(f"✅ **{len(parsed)} login(s) separado(s)**"),
            disnake.ui.Separator(),
        ]

        for i, entry in enumerate(parsed, 1):
            named = entry["named"]
            lines = "\n".join(f"-# **{k}:** `{v}`" for k, v in named.items())
            result_items.append(
                disnake.ui.TextDisplay(f"**#{i}**\n{lines}")
            )
            if i < len(parsed):
                result_items.append(disnake.ui.Separator())

        components = [disnake.ui.Container(*result_items)]

        await inter.response.send_message(
            components=components,
            flags=disnake.MessageFlags(is_components_v2=True, ephemeral=True)
        )


class SepararConfigModal(disnake.ui.Modal):
    """Modal para configurar o painel de separador antes de enviar."""

    def __init__(self, channel_id: int):
        self.channel_id = channel_id
        cfg = _load_config()
        super().__init__(
            title="Configurar Separador de Login",
            custom_id=f"separar_config_modal:{channel_id}",
            components=[
                disnake.ui.TextInput(
                    label="Título",
                    custom_id="titulo",
                    style=disnake.TextInputStyle.short,
                    placeholder="SEPARADOR DE LOGIN",
                    value=cfg.get("titulo", "SEPARADOR DE LOGIN"),
                    required=True,
                    max_length=100,
                ),
                disnake.ui.TextInput(
                    label="Descrição",
                    custom_id="descricao",
                    style=disnake.TextInputStyle.short,
                    placeholder="Organize os dados da conta de forma rápida, limpa e segura.",
                    value=cfg.get("descricao", "Organize os dados da conta de forma rápida, limpa e segura."),
                    required=True,
                    max_length=200,
                ),
                disnake.ui.TextInput(
                    label="URL da Thumbnail (opcional)",
                    custom_id="thumbnail",
                    style=disnake.TextInputStyle.short,
                    placeholder="https://... (deixe vazio para sem imagem)",
                    value=cfg.get("thumbnail", ""),
                    required=False,
                    max_length=500,
                ),
            ]
        )

    async def callback(self, inter: disnake.ModalInteraction):
        titulo = inter.text_values.get("titulo", "SEPARADOR DE LOGIN").strip()
        descricao = inter.text_values.get("descricao", "").strip()
        thumbnail = inter.text_values.get("thumbnail", "").strip() or None

        # Validar URL da thumbnail
        if thumbnail and not thumbnail.startswith(("http://", "https://")):
            await inter.response.send_message(
                f"{emoji.wrong} URL da thumbnail inválida. Use `https://...`",
                ephemeral=True
            )
            return

        # Salvar config
        _save_config({
            "titulo": titulo,
            "descricao": descricao,
            "thumbnail": thumbnail,
        })

        # Enviar painel no canal
        channel = inter.guild.get_channel(self.channel_id)
        if not channel:
            await inter.response.send_message(
                f"{emoji.wrong} Canal não encontrado.",
                ephemeral=True
            )
            return

        components = _build_panel(thumbnail, titulo, descricao)
        await channel.send(
            components=components,
            flags=disnake.MessageFlags(is_components_v2=True)
        )

        await inter.response.send_message(
            f"{emoji.correct} Painel de separador enviado em {channel.mention}!",
            ephemeral=True
        )


class SepararCommand(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.slash_command(
        name="separar",
        description="Envia o painel de separador de login em um canal",
    )
    async def separar(
        self,
        inter: disnake.ApplicationCommandInteraction,
        canal: disnake.TextChannel = commands.Param(description="Canal onde o painel será enviado"),
    ):
        """Configura e envia o painel de separador de login."""
        if not await perms.check(inter.user.id):
            await inter.response.send_message(
                f"{emoji.wrong} Você não tem permissão para usar este comando.",
                ephemeral=True
            )
            return

        # Abrir modal de configuração
        modal = SepararConfigModal(channel_id=canal.id)
        await inter.response.send_modal(modal)

    @commands.Cog.listener("on_button_click")
    async def on_separar_button(self, inter: disnake.MessageInteraction):
        if inter.component.custom_id != "separar_login_btn":
            return
        # Abrir modal para o usuário colar os logins
        await inter.response.send_modal(SepararLoginModal())


def setup(bot: commands.Bot):
    bot.add_cog(SepararCommand(bot))
