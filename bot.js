/**
 * Telegram Bot - Shopee Video Downloader
 * Bot que recebe links da Shopee e envia o vídeo sem marca d'água
 */

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const ShopeeDownloader = require('./shopeeService');
const UserManager = require('./database');
const PaymentService = require('./paymentService');

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN || BOT_TOKEN === 'SEU_TOKEN_AQUI') {
    console.error('❌ Erro: A variável de ambiente TELEGRAM_BOT_TOKEN não foi configurada!');
    process.exit(1);
}

// Inicializa componentes
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const downloader = new ShopeeDownloader('output_video');
const userManager = new UserManager();
const paymentService = new PaymentService();

// ============================================================
// INICIALIZAÇÃO ASSÍNCRONA
// ============================================================
async function init() {
    await userManager.init();
    console.log('🤖 Bot iniciado (v2.0 - Node.js)!');
    console.log(`📁 Output dir: ${path.resolve(downloader.outputDir)}`);
    console.log(`💾 Database: ${userManager.dbPath}`);
}

init().catch(err => {
    console.error('Erro na inicialização:', err);
    process.exit(1);
});

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

async function sendPaymentOptions(chatId, userId, reason = 'limit_reached') {
    let msgHeader = '';
    if (reason === 'limit_reached') {
        msgHeader = '🚫 *O seu limite diário gratuito acabou!*';
    } else if (reason === 'expired') {
        msgHeader = '⚠️ *O seu plano Premium venceu!*';
    } else {
        msgHeader = '💎 *Plano Premium (Ilimitado)*';
    }

    await bot.sendMessage(chatId,
        `${msgHeader}\n\nRenove agora para continuar baixando vídeos ilimitadamente e sem filas!`,
        { parse_mode: 'Markdown' }
    );

    // Gera Pagamento Pix
    const paymentData = await paymentService.createPixPayment(userId);
    const paymentId = paymentData.payment_id;
    const pixCode = paymentData.pix_copy_paste;

    const pixMsg =
        `Seu código pix (Ilimitado - 30 Dias)\n` +
        `Clique abaixo para copiar:\n\n` +
        `\`${pixCode}\`\n\n` +
        `⚠️ _A PUSHIN PAY atua apenas como processadora de pagamentos._`;

    const keyboard = {
        inline_keyboard: [
            [{ text: '✅ Verificar Pagamento', callback_data: `check_pay_${paymentId}` }],
            [{ text: '💬 Suporte', url: 'https://t.me/seusuporte' }]
        ]
    };

    await bot.sendMessage(chatId, pixMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// ============================================================
// HANDLERS
// ============================================================

// Comando /start e /help
bot.onText(/\/(start|help)/, (msg) => {
    const welcomeText = `
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
    `;
    bot.sendMessage(msg.chat.id, welcomeText, { parse_mode: 'Markdown' });
});

// Comando /plano e /ilimitado
bot.onText(/\/(plano|ilimitado)/, (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const status = userManager.checkAllowance(userId);

    if (status.is_premium) {
        bot.sendMessage(chatId,
            '💎 *Você é PREMIUM!*\n\nSeu plano é ilimitado.\nAproveite!',
            { parse_mode: 'Markdown' }
        );
    } else {
        sendPaymentOptions(chatId, userId, 'command');
    }
});

// Handler para links da Shopee
bot.on('message', async (msg) => {
    // Ignora comandos
    if (msg.text && msg.text.startsWith('/')) return;

    const text = msg.text || '';
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Verifica se é um link da Shopee
    if (!ShopeeDownloader.isShopeeUrl(text)) {
        bot.sendMessage(chatId,
            '🤔 *Comando não reconhecido.*\n\nEnvie um link da Shopee para baixar ou use /plano para ver opções Premium.',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const shopeeUrl = text.trim();

    // 1. Verifica cota do usuário
    const status = userManager.checkAllowance(userId);

    if (!status.allowed) {
        await sendPaymentOptions(chatId, userId, 'limit_reached');
        return;
    }

    // Envia ação de "enviando vídeo"
    bot.sendChatAction(chatId, 'upload_video');

    // Envia mensagem de processamento
    const statusMsg = await bot.sendMessage(chatId, '⏳ Baixando o vídeo... Aguarde!');

    let filepath = null;
    try {
        // Faz o download
        filepath = await downloader.download(shopeeUrl);

        // Incrementa uso após sucesso
        userManager.incrementUsage(userId);

        // Prepara texto de rodapé
        let footerText;
        if (status.is_premium) {
            footerText = '💎 Usuário Premium (Ilimitado)';
        } else {
            const newStatus = userManager.checkAllowance(userId);
            footerText = `📉 Downloads restantes hoje: ${newStatus.downloads_left}/${userManager.DAILY_LIMIT}`;
        }

        // Envia o vídeo
        bot.sendChatAction(chatId, 'upload_video');
        await bot.sendVideo(chatId, filepath, {
            caption: `✅ Vídeo da Shopee sem marca d'água!\n\n_${footerText}_\n\n_Lembre-se de creditar o criador original._`,
            parse_mode: 'Markdown'
        });

        // Deleta a mensagem de status
        bot.deleteMessage(chatId, statusMsg.message_id).catch(() => { });

    } catch (error) {
        console.error('Erro no download:', error);
        bot.editMessageText(
            `❌ Erro ao baixar o vídeo:\n\`${error.message}\``,
            {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: 'Markdown'
            }
        ).catch(() => { });

    } finally {
        // IMPORTANTE: Limpa o arquivo do disco
        if (filepath && fs.existsSync(filepath)) {
            try {
                fs.unlinkSync(filepath);
            } catch (e) {
                console.error('Erro ao deletar arquivo:', e);
            }
        }
    }
});

// Callback para verificar pagamento
bot.on('callback_query', async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const userId = query.from.id;

    if (data.startsWith('check_pay_')) {
        const paymentId = data.replace('check_pay_', '');
        const paid = await paymentService.checkPaymentStatus(paymentId);

        if (paid) {
            // Adiciona 30 dias de premium
            userManager.addPremiumTime(userId, 30);

            try {
                await bot.editMessageText(
                    '✅ *Pagamento confirmado!*\n\nVocê agora é **Premium** por 30 dias.\nDownloads ilimitados liberados! 🚀',
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
                );
                bot.answerCallbackQuery(query.id, { text: 'Pagamento Aprovado!' });
            } catch (e) {
                bot.sendMessage(chatId, '✅ Pagamento confirmado! Você agora é Premium.');
            }
        } else {
            bot.answerCallbackQuery(query.id, {
                text: 'Pagamento ainda não confirmado. Tente novamente em instantes.',
                show_alert: true
            });
        }
    } else if (data === 'buy_premium') {
        bot.answerCallbackQuery(query.id);
        await sendPaymentOptions(chatId, userId, 'command');
    }
});

// Tratamento de erros
bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code, error.message);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando bot...');
    userManager.close();
    process.exit(0);
});
