"""
Telegram Bot - Shopee Video Downloader
Bot que recebe links da Shopee e envia o vídeo sem marca d'água
"""

import os
import telebot
from telebot import types
from shopee_service import ShopeeDownloader
from database import UserManager
from payment_service import PaymentService

# ============================================================
# CONFIGURAÇÃO - Substitua pelo seu token do BotFather
# ============================================================
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "SEU_TOKEN_AQUI")

# Inicializa componentes
bot = telebot.TeleBot(BOT_TOKEN)
downloader = ShopeeDownloader(output_dir="output_video")
user_manager = UserManager()
payment_service = PaymentService()

def send_payment_options(message, reason="limit_reached"):
    """
    Envia as opções de pagamento (Pix) e botões.
    """
    chat_id = message.chat.id
    user_id = message.from_user.id
    
    # Mensagem inicial
    msg_header = ""
    if reason == "limit_reached":
        msg_header = "🚫 *O seu limite diário gratuito acabou!*"
    elif reason == "expired":
        msg_header = "⚠️ *O seu plano Premium venceu!*"
    else:
        msg_header = "💎 *Plano Premium (Ilimitado)*"

    bot.send_message(
        chat_id,
        f"{msg_header}\n\n"
        "Renove agora para continuar baixando vídeos ilimitadamente e sem filas!",
        parse_mode="Markdown"
    )

    # Gera Pagamento Pix
    payment_data = payment_service.create_pix_payment(user_id)
    payment_id = payment_data['payment_id']
    pix_code = payment_data['pix_copy_paste']

    # Mensagem com Código Pix
    pix_msg = (
        "Seu código pix (Ilimitado - 30 Dias)\n"
        "Clique abaixo para copiar:\n\n"
        f"`{pix_code}`\n\n"
        "⚠️ _A PUSHIN PAY atua apenas como processadora de pagamentos._"
    )

    # Botões
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_check = types.InlineKeyboardButton("✅ Verificar Pagamento", callback_data=f"check_pay_{payment_id}")
    btn_support = types.InlineKeyboardButton("💬 Suporte", url="https://t.me/seusuporte") # Placeholder
    markup.add(btn_check, btn_support)

    bot.send_message(chat_id, pix_msg, parse_mode="Markdown", reply_markup=markup)


@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    """Responde ao comando /start e /help."""
    welcome_text = """
🛒 *Shopee Video Downloader Bot*

Envie um link de vídeo da Shopee e eu baixo para você sem marca d'água!

*Comandos:*
/plano - Ver status do plano ou assinar Premium
/ilimitado - Assinar plano Ilimitado (Premium)

*Links suportados:*
• shopee.com.br
• shp.ee
• sv.shopee.com.br

_Bot desenvolvido para fins educacionais._
    """
    bot.reply_to(message, welcome_text, parse_mode="Markdown")


@bot.message_handler(commands=['plano', 'ilimitado'])
def handle_plan_command(message):
    """Responde aos comandos de plano."""
    user_id = message.from_user.id
    status = user_manager.check_allowance(user_id)
    
    if status['is_premium']:
        bot.reply_to(
            message,
            "💎 *Você é PREMIUM!*\n\n"
            "Seu plano é ilimitado.\n"
            "Aproveite!",
            parse_mode="Markdown"
        )
    else:
        send_payment_options(message, reason="command")


