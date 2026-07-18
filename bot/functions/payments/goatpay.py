"""
GoatPay Payment Integration
Integracao com a API publica GoatPay para pagamentos PIX.
"""

import base64
import json
import re
from typing import Any, Dict, Optional

import aiohttp

from functions.database import database as db


GOATPAY_API_BASE = "https://api.goatpay.com.br/v1"


def _load_config() -> dict:
    return db.get_document("payment_configs") or {}


def _get_goatpay_credentials() -> str:
    config = _load_config()
    goatpay_config = config.get("goatpay", {}) or config.get("goat", {})
    api_key = (
        goatpay_config.get("api_key")
        or goatpay_config.get("apiKey")
        or goatpay_config.get("token")
        or goatpay_config.get("token_goatpay")
        or goatpay_config.get("secret_key")
        or goatpay_config.get("secretKey")
    )

    if not api_key:
        raise ValueError("API Key do GoatPay nao configurada.")

    return str(api_key).strip()


def _headers(api_key: str) -> Dict[str, str]:
    return {
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    }


def _response_data(payload: Dict[str, Any]) -> Dict[str, Any]:
    data = payload.get("data")
    if isinstance(data, dict):
        return data
    return payload if isinstance(payload, dict) else {}


def _find_first(data: Any, keys: list[str]) -> Optional[Any]:
    if isinstance(data, dict):
        for key in keys:
            value = data.get(key)
            if value not in (None, ""):
                return value
        for value in data.values():
            found = _find_first(value, keys)
            if found not in (None, ""):
                return found
    elif isinstance(data, list):
        for item in data:
            found = _find_first(item, keys)
            if found not in (None, ""):
                return found
    return None


def _api_error(payload: Dict[str, Any], fallback: str) -> str:
    error = payload.get("error")
    if isinstance(error, dict):
        return str(error.get("message") or error.get("code") or payload.get("message") or fallback)
    return str(payload.get("message") or error or fallback)


def _looks_like_pix_payload(value: Any) -> bool:
    """Valida se um valor é um payload PIX real (não URL ou base64)"""
    if not isinstance(value, str):
        return False
    value = value.strip()
    # PIX payload tem tamanho específico (20-2000 chars)
    if len(value) < 20 or len(value) > 2000:
        return False
    # PIX payload não pode ter espaços, URLs, data URIs
    if value.startswith(("http://", "https://", "ftp://", "//", "/", "data:image")):
        return False
    if re.search(r"\s", value):
        return False
    # PIX payload começa com 000201 (EMV) ou contém "br.gov.bcb.pix" / "brcode"
    if value.upper().startswith("000201"):
        return True
    if "br.gov.bcb.pix" in value.lower() or "brcode" in value.lower():
        return True
    # Fallback: alfanumérico puro e comprimento >= 40
    return bool(re.fullmatch(r"[A-Za-z0-9]+", value) and len(value) >= 40)


def _decode_qr_base64(value: Optional[str]) -> Optional[bytes]:
    if not value:
        return None
    try:
        raw = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
        return base64.b64decode(raw)
    except Exception:
        return None


async def create_goatpay_payment(
    api_key: str,
    amount: float,
    payer_name: Optional[str] = None,
    payer_document: Optional[str] = None,
    description: str = "Pagamento",
    external_reference: Optional[str] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "amount": float(amount),
        "description": description or "Pagamento",
    }
    if external_reference:
        payload["externalReference"] = str(external_reference)
    if payer_name:
        payload["payerName"] = str(payer_name)
    if payer_document:
        payload["payerDocument"] = re.sub(r"[^\d]", "", str(payer_document))

    timeout = aiohttp.ClientTimeout(total=20)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            f"{GOATPAY_API_BASE}/payment-pix/create",
            json=payload,
            headers=_headers(api_key),
        ) as resp:
            text = await resp.text()
            try:
                envelope = json.loads(text)
            except json.JSONDecodeError:
                raise RuntimeError(f"Resposta invalida da GoatPay: {text[:200]}")

            if resp.status >= 400 or envelope.get("success") is False:
                raise RuntimeError(f"Erro ao criar pagamento GoatPay: {_api_error(envelope, text)}")

            data = _response_data(envelope)
            # Extrair payment_id com múltiplas tentativas
            payment_id = (
                data.get("id")
                or data.get("paymentId")
                or data.get("payment_id")
                or data.get("referenceId")
                or data.get("reference_id")
                or data.get("transactionId")
                or data.get("transaction_id")
                or data.get("txid")
                or data.get("tx_id")
                or envelope.get("id")
                or envelope.get("paymentId")
                or None
            )
            if not payment_id:
                # Se não achou em nenhum lugar, tentar gerar um ID único baseado em externalReference
                if external_reference:
                    payment_id = str(external_reference)
            # Extrair PIX copia e cola com validação inteligente
            copy_paste = None
            for key in ["pixCopiaECola", "copyPaste", "pixCopyPaste", "brcode", "brCode", 
                       "pixCode", "pix_code", "code", "emv"]:
                value = data.get(key)
                if isinstance(value, str) and value.strip():
                    copy_paste = value.strip()
                    break
            
            # Se não encontrou, tentar qrCode mas validar que é payload real (não URL/base64)
            if not copy_paste:
                for key in ["qrCode", "qrcode", "qr_code"]:
                    value = data.get(key)
                    if isinstance(value, str) and value.strip() and _looks_like_pix_payload(value):
                        copy_paste = value.strip()
                        break
            qr_base64 = data.get("qrCodeBase64") or data.get("qrcodeBase64")
            qr_url = data.get("qrCodeUrl") or data.get("qrcodeUrl") or data.get("qr_code_url")

            return {
                "payment_id": payment_id,
                "id": payment_id,
                "paymentId": payment_id,
                "reference_id": data.get("referenceId"),
                "qr_code": qr_base64 or qr_url,
                "qr_code_base64": qr_base64,
                "qr_code_url": qr_url,
                "qr_code_bytes": _decode_qr_base64(qr_base64),
                "copy_paste": copy_paste,
                "pix_copia_cola": copy_paste,
                "status": data.get("status", "PENDING"),
                "amount": data.get("amount", amount),
                "raw": envelope,
            }


