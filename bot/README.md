# ws Store Bot

Bot Discord completo para gerenciamento de servidor, vendas, tickets e muito mais.

---

## ⚙️ Configuração

### 1. Instale as dependências
```bash
pip install -r requirements.txt
```

### 2. Configure o arquivo `config.json`
Edite o arquivo `config.json` na raiz da pasta `bot/` com os seus dados:

```json
{
  "botID": "SEU_BOT_ID",
  "botToken": "SEU_BOT_TOKEN",
  "bot": {
    "token": "SEU_BOT_TOKEN",
    "owner": "SEU_DISCORD_USER_ID",
    "id": "SEU_BOT_ID",
    "server": "ID_DO_SEU_SERVIDOR_PRINCIPAL"
  }
}
```

Ou use o `startup.py` com variáveis de ambiente:

| Variável     | Descrição                              |
|-------------|----------------------------------------|
| `BOT_TOKEN` | Token do bot (Discord Developer Portal)|
| `BOT_ID`    | ID da aplicação Discord                |
| `OWNER_ID`  | Seu ID de usuário Discord              |
| `SERVER_ID` | ID do servidor principal               |

### 3. Inicie o bot
```bash
# Opção A — via startup.py (lê as variáveis de ambiente)
python startup.py

# Opção B — direto
python bot.py
```

---

## 🚀 Hospedagem

### Replit
- Faça upload do projeto
- Configure os Secrets com BOT_TOKEN, BOT_ID, OWNER_ID, SERVER_ID
- Rode `python startup.py`

### VPS / Servidor próprio (Linux)
```bash
# Instalar dependências
pip install -r requirements.txt

# Rodar em background com screen
screen -S wsstore
python startup.py
# Ctrl+A, D para sair sem fechar

# Ou com systemd — crie /etc/systemd/system/wsstore.service
```

### EternalHost / Hostinger / outros painéis
- Upload dos arquivos via FTP/File Manager
- Defina as variáveis de ambiente no painel
- Comando de inicialização: `python startup.py`

---

## 📁 Estrutura

```
bot/
├── startup.py          ← Ponto de entrada principal
├── bot.py              ← Inicialização do disnake
├── config.json         ← Configurações (gerado pelo startup.py)
├── commands/           ← Slash commands
├── events/             ← Eventos do Discord
├── modules/            ← Módulos: loja, tickets, customização
├── tasks/              ← Tasks em background
├── functions/          ← Utilitários: banco, pagamentos, emojis
├── core/               ← Bio, status, logs
├── assets/             ← Imagens e fontes
└── database/           ← Banco de dados local (JSON)
```

---

## 🔑 Permissões necessárias para o bot

No Discord Developer Portal, ative:
- **Privileged Intents:** Server Members Intent + Message Content Intent + Presence Intent
- **Bot Permissions:** Administrator (ou no mínimo: Manage Server, Manage Channels, Manage Roles, Manage Messages, Send Messages, Embed Links, Attach Files, Use Application Commands)

---

## 📝 Notas

- O banco de dados é local em JSON — os dados ficam em `database/local_db/`
- Para adicionar o bot a outros servidores, use o link de convite com permissão `Administrator`
- Os comandos são globais — aparecem em todos os servidores onde o bot for adicionado