@bot.message_handler(func=lambda m: downloader.is_shopee_url(m.text or ""))
def handle_shopee_link(message):
    """Processa links da Shopee com verificação de cota."""
    chat_id = message.chat.id
    user_id = message.from_user.id
    shopee_url = message.text.strip()
    
    # 1. Verifica cota do usuário
    status = user_manager.check_allowance(user_id)
    
    if not status['allowed']:
        # Limite atingido
        send_payment_options(message, reason="limit_reached")
        return

    # Envia ação de "enviando vídeo"
    bot.send_chat_action(chat_id, 'upload_video')
    
    # Envia mensagem de processamento
    status_msg = bot.reply_to(message, "⏳ Baixando o vídeo... Aguarde!")
    
    filepath = None
    try:
        # Faz o download
        filepath = downloader.download(shopee_url)
        
        # Incrementa uso após sucesso
        user_manager.increment_usage(user_id)
        
        # Prepara texto de rodapé
        if status['is_premium']:
            footer_text = "💎 Usuário Premium (Ilimitado)"
        else:
            # Recalcula para mostrar o valor correto pós-incremento
            # (Poderíamos otimizar, mas assim é seguro)
            new_status = user_manager.check_allowance(user_id)
            remaining = new_status['downloads_left']
            footer_text = f"📉 Downloads restantes hoje: {remaining}/{user_manager.DAILY_LIMIT}"

        # Envia o vídeo
        bot.send_chat_action(chat_id, 'upload_video')
        with open(filepath, 'rb') as video_file:
            bot.send_video(
                chat_id, 
                video_file,
                caption=f"✅ Vídeo da Shopee sem marca d'água!\n\n_{footer_text}_\n\n_Lembre-se de creditar o criador original._",
                parse_mode="Markdown",
                supports_streaming=True
            )
        
        # Deleta a mensagem de status
        bot.delete_message(chat_id, status_msg.message_id)
        
    except Exception as e:
        # Em caso de erro, notifica o usuário
        bot.edit_message_text(
            f"❌ Erro ao baixar o vídeo:\n`{str(e)}`",
            chat_id,
            status_msg.message_id,
            parse_mode="Markdown"
        )
        
    finally:
        # IMPORTANTE: Limpa o arquivo do disco
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass


@bot.callback_query_handler(func=lambda call: call.data.startswith("check_pay_"))
def callback_check_payment(call):
    """Verifica o status do pagamento."""
    payment_id = call.data.replace("check_pay_", "")
    user_id = call.from_user.id
    
    # Verifica status (Mock sempre retorna True)
    paid = payment_service.check_payment_status(payment_id)
    
    if paid:
        # Adiciona 30 dias de premium
        user_manager.add_premium_time(user_id, 30)
        
        # Edita a mensagem para confirmar sucesso
        try:
            bot.edit_message_text(
                "✅ *Pagamento confirmado!*\n\n"
                "Você agora é **Premium** por 30 dias.\n"
                "Downloads ilimitados liberados! 🚀",
                call.message.chat.id,
                call.message.message_id,
                parse_mode="Markdown"
            )
            bot.answer_callback_query(call.id, "Pagamento Aprovado!")
        except Exception:
            # Caso não consiga editar a mensagem
            bot.send_message(call.message.chat.id, "✅ Pagamento confirmado! Você agora é Premium.")
    else:
        bot.answer_callback_query(call.id, "Pagamento ainda não confirmado. Tente novamente em instantes.", show_alert=True)


@bot.callback_query_handler(func=lambda call: call.data == "buy_premium")
def callback_buy_premium_legacy(call):
    """Mapeia botão antigo para novo fluxo."""
    bot.answer_callback_query(call.id)
    send_payment_options(call.message, reason="command")


@bot.message_handler(func=lambda m: True)
def handle_other_messages(message):
    """Responde a mensagens desconhecidas."""
    bot.reply_to(
        message, 
        "🤔 *Comando não reconhecido.*\n\n"
        "Envie um link da Shopee para baixar ou use /plano para ver opções Premium.",
        parse_mode="Markdown"
    )


if __name__ == "__main__":
    print("🤖 Bot iniciado (v2.0 - Payment Ready)! Pressione Ctrl+C para parar.")
    print(f"📁 Output dir: {os.path.abspath(downloader.output_dir)}")
    print(f"💾 Database: {user_manager.DB_NAME}")
    
    # Remove webhook e inicia polling
    bot.remove_webhook()
    bot.infinity_polling(timeout=60, long_polling_timeout=60)
