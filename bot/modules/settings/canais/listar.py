from functions.emoji import emoji

# Apenas canais básicos do sistema
CANAIS_OPCOES = [
    ("canal_de_logs_do_sistema",    "Logs do Sistema",      emoji.textc),
    ("canal_de_logs_de_entradas",   "Logs de Entradas",     emoji.textc),
    ("canal_de_logs_de_saidas",     "Logs de Saídas",       emoji.textc),
    ("canal_de_logs_de_pedidos",    "Logs de Pedidos",      emoji.textc),
    ("canal_de_notificacoes",       "Logs de Notificações", emoji.textc),
]

# Mapeamento: chave -> nome do canal no Discord (com emoji estilo 📂╺╸)
CANAIS_NOMES_DISCORD = {
    "canal_de_logs_do_sistema":    "📂╺╸ logs-sistema",
    "canal_de_logs_de_entradas":   "📂╺╸ logs-entradas",
    "canal_de_logs_de_saidas":     "📂╺╸ logs-saidas",
    "canal_de_logs_de_pedidos":    "📂╺╸ logs-pedidos",
    "canal_de_notificacoes":       "📂╺╸ logs-notificacoes",
}
