from functions.emoji import emoji
from functions.database import database as db
import requests

def change_bio():
    database = db.obter("config.json")
    token = database["bot"]["token"]
    id = database["bot"]["id"]

    description = (
        f"{emoji.z0}{emoji.z1}{emoji.z2}{emoji.z3}{emoji.z4} ws Store"
    )
    
    url = f"https://discord.com/api/v9/applications/{id}"
    headers = {
        "authorization": f"Bot {token}",
        "content-type": "application/json",
    }
    payload = {
        "description": description
    }

    requests.patch(url, headers=headers, json=payload)
    return