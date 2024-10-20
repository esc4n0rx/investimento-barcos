// pages/api/mercadopagoWebhook.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../../utils/supabaseAdmin';

// Configure Mercado Pago SDK
mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const payment = req.body;

  // Check if the event is a payment
  if (payment.type === 'payment') {
    try {
      // Get payment data using the payment ID sent by Mercado Pago
      const paymentData = await mercadopago.payment.get(payment.data.id);

      // Extract necessary information
      const amount = paymentData.body.transaction_amount;
      const status = paymentData.body.status;

      console.log('Payment data received:', paymentData.body);

      // Extract userId from external_reference
      const externalReference = paymentData.body.external_reference;
      const userIdMatch = externalReference.match(/^DEP-(.+?)-\d+$/);

      if (!userIdMatch || !userIdMatch[1]) {
        console.error('Invalid external_reference format:', externalReference);
        return res.status(400).json({ error: 'Invalid external_reference format' });
      }

      const userId = userIdMatch[1];

      // Only process balance if payment is approved
      if (status === 'approved') {
        // Fetch user's initial balance from the database
        const { data: userProfile, error: selectError } = await supabaseAdmin
          .from('user_profile')
          .select('saldo_inicial')
          .eq('uuid', userId)
          .single();

        if (selectError || !userProfile) {
          console.error('Error fetching initial balance:', selectError);
          return res.status(500).json({ error: 'Error fetching initial balance' });
        }

        const novoSaldo = userProfile.saldo_inicial + amount;

        // Update user's balance in the database
        const { error: updateError } = await supabaseAdmin
          .from('user_profile')
          .update({ saldo_inicial: novoSaldo })
          .eq('uuid', userId);

        if (updateError) {
          console.error('Error updating balance via webhook:', updateError);
          return res.status(500).json({ error: 'Error updating balance' });
        }

        console.log(`User ${userId}'s balance successfully updated!`);
      } else if (status === 'pending') {
        console.log(`Payment pending for user ${userId}. Awaiting confirmation.`);
      } else {
        console.log(`Payment with status ${status} for user ${userId}.`);
      }

      // Return a successful response
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error in Mercado Pago webhook:', error);
      res.status(500).json({ error: 'Error processing payment in webhook' });
    }
  } else {
    res.status(400).json({ error: 'Event type is not payment' });
  }
}
