import disnake
from disnake.ext import commands
from functions.emoji import emoji
from functions.database import database as db
from functions.perms import perms
from functions.utils import utils


class ApproveCommand(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.slash_command(
        name="aprovar",
        description="[TESTE] Aprova manualmente o carrinho aberto de um usuário e faz entrega + log",
    )
    async def aprovar(
        self,
        inter: disnake.ApplicationCommandInteraction,
        usuario: disnake.User,
    ):
        """Aprova o carrinho aberto do usuário, dispara entrega automática, DM e log público."""

        # Apenas admins podem usar
        if not await perms.check(inter.user.id):
            await inter.response.send_message(
                f"{emoji.wrong} Você não tem permissão para usar este comando.",
                ephemeral=True,
            )
            return

        await inter.response.defer(ephemeral=True)

        # Buscar carrinho ativo do usuário (status cart ou pending)
        loja_data = db.get_document("loja_data") or {}
        carts = loja_data.get("carts", {})

        cart_id = None
        cart_found = None

        for cid, cart_info in carts.items():
            if not isinstance(cart_info, dict):
                continue
            uid = cart_info.get("user_id")
            status = cart_info.get("status", "")
            # Aceitar carrinhos que ainda não foram aprovados
            if (uid == usuario.id or str(uid) == str(usuario.id)) and status in ("cart", "pending"):
                cart_id = cid
                cart_found = cart_info
                break

        if not cart_found:
            await inter.edit_original_message(
                content=f"{emoji.wrong} Nenhum carrinho aberto encontrado para {usuario.mention}."
            )
            return

        # Importar e chamar o fluxo completo de aprovação do checkout
        # Isso dispara: entrega automática, atualização da thread, DM ao comprador e log público
        try:
            from modules.loja.cart.checkout import _handle_payment_approved
            await _handle_payment_approved(cart_id, self.bot)
        except Exception as e:
            import traceback
            traceback.print_exc()
            await inter.edit_original_message(
                content=f"{emoji.wrong} Erro ao processar aprovação: `{e}`"
            )
            return

        await inter.edit_original_message(
            content=(
                f"{emoji.correct} Carrinho de {usuario.mention} aprovado com sucesso!\n"
                f"-# Entrega, DM e log público foram disparados automaticamente."
            )
        )


def setup(bot: commands.Bot):
    bot.add_cog(ApproveCommand(bot))
