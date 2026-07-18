"""
Substituição do MongoDB por armazenamento JSON local.
Implementa a mesma interface do PyMongo Collection para compatibilidade total.
Os dados ficam salvos em database/local_db.json.
"""
import json
import os
import threading
import re

_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "database", "local_db")
os.makedirs(_DB_DIR, exist_ok=True)


class _LocalCollection:
    """
    Implementa find_one, find, insert_one, replace_one, update_one,
    delete_one, delete_many — mesma interface do PyMongo.
    Dados guardados em database/local_db/<collection_id>.json
    """

    def __init__(self, collection_id: str):
        self._file = os.path.join(_DB_DIR, f"{re.sub(r'[^a-zA-Z0-9_-]', '_', collection_id)}.json")
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ #
    # Helpers internos
    # ------------------------------------------------------------------ #
    def _load(self) -> dict:
        if not os.path.exists(self._file):
            return {}
        try:
            with open(self._file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}

    def _save(self, data: dict):
        with open(self._file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _match(self, document: dict, query: dict) -> bool:
        """Verifica se um documento satisfaz a query (suporte básico de igualdade e $exists)."""
        for key, value in query.items():
            if key == "_id":
                if document.get("_id") != value:
                    return False
            elif isinstance(value, dict):
                # Operadores simples
                doc_val = document.get(key)
                for op, op_val in value.items():
                    if op == "$exists":
                        if op_val and key not in document:
                            return False
                        if not op_val and key in document:
                            return False
                    elif op == "$eq":
                        if doc_val != op_val:
                            return False
                    elif op == "$ne":
                        if doc_val == op_val:
                            return False
            else:
                if document.get(key) != value:
                    return False
        return True

    # ------------------------------------------------------------------ #
    # API pública (mesma interface PyMongo)
    # ------------------------------------------------------------------ #
    def find_one(self, query: dict, projection: dict = None) -> dict | None:
        with self._lock:
            data = self._load()
            for doc in data.values():
                if self._match(doc, query):
                    result = dict(doc)
                    if projection:
                        result = {k: v for k, v in result.items()
                                  if k == "_id" or projection.get(k, 0)}
                    return result
        return None

    def find(self, query: dict = None, projection: dict = None):
        if query is None:
            query = {}
        with self._lock:
            data = self._load()
            results = []
            for doc in data.values():
                if self._match(doc, query):
                    result = dict(doc)
                    if projection:
                        result = {k: v for k, v in result.items()
                                  if k == "_id" or projection.get(k, 0)}
                    results.append(result)
        return results

    def insert_one(self, document: dict):
        with self._lock:
            data = self._load()
            doc_id = str(document.get("_id", f"_auto_{len(data)}"))
            doc = dict(document)
            doc["_id"] = doc_id
            data[doc_id] = doc
            self._save(data)

    def replace_one(self, query: dict, replacement: dict, upsert: bool = False):
        with self._lock:
            data = self._load()
            matched = False
            for key, doc in list(data.items()):
                if self._match(doc, query):
                    new_doc = dict(replacement)
                    new_doc["_id"] = doc["_id"]
                    data[key] = new_doc
                    matched = True
                    break
            if not matched and upsert:
                doc_id = str(replacement.get("_id", query.get("_id", f"_auto_{len(data)}")))
                new_doc = dict(replacement)
                new_doc["_id"] = doc_id
                data[doc_id] = new_doc
            self._save(data)

    def update_one(self, query: dict, update: dict, upsert: bool = False):
        with self._lock:
            data = self._load()
            matched = False
            for key, doc in list(data.items()):
                if self._match(doc, query):
                    if "$set" in update:
                        doc.update(update["$set"])
                    if "$unset" in update:
                        for field in update["$unset"]:
                            doc.pop(field, None)
                    if "$push" in update:
                        for field, val in update["$push"].items():
                            doc.setdefault(field, []).append(val)
                    if "$pull" in update:
                        for field, val in update["$pull"].items():
                            if isinstance(doc.get(field), list):
                                doc[field] = [x for x in doc[field] if x != val]
                    data[key] = doc
                    matched = True
                    break
            if not matched and upsert:
                doc_id = str(query.get("_id", f"_auto_{len(data)}"))
                new_doc = {"_id": doc_id}
                if "$set" in update:
                    new_doc.update(update["$set"])
                data[doc_id] = new_doc
            self._save(data)

    def delete_one(self, query: dict):
        with self._lock:
            data = self._load()
            for key, doc in list(data.items()):
                if self._match(doc, query):
                    del data[key]
                    break
            self._save(data)

    def delete_many(self, query: dict):
        with self._lock:
            data = self._load()
            to_delete = [key for key, doc in data.items() if self._match(doc, query)]
            for key in to_delete:
                del data[key]
            self._save(data)


# ------------------------------------------------------------------ #
# Lê config.json e configs/config_mongo.json para obter o bot_id
# ------------------------------------------------------------------ #
def _get_collection() -> _LocalCollection:
    import json as _json
    try:
        base = os.path.dirname(os.path.abspath(__file__))
        root = os.path.join(base, "..")
        with open(os.path.join(root, "config.json"), "r", encoding="utf-8") as f:
            cfg = _json.load(f)
        bot_id = cfg.get("botID", "default_bot")
    except Exception:
        bot_id = "default_bot"
    return _LocalCollection(bot_id)


collection = _get_collection()
