// pages/api/getPaymentStatus.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import mercadopago from 'mercadopago';

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { payment_id } = req.body;

  if (!payment_id) {
    return res.status(400).json({ error: 'payment_id não fornecido' });
  }

  try {
    const payment = await mercadopago.payment.get(payment_id);

    res.status(200).json(payment.body);
  } catch (error) {
    console.error('Erro ao obter detalhes do pagamento:', error);
    res.status(500).json({ error: 'Erro ao obter detalhes do pagamento' });
  }
}
