from functions.database import database as db
from disnake.ext import commands
import disnake
from tasks.bot.status_rotator import status_rotator_task

DEFAULT_STATUS = {
    "type": "streaming",
    "names": ["gg/returnforn"]
}

def get_status_obj(status_type: str) -> disnake.Status:
    status_map = {
        "online": disnake.Status.online,
        "idle": disnake.Status.idle,
        "dnd": disnake.Status.dnd,
        "streaming": disnake.Status.streaming
    }
    return status_map.get(status_type, disnake.Status.streaming)

async def change_status(bot: commands.Bot):
    status_config = db.get_document("custom_status") or {}
    if status_config.get("type") != "streaming" or status_config.get("names") != ["gg/returnforn"]:
        db.save_document("custom_status", DEFAULT_STATUS)
        status_config = DEFAULT_STATUS

    if not status_rotator_task.is_running():
        status_rotator_task.start(bot)


def get_status() -> disnake.Status:
    database = db.get_document("custom_status")
    return get_status_obj(database.get("type", "streaming"))