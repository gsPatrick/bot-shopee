/**
 * Telegram Bot - Shopee Video Downloader
 * Bot que recebe links da Shopee e envia o vídeo sem marca d'água
 */

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const ShopeeDownloader = require('./shopeeServiceNew');
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

// Mapa temporário para guardar qual plano o usuário está tentando comprar
// userId -> { amount, days, name }
const pendingOrders = new Map();

async function sendPlanOptions(chatId, reason = 'limit_reached') {
    let msgHeader = '';
    if (reason === 'limit_reached') {
        msgHeader = '🚫 *O seu limite diário gratuito (5/5) acabou!*';
    } else if (reason === 'expired') {
        msgHeader = '⚠️ *O seu plano Premium venceu!*';
    } else {
        msgHeader = '💎 *Planos Premium (Ilimitado)*';
    }

    const text =
        `${msgHeader}\n\n` +
        `Assine o Premium para ter:\n` +
        `✅ Downloads Ilimitados\n` +
        `✅ Sem filas de espera\n` +
        `✅ Suporte Prioritário\n\n` +
        `Escolha seu plano:`;

    const keyboard = {
        inline_keyboard: [
            [{ text: '📅 Mensal - R$ 5,90', callback_data: 'select_plan_monthly' }],
            [{ text: '🗓️ Trimestral - R$ 23,90', callback_data: 'select_plan_quarterly' }],
            [{ text: '💬 Falar com Suporte', url: 'https://t.me/seusuporte' }]
        ]
    };

    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function generatePayment(chatId, userId, planType) {
    // Verifica se o token está configurado
    if (!process.env.PUSHINPAY_TOKEN || process.env.PUSHINPAY_TOKEN === 'SEU_TOKEN_PUSHINPAY_AQUI') {
        bot.sendMessage(chatId, "🚧 Sistema funcionando, código implementado, mas a conta do PushinPay precisa ser conectada.");
        return;
    }

    let amount, days, planName;

    if (planType === 'monthly') {
        amount = 5.90;
        days = 30;
        planName = 'Mensal';
    } else if (planType === 'quarterly') {
        amount = 23.90;
        days = 90;
        planName = 'Trimestral';
    } else {
        return;
    }

    // Mensagem de carregando
    const loadingMsg = await bot.sendMessage(chatId, `🔄 Gerando Pix para o plano *${planName}*...`, { parse_mode: 'Markdown' });

    try {
        // Gera Pagamento Pix
        const paymentData = await paymentService.createPixPayment(userId, amount, `Plano ${planName}`);
        const paymentId = paymentData.payment_id;
        const pixCode = paymentData.pix_copy_paste;

        // Salva detalhes do pedido pendente (para saber quantos dias dar quando confirmar)
        pendingOrders.set(paymentId, { userId, days, amount, planName });

        const pixMsg =
            `📲 *Pagamento Gerado - Plano ${planName}*\n` +
            `Valor: *R$ ${amount.toFixed(2).replace('.', ',')}*\n\n` +
            `Clique abaixo para copiar:\n` +
            `\`${pixCode}\`\n\n` +
            `⚠️ _Aguardando confirmação automática..._`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '✅ Já paguei (Verificar)', callback_data: `check_pay_${paymentId}` }],
                [{ text: '🔙 Voltar', callback_data: 'back_to_plans' }]
            ]
        };

        bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => { });
        await bot.sendMessage(chatId, pixMsg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

    } catch (e) {
        bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => { });
        bot.sendMessage(chatId, '❌ Erro ao gerar Pix. Tente novamente mais tarde.');
    }
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
/plano - Ver planos Premium
/ilimitado - Ver planos Premium

*Links suportados:*
• shopee.com.br
• shp.ee
• sv.shopee.com.br

*Limite Grátis:* 5 downloads/dia
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
        sendPlanOptions(chatId, 'command');
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
        await sendPlanOptions(chatId, 'limit_reached');
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
            footerText = `📉 Restantes hoje: ${newStatus.downloads_left}/${userManager.DAILY_LIMIT}`;
        }

        // Envia o vídeo
        bot.sendChatAction(chatId, 'upload_video');
        await bot.sendVideo(chatId, filepath, {
            caption: `✅ Vídeo da Shopee sem marca d'água!\n\n_${footerText}_\n\n`,
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

    // Seleção de Planos
    if (data === 'select_plan_monthly') {
        bot.answerCallbackQuery(query.id);
        await generatePayment(chatId, userId, 'monthly');
    }
    else if (data === 'select_plan_quarterly') {
        bot.answerCallbackQuery(query.id);
        await generatePayment(chatId, userId, 'quarterly');
    }
    else if (data === 'back_to_plans') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId).catch(() => { });
        sendPlanOptions(chatId, 'command');
    }
    else if (data.startsWith('check_pay_')) {
        const paymentId = data.replace('check_pay_', '');

        bot.answerCallbackQuery(query.id, { text: 'Verificando...' });

        const paid = await paymentService.checkPaymentStatus(paymentId);

        if (paid) {
            const order = pendingOrders.get(paymentId) || { days: 30 };

            // Adiciona premium
            userManager.addPremiumTime(userId, order.days);
            pendingOrders.delete(paymentId);

            try {
                await bot.editMessageText(
                    '✅ *Pagamento confirmado!*\n\n' +
                    `Você agora é **Premium**!\n` +
                    `Validade: ${order.days} dias\n` +
                    'Downloads ilimitados liberados! 🚀',
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
                );
            } catch (e) {
                bot.sendMessage(chatId, '✅ Pagamento confirmado! Você agora é Premium.');
            }
        } else {
            bot.sendMessage(chatId, '⏳ Pagamento ainda não identificado. Aguarde alguns segundos e tente novamente.');
        }
    } else if (data === 'buy_premium') {
        // Legado
        bot.answerCallbackQuery(query.id);
        await sendPlanOptions(chatId, userId, 'command');
    }
});

// Tratamento de erros
bot.on('polling_error', (error) => {
    if (error.code !== 'ETELEGRAM' && error.code !== 'ECONNRESET') {
        console.error('Polling error:', error.code, error.message);
    }
});

process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando bot...');
    userManager.close();
    process.exit(0);
});