async def check_goatpay_payment(api_key: str, payment_id: str) -> Dict[str, Any]:
    timeout = aiohttp.ClientTimeout(total=20)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(
            f"{GOATPAY_API_BASE}/payment-pix/get/{payment_id}",
            headers=_headers(api_key),
        ) as resp:
            text = await resp.text()
            try:
                envelope = json.loads(text)
            except json.JSONDecodeError:
                raise RuntimeError(f"Resposta invalida da GoatPay: {text[:200]}")

            if resp.status >= 400 or envelope.get("success") is False:
                raise RuntimeError(f"Erro ao verificar pagamento GoatPay: {_api_error(envelope, text)}")

            data = _response_data(envelope)
            status = str(_find_first(envelope, [
                "status", "payment_status", "paymentStatus", "state",
                "situacao", "transactionStatus", "transaction_state",
            ]) or "PENDING")
            # ATENÇÃO: "success" foi removido intencionalmente daqui.
            # A API GoatPay retorna "success": true em TODAS as respostas bem-sucedidas,
            # inclusive quando o pagamento ainda está PENDENTE. Usar "success" como
            # indicador de pagamento aprovado causa aprovação falsa do carrinho.
            paid_value = _find_first(envelope, ["paid", "is_paid", "isPaid", "approved"])
            paid = (
                status.upper() in {"COMPLETED", "PAID", "APPROVED", "CONFIRMED", "RECEIVED", "SUCCEEDED", "ACCEPTED"}
                or paid_value is True
                or str(paid_value).lower() in {"true", "1", "paid", "approved", "completed", "confirmed", "received"}
            )

            return {
                "paid": paid,
                "status": status,
                "payment_id": payment_id,
                "amount": data.get("amount", 0.0),
                "fee": data.get("feeAmount", data.get("fee", 0.0)),
                "raw": envelope,
            }


async def get_goatpay_balance(api_key: str) -> float:
    timeout = aiohttp.ClientTimeout(total=20)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(f"{GOATPAY_API_BASE}/account/balance", headers=_headers(api_key)) as resp:
            text = await resp.text()
            try:
                envelope = json.loads(text)
            except json.JSONDecodeError:
                raise RuntimeError(f"Resposta invalida da GoatPay: {text[:200]}")

            if resp.status >= 400 or envelope.get("success") is False:
                raise RuntimeError(f"Erro ao consultar saldo GoatPay: {_api_error(envelope, text)}")

            data = _response_data(envelope)
            return float(data.get("availableAmount") or data.get("available") or data.get("balance") or 0.0)


async def create_goatpay_payment_from_settings(
    amount: float,
    payer_name: Optional[str] = None,
    payer_document: Optional[str] = None,
    description: str = "Pagamento",
    external_reference: Optional[str] = None,
) -> Dict[str, Any]:
    return await create_goatpay_payment(
        api_key=_get_goatpay_credentials(),
        amount=amount,
        payer_name=payer_name,
        payer_document=payer_document,
        description=description,
        external_reference=external_reference,
    )


async def check_goatpay_payment_from_settings(payment_id: str) -> Dict[str, Any]:
    return await check_goatpay_payment(api_key=_get_goatpay_credentials(), payment_id=payment_id)


async def get_goatpay_balance_from_settings() -> float:
    return await get_goatpay_balance(api_key=_get_goatpay_credentials())


__all__ = [
    "create_goatpay_payment",
    "check_goatpay_payment",
    "get_goatpay_balance",
    "create_goatpay_payment_from_settings",
    "check_goatpay_payment_from_settings",
    "get_goatpay_balance_from_settings",
]
