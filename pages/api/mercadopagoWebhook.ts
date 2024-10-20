import mercadopago from 'mercadopago';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../utils/supabaseAdmin';

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Webhook received. Method:', req.method);

  // Accept both POST and GET requests for testing purposes
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Parse notification data from the request
  const notificationData = req.method === 'POST' ? req.body : req.query;
  console.log('Notification data:', notificationData);

  // Check if the event is a payment
  if (notificationData.type === 'payment') {
    try {
      // Get payment ID from the notification data
      const paymentId = notificationData['data.id'] || notificationData['id'];
      if (!paymentId) {
        console.error('Payment ID not found in notification data.');
        return res.status(400).json({ error: 'Payment ID not found' });
      }

      // Get payment data using the payment ID
      const paymentResponse = await mercadopago.payment.get(paymentId);
      const paymentData = paymentResponse.body;

      // Extract necessary information
      const amount = paymentData.transaction_amount;
      const status = paymentData.status;

      console.log('Payment data received from Mercado Pago API:', paymentData);

      // Extract userId from external_reference
      const externalReference = paymentData.external_reference;
      const userIdMatch = externalReference ? externalReference.match(/^DEP-(.+?)-\d+$/) : null;

      if (!userIdMatch || !userIdMatch[1]) {
        console.error('Invalid or missing external_reference:', externalReference);
        return res.status(400).json({ error: 'Invalid or missing external_reference' });
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

        console.log(`User ${userId}'s balance successfully updated! New balance: ${novoSaldo}`);
      } else if (status === 'pending') {
        console.log(`Payment pending for user ${userId}. Awaiting confirmation.`);
      } else {
        console.log(`Payment with status "${status}" for user ${userId}.`);
      }

      // Return a successful response
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error in Mercado Pago webhook:', error);
      res.status(500).json({ error: 'Error processing payment in webhook' });
    }
  } else {
    console.log('Event type is not payment:', notificationData.type);
    res.status(400).json({ error: 'Event type is not payment' });
  }
}
