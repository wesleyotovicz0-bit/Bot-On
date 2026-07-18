"""
Script de inicialização do bot.
Lê as variáveis de ambiente e configura os arquivos de config antes de iniciar o bot.
"""
import os
import json
import sys

def configure():
    token = os.environ.get("BOT_TOKEN", "")
    bot_id = os.environ.get("BOT_ID", "1409705328865705996")
    server_id = os.environ.get("SERVER_ID", "")
    owner_id = os.environ.get("OWNER_ID", "")
    mongo_url = os.environ.get("MONGO_URL", "local")  # "local" = sem MongoDB
    api_url = os.environ.get("API_URL", "https://server-forge-ai--Wssscripts.replit.app")

    if not token:
        print("[startup] ERRO: BOT_TOKEN não definido. Configure o secret BOT_TOKEN.")
        sys.exit(1)
    if not server_id:
        print("[startup] ERRO: SERVER_ID não definido. Configure o secret SERVER_ID com o ID do servidor Discord.")
        sys.exit(1)

    # Escreve config.json principal
    config = {
        "botID": bot_id,
        "botToken": token,
        "apiURL": api_url,
        "version": "0.0.3",
        "syncEmojis": True,
        "saveConfig": False,
        "startOnBackup": False,
        "bot": {
            "token": token,
            "owner": owner_id,
            "id": bot_id,
            "server": server_id
        }
    }
    with open("config.json", "w", encoding="utf-8") as f:
        json.dump(config, f, indent=4)
    print(f"[startup] config.json configurado (bot ID: {bot_id})")

    # Escreve configs/config_mongo.json
    os.makedirs("configs", exist_ok=True)
    mongo_config = {
        "mongoURL": mongo_url,
        "databaseName": "goatzpro"
    }
    with open("configs/config_mongo.json", "w", encoding="utf-8") as f:
        json.dump(mongo_config, f, indent=4)
    print("[startup] MongoDB configurado")

    # Escreve configs/config_api.json
    api_config = {
        "api": api_url,
        "cloud": api_url,
        "transcripts": api_url,
        "ia": api_url
    }
    with open("configs/config_api.json", "w", encoding="utf-8") as f:
        json.dump(api_config, f, indent=4)
    print("[startup] API URL configurada")

if __name__ == "__main__":
    configure()
    print("[startup] Iniciando bot...")
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    # Importa e roda o bot
    import subprocess
    result = subprocess.run([sys.executable, "bot.py"], cwd=os.path.dirname(os.path.abspath(__file__)))
    sys.exit(result.returncode)
