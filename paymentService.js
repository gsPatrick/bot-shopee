/**
 * Payment Service (Mock)
 * Simula a criação de pagamentos Pix e verificação de status
 */

const { v4: uuidv4 } = require('uuid');

class PaymentService {
    /**
     * Cria um pagamento Pix simulado
     * @returns {{ payment_id: string, pix_copy_paste: string }}
     */
    createPixPayment(userId) {
        const paymentId = uuidv4();

        // Gera código Pix fake mas realista visualmente
        const randomSuffix = Array.from({ length: 32 }, () =>
            '0123456789ABCDEF'.charAt(Math.floor(Math.random() * 16))
        ).join('');

        const pixCode = `00020126580014br.gov.bcb.pix0136${uuidv4()}520400005303986540510.005802BR5913SHOOPEE_BOT6008BRASILIA62070503***6304${randomSuffix}`;

        return {
            payment_id: paymentId,
            pix_copy_paste: pixCode
        };
    }

    /**
     * Verifica o status do pagamento
     * Para testes, retorna true sempre
     */
    checkPaymentStatus(paymentId) {
        // Em produção, aqui faria a chamada à API real (Woovi/PushinPay)
        return true;
    }
}

module.exports = PaymentService;
