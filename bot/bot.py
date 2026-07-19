import sys
import os

# Fix para usar disnake local caso necessário
# Se você copiou a pasta disnake/ para o projeto, isso garante que ela seja usada
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import core
from functions.emojis import emojis
from functions.database import database
from functions.utils import utils
from functions.emoji import init_on_startup
from functions.plans import has_active_plan
from core.server_protection import apply_server_protection

bot, token, id = core.create_bot()

database.initialize_database_if_needed()
database.verify_and_create_missing_documents()

init_on_startup(token, id)

# Proteção de servidor
apply_server_protection(bot)

# ─── Check global de planos ─────────────────────────────────────────────────
# Executado antes de QUALQUER slash command.
# Servidor principal e DMs do owner passam sempre.
# Outros servidores precisam ter plano ativo em database/plans.json
@bot.slash_command_check
async def _plan_check(inter):
    # DM ou contexto sem guild — bloqueia (segurança)
    if inter.guild is None:
        return False

    guild_id = str(inter.guild_id)
    config = database.obter("config.json")
    main_server = str(config.get("bot", {}).get("server", ""))
    owner_id = str(config.get("bot", {}).get("owner", ""))

    # Servidor principal → sempre liberado
    if guild_id == main_server:
        return True

    # Owner usando o bot em qualquer servidor → liberado
    if str(inter.user.id) == owner_id:
        return True

    # Verificar plano ativo
    if has_active_plan(guild_id):
        return True

    # Sem plano → mensagem amigável e bloqueia
    await inter.response.send_message(
        "❌ **Este servidor não tem um plano ativo.**\n"
        "Entre em contato com o administrador do bot para adquirir um plano.",
        ephemeral=True,
    )
    return False

###########################################################

bot.load_extension("modules")
bot.load_extension("commands")
bot.load_extension("events")
bot.load_extension("tasks")

if __name__ == "__main__":
    core.change_bio()
    core.enable_intents(token, id)  # CORREÇÃO AQUI
    bot.run(token)