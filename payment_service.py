"""
Payment Service (Mock)
Simula a criação de pagamentos Pix e verificação de status.
"""

import uuid
import random

class PaymentService:
    """Simula integração com gateway de pagamento (Woovi/PushinPay)."""
    
    def create_pix_payment(self, user_id: int):
        """
        Cria um pagamento Pix simulado.
        
        Returns:
            dict: {
                'payment_id': str,
                'pix_copy_paste': str
            }
        """
        payment_id = str(uuid.uuid4())
        
        # Gera código Pix fake mas realista visualmente
        random_suffix = ''.join(random.choice('0123456789ABCDEF') for _ in range(32))
        pix_code = (
            "00020126580014br.gov.bcb.pix0136"
            f"{uuid.uuid4()}"
            "520400005303986540510.005802BR5913SHOOPEE_BOT6008BRASILIA"
            f"62070503***6304{random_suffix}"
        )
        
        return {
            'payment_id': payment_id,
            'pix_copy_paste': pix_code
        }
    
    def check_payment_status(self, payment_id: str) -> bool:
        """
        Verifica o status do pagamento.
        Para testes, retorna True sempre.
        """
        return True
