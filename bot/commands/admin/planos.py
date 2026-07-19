"""
Comandos de gerenciamento de planos (somente owner do bot).
/plano adicionar  — adiciona servidor com plano
/plano remover    — remove plano de um servidor
/plano suspender  — suspende sem remover
/plano reativar   — reativa plano suspenso
/plano listar     — lista todos os planos
/plano info       — info de um servidor específico
"""
import disnake
from disnake.ext import commands
from datetime import datetime

from functions.perms import perms
from functions.message import message
from functions import plans as plans_mod


PLANOS_DISPONIVEIS = ["basic", "premium", "vip", "lifetime"]


class PlanosCommand(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ─────────────────────── Grupo principal ───────────────────────
    @commands.slash_command(name="plano", description="Gerenciamento de planos por servidor.")
    async def plano(self, inter: disnake.ApplicationCommandInteraction):
        pass

    # ─────────────────────── /plano adicionar ──────────────────────
    @plano.sub_command(
        name="adicionar",
        description="Adiciona um plano a um servidor (owner only).",
    )
    async def adicionar(
        self,
        inter: disnake.ApplicationCommandInteraction,
        server_id: str = commands.Param(description="ID do servidor Discord"),
        plano: str = commands.Param(
            description="Tipo de plano",
            choices=PLANOS_DISPONIVEIS,
        ),
        validade: str = commands.Param(
            description="Data de validade (AAAA-MM-DD) — deixe em branco para vitalício",
            default=None,
        ),
    ):
        if not await perms.check_owner(inter.user.id):
            return await message.missing_perms(inter)

        # Validar server_id
        if not server_id.strip().isdigit():
            return await inter.response.send_message(
                "❌ ID de servidor inválido. Use somente números.", ephemeral=True
            )

        # Validar data opcional
        validade_iso = None
        if validade:
            try:
                validade_iso = datetime.strptime(validade.strip(), "%Y-%m-%d").date().isoformat()
            except ValueError:
                return await inter.response.send_message(
                    "❌ Data inválida. Use o formato `AAAA-MM-DD` (ex: 2026-12-31).", ephemeral=True
                )

        entry = plans_mod.add_plan(server_id.strip(), plano, validade_iso)

        # Tentar buscar nome do servidor
        guild = self.bot.get_guild(int(server_id))
        guild_name = guild.name if guild else f"ID {server_id}"

        val_str = validade_iso if validade_iso else "Vitalício"
        embed = disnake.Embed(
            title="✅ Plano adicionado",
            color=0x2ECC71,
        )
        embed.add_field(name="Servidor", value=f"{guild_name}", inline=True)
        embed.add_field(name="Plano", value=plano.upper(), inline=True)
        embed.add_field(name="Validade", value=val_str, inline=True)
        embed.set_footer(text=f"ID: {server_id}")
        await inter.response.send_message(embed=embed, ephemeral=True)

    # ─────────────────────── /plano remover ────────────────────────
    @plano.sub_command(
        name="remover",
        description="Remove o plano de um servidor (owner only).",
    )
    async def remover(
        self,
        inter: disnake.ApplicationCommandInteraction,
        server_id: str = commands.Param(description="ID do servidor Discord"),
    ):
        if not await perms.check_owner(inter.user.id):
            return await message.missing_perms(inter)

        removed = plans_mod.remove_plan(server_id.strip())
        if removed:
            await inter.response.send_message(
                f"🗑️ Plano do servidor `{server_id}` removido com sucesso.", ephemeral=True
            )
        else:
            await inter.response.send_message(
                f"⚠️ Nenhum plano encontrado para o servidor `{server_id}`.", ephemeral=True
            )

    # ─────────────────────── /plano suspender ──────────────────────
    @plano.sub_command(
        name="suspender",
        description="Suspende temporariamente o plano de um servidor (owner only).",
    )
    async def suspender(
        self,
        inter: disnake.ApplicationCommandInteraction,
        server_id: str = commands.Param(description="ID do servidor Discord"),
    ):
        if not await perms.check_owner(inter.user.id):
            return await message.missing_perms(inter)

        ok = plans_mod.suspend_plan(server_id.strip())
        if ok:
            await inter.response.send_message(
                f"⏸️ Plano do servidor `{server_id}` suspenso.", ephemeral=True
            )
        else:
            await inter.response.send_message(
                f"⚠️ Nenhum plano encontrado para o servidor `{server_id}`.", ephemeral=True
            )

    # ─────────────────────── /plano reativar ───────────────────────
    @plano.sub_command(
        name="reativar",
        description="Reativa um plano suspenso (owner only).",
    )
    async def reativar(
        self,
        inter: disnake.ApplicationCommandInteraction,
        server_id: str = commands.Param(description="ID do servidor Discord"),
    ):
        if not await perms.check_owner(inter.user.id):
            return await message.missing_perms(inter)

        ok = plans_mod.reactivate_plan(server_id.strip())
        if ok:
            await inter.response.send_message(
                f"▶️ Plano do servidor `{server_id}` reativado.", ephemeral=True
            )
        else:
            await inter.response.send_message(
                f"⚠️ Nenhum plano encontrado para o servidor `{server_id}`.", ephemeral=True
            )

    # ─────────────────────── /plano listar ─────────────────────────
    @plano.sub_command(
        name="listar",
        description="Lista todos os servidores com plano (owner only).",
    )
    async def listar(self, inter: disnake.ApplicationCommandInteraction):
        if not await perms.check_owner(inter.user.id):
            return await message.missing_perms(inter)

        all_plans = plans_mod.list_plans()

        if not all_plans:
            return await inter.response.send_message(
                "📭 Nenhum servidor com plano cadastrado ainda.", ephemeral=True
            )

        embed = disnake.Embed(
            title=f"📋 Planos Cadastrados ({len(all_plans)})",
            color=0x5865F2,
        )

        for entry in all_plans[:20]:  # max 20 para não estourar embed
            guild_id = entry["guild_id"]
            guild = self.bot.get_guild(int(guild_id))
            nome = guild.name if guild else f"Servidor {guild_id}"

            status = "✅ Ativo" if entry.get("ativo") else "⏸️ Suspenso"
            val = entry.get("validade") or "Vitalício"
            embed.add_field(
                name=f"{nome}",
                value=f"Plano: **{entry.get('plano','?').upper()}**\n"
                      f"Status: {status}\nValidade: {val}\nID: `{guild_id}`",
                inline=True,
            )

        if len(all_plans) > 20:
            embed.set_footer(text=f"Mostrando 20 de {len(all_plans)} servidores.")

        await inter.response.send_message(embed=embed, ephemeral=True)

    # ─────────────────────── /plano info ───────────────────────────
    @plano.sub_command(
        name="info",
        description="Mostra o plano de um servidor específico (owner only).",
    )
    async def info(
        self,
        inter: disnake.ApplicationCommandInteraction,
        server_id: str = commands.Param(description="ID do servidor Discord"),
    ):
        if not await perms.check_owner(inter.user.id):
            return await message.missing_perms(inter)

        entry = plans_mod.get_plan(server_id.strip())
        if not entry:
            return await inter.response.send_message(
                f"⚠️ Servidor `{server_id}` não tem plano cadastrado.", ephemeral=True
            )

        guild = self.bot.get_guild(int(server_id))
        nome = guild.name if guild else f"ID {server_id}"
        ativo = plans_mod.has_active_plan(server_id)

        embed = disnake.Embed(
            title=f"📄 Plano — {nome}",
            color=0x2ECC71 if ativo else 0xE74C3C,
        )
        embed.add_field(name="Plano", value=entry.get("plano", "?").upper(), inline=True)
        embed.add_field(name="Status", value="✅ Ativo" if ativo else "⏸️ Suspenso/Expirado", inline=True)
        embed.add_field(name="Validade", value=entry.get("validade") or "Vitalício", inline=True)
        embed.add_field(name="Adicionado em", value=entry.get("adicionado_em", "?"), inline=True)
        embed.set_footer(text=f"Server ID: {server_id}")
        await inter.response.send_message(embed=embed, ephemeral=True)


def setup(bot: commands.Bot):
    bot.add_cog(PlanosCommand(bot))
