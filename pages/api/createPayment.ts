import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { amount, userId } = req.body;

  if (!amount || !userId) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  const idempotencyKey = uuidv4();

  const paymentData = {
    transaction_amount: parseFloat(amount),
    description: 'Depósito na plataforma',
    payment_method_id: 'pix',
    payer: {
      email: 'pagador_generico@gmail.com',
    },
    external_reference: `DEP-${userId}-${Date.now()}`,
    installments: 1,
  };

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(paymentData),
    });

    const data = await response.json();
    console.log('Resposta da API Mercado Pago:', data);

    if (response.ok) {
      res.status(200).json({
        qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
        ticket_url: data.point_of_interaction.transaction_data.ticket_url,
      });
    } else {
      console.error('Erro ao criar pagamento:', data);
      res.status(500).json({ error: 'Erro ao criar pagamento no Mercado Pago' });
    }
  } catch (error) {
    console.error('Erro na requisição para Mercado Pago:', error);
    res.status(500).json({ error: 'Erro no servidor ao processar pagamento' });
  }
}
