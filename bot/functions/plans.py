"""
Sistema de planos/licenças por servidor.
Permite vender o bot para múltiplos servidores com planos diferentes.
Dados salvos em database/plans.json
"""
import json
import os
import threading
from datetime import datetime
from typing import Optional

_PLANS_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "database", "plans.json"
)

_lock = threading.Lock()

# ────────────────────────────── I/O ──────────────────────────────

def _load() -> dict:
    if not os.path.exists(_PLANS_FILE):
        return {}
    try:
        with open(_PLANS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}

def _save(data: dict):
    os.makedirs(os.path.dirname(_PLANS_FILE), exist_ok=True)
    with open(_PLANS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# ────────────────────────────── API pública ──────────────────────

def has_active_plan(guild_id) -> bool:
    """Retorna True se o servidor tem um plano ativo."""
    with _lock:
        data = _load()
        entry = data.get(str(guild_id))
        if not entry:
            return False
        if not entry.get("ativo", False):
            return False
        # Verificar validade (se tiver data de expiração)
        validade = entry.get("validade")
        if validade:
            try:
                expiry = datetime.fromisoformat(validade)
                if datetime.now() > expiry:
                    return False
            except ValueError:
                pass
        return True

def get_plan(guild_id) -> Optional[dict]:
    """Retorna informações do plano do servidor, ou None se não tiver."""
    with _lock:
        data = _load()
        return data.get(str(guild_id))

def add_plan(guild_id, nome_plano: str, validade_iso: Optional[str] = None) -> dict:
    """Adiciona ou atualiza o plano de um servidor."""
    with _lock:
        data = _load()
        entry = {
            "plano": nome_plano,
            "ativo": True,
            "adicionado_em": datetime.now().isoformat(timespec="seconds"),
            "validade": validade_iso,   # None = vitalício
        }
        data[str(guild_id)] = entry
        _save(data)
        return entry

def remove_plan(guild_id) -> bool:
    """Remove o plano de um servidor. Retorna True se existia."""
    with _lock:
        data = _load()
        key = str(guild_id)
        if key not in data:
            return False
        del data[key]
        _save(data)
        return True

def suspend_plan(guild_id) -> bool:
    """Suspende (desativa sem remover) o plano de um servidor."""
    with _lock:
        data = _load()
        key = str(guild_id)
        if key not in data:
            return False
        data[key]["ativo"] = False
        _save(data)
        return True

def reactivate_plan(guild_id) -> bool:
    """Reativa um plano suspenso."""
    with _lock:
        data = _load()
        key = str(guild_id)
        if key not in data:
            return False
        data[key]["ativo"] = True
        _save(data)
        return True

def list_plans() -> list[dict]:
    """Lista todos os planos cadastrados."""
    with _lock:
        data = _load()
        result = []
        for guild_id, info in data.items():
            result.append({"guild_id": guild_id, **info})
        return result
