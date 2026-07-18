import disnake
from disnake.ext import commands
import os
import core
import asyncio
from datetime import datetime
from typing import Optional
from functions.utils import utils
from functions.database import database as db

class OnLoad(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self._checked_pending_carts = False
        self._websocket_initialized = False
        self._on_ready_processing = False
        self._last_ready_time = 0
        self._on_ready_once = False

    @commands.Cog.listener("on_ready")
    async def on_load(self):
        import time
        
        # Proteção contra execução duplicada do on_ready
        current_time = time.time()
        time_since_last_ready = current_time - self._last_ready_time
        
        # Se já executou uma vez, evitar reprocessar completamente
        if self._on_ready_once:
            return
        
        # Se já está processando ou foi chamado há menos de 5 segundos, ignorar
        if self._on_ready_processing or time_since_last_ready < 5:
            return
        
        self._on_ready_processing = True
        self._last_ready_time = current_time
        
        try:
            # os.system("cls") if os.name == "nt" else os.system("clear")
            try: servidor_principal = self.bot.get_guild(utils.obter_server_principal())
            except: servidor_principal = None

            print()
            print(f"Conectado em {self.bot.user.name} | {self.bot.user.id}")
            print(f"Servidores: {len(self.bot.guilds)}")
            for g in self.bot.guilds:
                print(f"  → {g.name} | ID: {g.id}")
            print(f"Usuários: {sum(len(guild.members) for guild in self.bot.guilds)}")
            print(f"Servidor principal: {servidor_principal.name}") if servidor_principal else print(f"    [ ! ] Servidor principal: Não encontrado (config tem: {db.obter('config.json').get('bot',{}).get('server','')})")
            print(f"Latência: {round(self.bot.latency * 1000)}ms")

            await core.change_status(self.bot)
            await core.log_restart(self.bot)

            # Inicializar WebSocket do Cloud apenas uma vez
            if not self._websocket_initialized:
                self._websocket_initialized = True
                asyncio.create_task(self._initialize_cloud_websocket())
                asyncio.create_task(self._initialize_boost_websocket())
                asyncio.create_task(self._initialize_payment_websocket())
                # ws Store webhook removido
            
            # Verificar carrinhos pendentes apenas uma vez
            if not self._checked_pending_carts:
                self._checked_pending_carts = True
                asyncio.create_task(self._check_pending_carts())
            
            # Marcar que já executou uma vez
            self._on_ready_once = True
        finally:
            # Liberar flag após um pequeno delay para evitar execuções muito próximas
            await asyncio.sleep(1)
            self._on_ready_processing = False
    
    async def _initialize_cloud_websocket(self):
        """Inicializa e mantém o WebSocket do Cloud conectado"""
        try:
            # Aguardar um pouco para garantir que o bot está totalmente pronto
            await asyncio.sleep(3)
            
            # Definir instância do bot globalmente
            from modules.cloud.update_api import set_bot_instance, get_websocket_manager, register_websocket_callbacks
            set_bot_instance(self.bot)
            
            # Obter configuração
            config = db.obter("configs/config_websocket.json")
            websocket_config = config.get("websocket_cloud", {})
            
            # Obter gerenciador WebSocket
            ws_manager = get_websocket_manager()
            ws_manager.set_bot(self.bot)
            
            # Registrar callbacks antes de conectar
            register_websocket_callbacks()
            
            # Verificar se já está conectado
            if ws_manager.is_connected():
                asyncio.create_task(self._websocket_health_check())
                return
            
            # Iniciar conexão em background
            await ws_manager.start()
            
            # Aguardar conexão ser estabelecida (máximo 10 segundos)
            for i in range(20):
                await asyncio.sleep(0.5)
                if ws_manager.is_connected():
                  #  print("[ZProCloud] ✅ Conectado com sucesso!")
                    await ws_manager.resend_bot_connected()
                    break
            else:
                pass
                #print("[ZProCloud] ⚠️ Conexão em andamento (background)")
            
            # Iniciar health check periódico
            asyncio.create_task(self._websocket_health_check())
            
        except Exception as e:
            #print(f"[ZProCloud] Erro: {e}")
            
            # Tentar novamente após 30 segundos
            await asyncio.sleep(30)
            asyncio.create_task(self._initialize_cloud_websocket())
    
    async def _initialize_boost_websocket(self):
        """Inicializa e mantém o WebSocket do Boost conectado"""
        try:
            # Aguardar um pouco para garantir que o bot está totalmente pronto
            await asyncio.sleep(5)
            
            from modules.settings.extensions.boost.websocket_manager import get_websocket_manager
            
            # Obter gerenciador WebSocket do Boost
            boost_ws_manager = get_websocket_manager()
            boost_ws_manager.set_bot(self.bot)
            
            # Verificar se já está conectado
            if boost_ws_manager.is_connected():
                print("[SyncBoost] ✅ Já conectado!")
                return
            
            # Iniciar conexão em background
            await boost_ws_manager.start()
            
            # Aguardar conexão ser estabelecida
            for i in range(20):
                await asyncio.sleep(0.5)
                if boost_ws_manager.is_connected():
                   # print("[SyncBoost] ✅ Conectado com sucesso!")
                    break
            else:
                pass
              #  print("[SyncBoost] ⚠️ Conexão em andamento (background)")
            
        except Exception as e:
            #print(f"[SyncBoost] Erro: {e}")
            
            # Tentar novamente após 30 segundos
            await asyncio.sleep(30)
            asyncio.create_task(self._initialize_boost_websocket())
    
    async def _initialize_payment_websocket(self):
        """Inicializa e mantém o WebSocket de Pagamentos conectado"""
        try:
            # Verificar se deve usar HTTP em vez de WebSocket
            import json
            import os
            try:
                config_path = os.path.join(os.path.dirname(__file__), '..', 'configs', 'config_socket.json')
                with open(config_path, 'r', encoding='utf-8') as f:
                    socket_config = json.load(f)
                use_websocket = socket_config.get('websocket', True)
            except:
                use_websocket = True
            
            if not use_websocket:
                print("[PaymentWS] ⚠️ WebSocket desabilitado (HTTP mode) - usando polling para pagamentos")
                # Iniciar polling de pagamentos em vez de WebSocket
                asyncio.create_task(self._payment_http_polling())
                return
            
            # Aguardar um pouco para garantir que o bot está totalmente pronto
            await asyncio.sleep(7)
            
            from functions.payments.websocket_client import initialize_ws_client, start_ws_client, get_ws_client
            
            # Inicializar cliente WebSocket
            ws_client = initialize_ws_client(self.bot)
            
            # Obter bot_id e bot_token
            bot_id = str(self.bot.user.id)
            bot_token = self.bot.http.token
            
            # Conectar e autenticar
            await start_ws_client(bot_id, bot_token)
            
            # Aguardar conexão ser estabelecida
            for i in range(20):
                await asyncio.sleep(0.5)
                if ws_client.is_connected():
                    print("[PaymentWS] ✅ Conectado à API de Pagamentos!")
                    break
            else:
                print("[PaymentWS] ⚠️ Conexão em andamento (background)")
            
            # Registrar callback para pagamentos aprovados
            from modules.loja.cart.checkout import _handle_payment_approved
            
            async def on_payment_approved(data):
                """Callback quando pagamento é aprovado via webhook"""
                try:
                    payment_id = (
                        data.get('payment_id') or
                        data.get('paymentId') or
                        data.get('id') or
                        data.get('transactionId') or
                        data.get('externalId')
                    )
                    cart_id = (
                        data.get('cart_id') or
                        data.get('cartId') or
                        data.get('cartID')
                    )
                    
                    print(f"[PaymentWS] 💰 Pagamento aprovado via webhook: {payment_id}")
                    
                    # Se não tem cart_id, buscar pelo payment_id
                    if not cart_id and payment_id:
                        print(f"[PaymentWS] 🔍 Buscando cart_id para payment_id: {payment_id}")
                        cart_id = await _find_cart_by_payment_id(payment_id)
                    
                    if cart_id:
                        print(f"[PaymentWS] ✅ Cart encontrado: {cart_id}")
                        # Processar aprovação do pagamento
                        await _handle_payment_approved(cart_id, self.bot)
                    else:
                        print(f"[PaymentWS] ⚠️ Cart ID não encontrado para payment_id: {payment_id}")
                        
                except Exception as e:
                    print(f"[PaymentWS] ❌ Erro ao processar pagamento aprovado: {e}")
                    import traceback
                    traceback.print_exc()
            
            async def _find_cart_by_payment_id(payment_id: str) -> Optional[str]:
                """Busca cart_id pelo payment_id"""
                try:
                    loja_data = db.get_document("loja_data")
                    carts = loja_data.get("carts", {})
                    
                    for cart_id, cart in carts.items():
                        # Verificar apenas carrinhos pendentes
                        if cart.get("status") != "pending":
                            continue
                        
                        payment_data = cart.get("payment_data", {})
                        
                        # Verificar na nova estrutura
                        provider_data = payment_data.get("provider", {})
                        if provider_data:
                            stored_ids = [
                                provider_data.get("payment_id"),
                                provider_data.get("correlation_id"),
                                provider_data.get("charge_id"),
                                provider_data.get("txid"),
                            ]
                            if payment_id in stored_ids:
                                return cart_id
                        
                        # Verificar na estrutura antiga
                        payment_ids = payment_data.get("payment_ids", {})
                        if payment_ids:
                            stored_ids = list(payment_ids.values())
                            if payment_id in stored_ids:
                                return cart_id
                        
                        # Verificar no raw
                        raw_data = payment_data.get("raw", {}) or provider_data.get("raw_response", {})
                        if raw_data:
                            raw_ids = [
                                raw_data.get("id"),
                                raw_data.get("paymentId"),
                                raw_data.get("payment_id"),
                                raw_data.get("transactionId"),
                                raw_data.get("txid"),
                                raw_data.get("externalId"),
                                raw_data.get("referenceId"),
                            ]
                            if payment_id in raw_ids:
                                return cart_id
                    
                    return None
                except Exception as e:
                    print(f"[PaymentWS] ❌ Erro ao buscar cart_id: {e}")
                    return None
            
            ws_client.set_payment_approved_callback(on_payment_approved)
            
        except Exception as e:
            print(f"[PaymentWS] ❌ Erro ao inicializar: {e}")
            import traceback
            traceback.print_exc()
            
            # Tentar novamente após 30 segundos
            await asyncio.sleep(30)
            asyncio.create_task(self._initialize_payment_websocket())
    
    async def _payment_http_polling(self):
        """Polling HTTP para verificar status de pagamentos (quando WebSocket está desabilitado)"""
        import aiohttp
        
        print("[PaymentWS-HTTP] 🔄 Iniciando polling HTTP para pagamentos...")
        
        poll_interval = 10  # Verificar a cada 10 segundos
        
        # Obter URL da API
        config_api = db.obter("configs/config_api.json") or {}
        api_url = config_api.get("api", "localhost:22222")
        if not api_url.startswith("http"):
            api_url = f"http://{api_url}"
        
        print(f"[PaymentWS-HTTP] 🌐 API URL: {api_url}")
        
        while True:
            try:
                await asyncio.sleep(poll_interval)
                
                # Obter carrinhos pendentes
                loja_data = db.get_document("loja_data")
                carts = loja_data.get("carts", {})
                
                pending_payments = []
                for cart_id, cart in carts.items():
                    if cart.get("status") == "pending":
                        payment_data = cart.get("payment_data", {})
                        provider_data = payment_data.get("provider", {})
                        payment_id = (
                            provider_data.get("payment_id") or 
                            provider_data.get("correlation_id") or
                            provider_data.get("charge_id") or
                            provider_data.get("txid")
                        )
                        if payment_id:
                            pending_payments.append({
                                "cart_id": cart_id,
                                "payment_id": payment_id,
                                "payment_method": cart.get("payment_method")
                            })
                
                # Verificar cada pagamento pendente via HTTP
                for payment in pending_payments:
                    try:
                        async with aiohttp.ClientSession() as session:
                            async with session.get(
                                f"{api_url}/api/payment/status",
                                params={"payment_id": payment["payment_id"]},
                                timeout=aiohttp.ClientTimeout(total=10)
                            ) as resp:
                                if resp.status == 200:
                                    data = await resp.json()
                                    status = data.get("status")
                                    paid = data.get("paid", False)
                                    status_lower = str(status).lower() if status else ""
                                    approved_statuses = {
                                        "approved", "paid", "completed", "concluida", "concluído", "pago",
                                        "aprovado", "succeeded", "accredited", "confirmed", "received"
                                    }
                                    if status_lower in approved_statuses or paid:
                                        print(f"[PaymentWS-HTTP] 💰 Pagamento aprovado: {payment['payment_id']} ({status})")
                                        from modules.loja.cart.checkout import _handle_payment_approved
                                        await _handle_payment_approved(payment["cart_id"], self.bot)
                                        
                    except Exception as e:
                        pass  # Silenciar erros de verificação individual
                        
            except Exception as e:
                print(f"[PaymentWS-HTTP] ❌ Erro no polling: {e}")
                await asyncio.sleep(30)  # Esperar mais em caso de erro
    
    async def _websocket_health_check(self):
        """Verifica periodicamente o status da conexão WebSocket e reconecta se necessário"""
        try:
            from modules.cloud.update_api import get_websocket_manager, register_websocket_callbacks
            
            check_interval = 30  # Verificar a cada 30 segundos
            consecutive_failures = 0
            max_consecutive_failures = 3
            
            while True:
                await asyncio.sleep(check_interval)
                
                try:
                    ws_manager = get_websocket_manager()
                    
                    if not ws_manager.is_connected():
                        consecutive_failures += 1
                        
                        if consecutive_failures >= max_consecutive_failures:
                            #print("[ZProCloud] Reconectando...")
                            
                            # Tentar parar conexão antiga
                            try:
                                await ws_manager.stop()
                                await asyncio.sleep(2)
                            except:
                                pass
                            
                            # Re-registrar callbacks
                            register_websocket_callbacks()
                            
                            # Tentar reconectar
                            await ws_manager.start()
                            await asyncio.sleep(3)
                            
                            if ws_manager.is_connected():
                                consecutive_failures = 0
                    else:
                        # Conexão OK
                        consecutive_failures = 0
                            
                except Exception as check_error:
                    consecutive_failures += 1
                    
        except Exception as e:
            pass
            #print(f"[ZProCloud] ❌ Erro no health check: {e}")

    async def _check_pending_carts(self):
        """Verifica todos os carrinhos pendentes, checa status dos pagamentos e reinicia monitoramento"""
        try:
            await asyncio.sleep(5)  # Aguardar um pouco para garantir que tudo está carregado
            
            loja_data = db.get_document("loja_data")
            carts = loja_data.get("carts", {})
            
            pending_count = 0
            approved_count = 0
            failed_count = 0
            
            for cart_id, cart in carts.items():
                status = cart.get("status", "cart")
                
                # Verificar apenas carrinhos em status "pending" (aguardando pagamento)
                if status == "pending":
                    payment_data = cart.get("payment_data", {})
                    
                    # Verificar se tem dados de pagamento
                    if payment_data:
                        # Tentar nova estrutura primeiro
                        provider_data = payment_data.get("provider", {})
                        payment_provider = provider_data.get("name") or payment_data.get("payment_provider")
                        
                        # Extrair payment_id
                        payment_id = None
                        if provider_data:
                            payment_id = (
                                provider_data.get("payment_id") or 
                                provider_data.get("correlation_id") or
                                provider_data.get("charge_id") or
                                provider_data.get("txid")
                            )
                        
                        # Fallback para estrutura antiga
                        if not payment_id:
                            payment_ids = payment_data.get("payment_ids", {})
                            if payment_ids:
                                payment_id = (
                                    payment_ids.get("payment_id") or
                                    payment_ids.get("id") or
                                    payment_ids.get("txid") or
                                    payment_ids.get("payment_intent")
                                )
                        
                        # Tentar extrair do raw se ainda não encontrou
                        if not payment_id:
                            raw_data = payment_data.get("raw", {}) or provider_data.get("raw_response", {})
                            if raw_data:
                                payment_id = (
                                    raw_data.get("transactionId") or
                                    raw_data.get("paymentId") or
                                    raw_data.get("payment_id") or
                                    raw_data.get("id") or
                                    raw_data.get("txid") or
                                    raw_data.get("externalId")
                                )
                        
                        payment_method = cart.get("payment_method")
                        is_free_purchase = cart.get("is_free_purchase", False)
                        
                        # Se tem payment_id e não é compra gratuita, verificar status imediatamente
                        if payment_id and not is_free_purchase and payment_method:
                            try:
                                from modules.loja.cart.checkout import _check_single_payment_status, _handle_payment_approved
                                
                                # Verificar status do pagamento
                                is_finished, final_status = await _check_single_payment_status(
                                    cart_id=cart_id,
                                    payment_id=payment_id,
                                    payment_method=payment_method,
                                    payment_provider=payment_provider,
                                    bot=self.bot
                                )
                                
                                if is_finished:
                                    if final_status == "approved":
                                        # Pagamento aprovado - processar imediatamente
                                        print(f"[Cart Monitor] ✅ Pagamento aprovado para carrinho {cart_id}, processando...")
                                        await _handle_payment_approved(cart_id, self.bot)
                                        approved_count += 1
                                    else:
                                        # Pagamento falhou - atualizar status
                                        print(f"[Cart Monitor] ❌ Pagamento falhou para carrinho {cart_id}: {final_status}")
                                        cart["status"] = final_status
                                        cart["updated_at"] = int(datetime.utcnow().timestamp())
                                        loja_data["carts"][cart_id] = cart
                                        db.save_document("loja_data", loja_data)
                                        failed_count += 1
                                else:
                                    # Ainda pendente - reiniciar monitoramento
                                    print(f"[Cart Monitor] ⏳ Pagamento ainda pendente para carrinho {cart_id}, reiniciando monitoramento...")
                                    
                                    # Extrair payment_ids para o monitoramento
                                    from modules.loja.cart.checkout import _extract_payment_ids
                                    payment_ids_dict = {}
                                    if provider_data:
                                        if provider_data.get("payment_id"):
                                            payment_ids_dict["payment_id"] = provider_data.get("payment_id")
                                        if provider_data.get("correlation_id"):
                                            payment_ids_dict["correlationID"] = provider_data.get("correlation_id")
                                        if provider_data.get("charge_id"):
                                            payment_ids_dict["charge_id"] = provider_data.get("charge_id")
                                        if provider_data.get("txid"):
                                            payment_ids_dict["txid"] = provider_data.get("txid")
                                    
                                    if not payment_ids_dict and raw_data:
                                        payment_ids_dict = _extract_payment_ids(raw_data)
                                    
                                    if payment_ids_dict:
                                        from modules.loja.cart.checkout import _monitor_payment
                                        asyncio.create_task(_monitor_payment(cart_id, payment_method, payment_ids_dict, payment_provider, self.bot))
                                        try:
                                            from functions.payments.websocket_client import get_ws_client
                                            ws_client = get_ws_client()
                                            if ws_client and ws_client.is_connected():
                                                watch_id = (
                                                    payment_ids_dict.get("payment_id") or
                                                    payment_ids_dict.get("paymentId") or
                                                    payment_ids_dict.get("id") or
                                                    payment_ids_dict.get("transactionId") or
                                                    payment_ids_dict.get("txid")
                                                )
                                                if watch_id:
                                                    asyncio.create_task(ws_client.watch_payment(watch_id))
                                        except Exception:
                                            pass
                                        pending_count += 1
                                    
                            except Exception as e:
                                print(f"[Cart Monitor] Erro ao verificar carrinho {cart_id}: {e}")
                                import traceback
                                traceback.print_exc()
                                
                                # Mesmo com erro, tentar reiniciar monitoramento
                                try:
                                    from modules.loja.cart.checkout import _extract_payment_ids, _monitor_payment
                                    raw_data = payment_data.get("raw", {}) or provider_data.get("raw_response", {})
                                    payment_ids_dict = _extract_payment_ids(raw_data) if raw_data else {}
                                    if payment_ids_dict:
                                        asyncio.create_task(_monitor_payment(cart_id, payment_method, payment_ids_dict, payment_provider, self.bot))
                                        pending_count += 1
                                except:
                                    pass
            
          #  print(f"[Cart Monitor] Verificação concluída: Aprovados: {approved_count} | Falhados: {failed_count} | Ainda pendentes: {pending_count}")
        except Exception as e:
           # print(f"[Cart Monitor] Erro ao verificar carrinhos pendentes: {e}")
            import traceback
            traceback.print_exc()

    async def _initialize_goatpay_webhook(self):
        """Inicia servidor HTTP para receber webhooks da ws Store em tempo real."""
        try:
            await asyncio.sleep(3)

            from functions.payments.goatpay_webhook import start_webhook_server
            from modules.loja.cart.checkout import _handle_payment_approved

            # Buscar cart_id pelo payment_id e processar aprovação
            async def on_goatpay_payment_approved(data: dict):
                payment_id = (
                    data.get("payment_id")
                    or data.get("paymentId")
                    or data.get("id")
                )
                if not payment_id:
                    return

                print(f"[ws Store Webhook] 💰 Processando pagamento aprovado: {payment_id}")

                loja_data = db.get_document("loja_data")
                carts = loja_data.get("carts", {})

                cart_id = None
                for cid, cart in carts.items():
                    if cart.get("status") != "pending":
                        continue
                    payment_data = cart.get("payment_data", {})
                    provider = payment_data.get("provider", {})
                    raw = provider.get("raw_response", {}) or payment_data.get("raw", {})

                    stored = [
                        provider.get("payment_id"),
                        provider.get("txid"),
                        provider.get("charge_id"),
                        str(raw.get("id", "")),
                        str(raw.get("paymentId", "")),
                        str(raw.get("referenceId", "")),
                    ]
                    if str(payment_id) in stored:
                        cart_id = cid
                        break

                if cart_id:
                    print(f"[ws Store Webhook] ✅ Carrinho encontrado: {cart_id}")
                    await _handle_payment_approved(cart_id, self.bot)
                else:
                    print(f"[ws Store Webhook] ⚠️ Carrinho não encontrado para payment_id: {payment_id}")

            # Porta configurável (padrão 8765)
            port = 8765
            try:
                import json, os
                cfg_path = os.path.join(os.path.dirname(__file__), '..', 'configs', 'config_api.json')
                with open(cfg_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                port = int(cfg.get("webhook_port", 8765))
            except Exception:
                pass

            await start_webhook_server(self.bot, on_goatpay_payment_approved, port=port)

        except Exception as e:
            print(f"[ws Store Webhook] ❌ Erro ao iniciar servidor: {e}")
            import traceback
            traceback.print_exc()

def setup(bot: commands.Bot):
    bot.add_cog(OnLoad(bot))