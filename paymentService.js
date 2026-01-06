const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class PaymentService {
    constructor() {
        this.api = axios.create({
            baseURL: 'https://api.pushinpay.com.br',
            headers: {
                'Authorization': `Bearer ${process.env.PUSHINPAY_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            validateStatus: status => status < 500
        });
    }

    /**
     * Cria um pagamento Pix real na PushinPay
     * @param {number} userId - ID do usuário no Telegram
     * @returns {Promise<{ payment_id: string, pix_copy_paste: string }>}
     */
    async createPixPayment(userId) {
        try {
            // Valor do plano (R$ 19,90) - Pode parametrizar depois
            const amount = 19.90;

            if (!process.env.PUSHINPAY_TOKEN) {
                console.warn('⚠️ Token PushinPay não configurado. Usando Mock.');
                return this._createMockPayment();
            }

            const response = await this.api.post('/api/pix/cashIn', {
                value: amount,
                webhook_url: process.env.WEBHOOK_URL || null
            });

            if (response.status !== 200 && response.status !== 201) {
                console.error('Erro PushinPay (Create):', response.data);
                throw new Error('Falha ao criar pagamento Pix na API');
            }

            const data = response.data;

            return {
                payment_id: data.id,
                pix_copy_paste: data.qr_code // Verifica se a API retorna 'qr_code' ou 'qr_code_base64'
            };

        } catch (error) {
            console.error('Erro no serviço de pagamento:', error.message);
            if (!process.env.PUSHINPAY_TOKEN) return this._createMockPayment();
            throw error;
        }
    }

    /**
     * Verifica o status do pagamento na PushinPay
     * @param {string} paymentId 
     * @returns {Promise<boolean>}
     */
    async checkPaymentStatus(paymentId) {
        if (!process.env.PUSHINPAY_TOKEN) return true; // Mock sempre aprova

        // Se for ID de mock, aprova direto
        if (paymentId.includes('mock')) return true;

        try {
            const response = await this.api.get(`/api/transactions/${paymentId}`);

            if (response.status !== 200) {
                console.error('Erro PushinPay (Status):', response.data);
                return false;
            }

            return response.data.status === 'paid';

        } catch (error) {
            console.error('Erro ao verificar status:', error.message);
            return false;
        }
    }

    _createMockPayment() {
        return {
            payment_id: `mock-${uuidv4()}`,
            pix_copy_paste: `00020126580014br.gov.bcb.pix0136${uuidv4()}520400005303986540510.005802BR5913SHOOPEE_BOT6008BRASILIA62070503***6304MOCK`
        };
    }
}

module.exports = PaymentService;
