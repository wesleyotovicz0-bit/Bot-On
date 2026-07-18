"""
GoatPay Webhook Handler
Recebe notificações em tempo real da GoatPay via HTTP webhook.

O webhook secret (whsec_...) é configurado no painel da GoatPay
e usado para verificar a autenticidade das notificações.
"""

import asyncio
import hashlib
import hmac
import json
import logging
from typing import Optional, Callable

from aiohttp import web

from functions.database import database as db

logger = logging.getLogger(__name__)

# Porta padrão do servidor webhook
WEBHOOK_PORT = 8765

_app: Optional[web.Application] = None
_runner: Optional[web.AppRunner] = None
_bot = None
_payment_approved_callback: Optional[Callable] = None


def _get_webhook_secret() -> Optional[str]:
    """Carrega o webhook secret da GoatPay do banco de dados."""
    config = db.get_document("payment_configs") or {}
    goatpay = config.get("goatpay", {}) or config.get("goat", {})
    
    # Verificar possíveis localizações da chave secreta
    secret = (
        goatpay.get("webhook_secret")
        or goatpay.get("webhookSecret")
        or goatpay.get("whsec")
        or goatpay.get("whsec_secret")
    )
    
    # Se encontrou, retornar com tratamento de prefixo
    if secret:
        secret_str = str(secret).strip()
        # Remover prefixo "sha256=" se existir
        if secret_str.lower().startswith("sha256="):
            secret_str = secret_str[7:]
        return secret_str
    
    return None


def _verify_signature(body: bytes, signature: str, secret: str) -> bool:
    """Verifica assinatura HMAC-SHA256 do webhook da GoatPay."""
    try:
        # GoatPay usa HMAC-SHA256: signature = hmac(secret, body)
        expected = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()
        # Comparação segura contra timing attacks
        return hmac.compare_digest(expected, signature.lower().replace("sha256=", ""))
    except Exception as e:
        logger.warning(f"[GoatPay Webhook] Erro ao verificar assinatura: {e}")
        return False


async def _handle_webhook(request: web.Request) -> web.Response:
    """Handler principal do webhook da GoatPay."""
    try:
        body = await request.read()

        # Verificar assinatura se secret estiver configurado
        webhook_secret = _get_webhook_secret()
        if webhook_secret:
            signature = (
                request.headers.get("X-Webhook-Signature")
                or request.headers.get("X-GoatPay-Signature")
                or request.headers.get("X-Signature")
                or ""
            )
            if signature and not _verify_signature(body, signature, webhook_secret):
                logger.warning("[GoatPay Webhook] ❌ Assinatura inválida!")
                return web.Response(status=401, text="Invalid signature")

        # Parsear JSON
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            logger.warning("[GoatPay Webhook] Body não é JSON válido")
            return web.Response(status=400, text="Invalid JSON")

        logger.info(f"[GoatPay Webhook] 📦 Evento recebido: {data.get('event') or data.get('type') or 'unknown'}")

        # Extrair status e IDs
        event_type = (
            data.get("event")
            or data.get("type")
            or data.get("status")
            or ""
        ).lower()

        # Verificar se é evento de pagamento aprovado
        approved_events = {
            "payment.approved", "payment.paid", "payment.completed",
            "payment_approved", "payment_paid", "payment_completed",
            "paid", "approved", "completed", "confirmed"
        }

        is_approved = event_type in approved_events

        # Verificar pelo campo paid/status dentro do objeto
        if not is_approved:
            payment_obj = data.get("data") or data.get("payment") or data
            if isinstance(payment_obj, dict):
                status = str(payment_obj.get("status", "")).upper()
                paid = payment_obj.get("paid") or payment_obj.get("isPaid")
                if status in {"PAID", "APPROVED", "COMPLETED", "CONFIRMED"} or paid:
                    is_approved = True

        if is_approved:
            # Extrair payment_id
            payment_obj = data.get("data") or data.get("payment") or data
            if not isinstance(payment_obj, dict):
                payment_obj = data

            payment_id = (
                payment_obj.get("id")
                or payment_obj.get("paymentId")
                or payment_obj.get("payment_id")
                or payment_obj.get("transactionId")
                or payment_obj.get("externalReference")
                or data.get("id")
                or data.get("paymentId")
            )

            logger.info(f"[GoatPay Webhook] 💰 Pagamento aprovado! ID: {payment_id}")

            if payment_id and _payment_approved_callback:
                asyncio.create_task(
                    _payment_approved_callback({"payment_id": str(payment_id), **data})
                )

        return web.Response(status=200, text="OK")

    except Exception as e:
        logger.error(f"[GoatPay Webhook] ❌ Erro ao processar webhook: {e}")
        import traceback
        traceback.print_exc()
        return web.Response(status=500, text="Internal Server Error")


async def start_webhook_server(bot, payment_approved_callback: Callable, port: int = WEBHOOK_PORT):
    """Inicia o servidor HTTP para receber webhooks da GoatPay."""
    global _app, _runner, _bot, _payment_approved_callback

    _bot = bot
    _payment_approved_callback = payment_approved_callback

    _app = web.Application()
    _app.router.add_post("/webhook/goatpay", _handle_webhook)
    _app.router.add_post("/goatpay/webhook", _handle_webhook)  # rota alternativa
    _app.router.add_get("/health", lambda r: web.Response(text="OK"))  # health check

    _runner = web.AppRunner(_app)
    await _runner.setup()

    site = web.TCPSite(_runner, "0.0.0.0", port)
    await site.start()

    logger.info(f"[GoatPay Webhook] ✅ Servidor webhook iniciado na porta {port}")
    logger.info(f"[GoatPay Webhook] 📌 URL: http://0.0.0.0:{port}/webhook/goatpay")
    print(f"[GoatPay Webhook] ✅ Servidor iniciado na porta {port} — configure a URL do webhook no painel da GoatPay")


async def stop_webhook_server():
    """Para o servidor webhook."""
    global _runner
    if _runner:
        await _runner.cleanup()
        _runner = None
        logger.info("[GoatPay Webhook] Servidor encerrado")
