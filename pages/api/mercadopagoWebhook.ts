import type { NextApiRequest, NextApiResponse } from 'next';
import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../../utils/supabaseAdmin';

// Configurar o SDK do Mercado Pago
mercadopago.configurations.setAccessToken(process.env.MERCADO_PAGO_ACCESS_TOKEN || '');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar se os dados do pagamento foram enviados corretamente
  const payment = req.body;

  // Verificar se o evento é de um pagamento
  if (payment.type === 'payment') {
    try {
      // Buscar os dados do pagamento usando o ID do pagamento enviado pelo Mercado Pago
      const paymentData = await mercadopago.payment.findById(payment.data.id);

      // Extrair as informações necessárias
      const amount = paymentData.body.transaction_amount;
      const userId = paymentData.body.payer.id;
      const status = paymentData.body.status;

      console.log('Dados do pagamento recebidos:', paymentData.body);

      // Apenas processar o saldo se o pagamento for aprovado
      if (status === 'approved') {
        // Buscar o saldo inicial do usuário no banco de dados
        const { data: userProfile, error: selectError } = await supabaseAdmin
          .from('user_profile')
          .select('saldo_inicial')
          .eq('uuid', userId)
          .single();

        if (selectError || !userProfile) {
          console.error('Erro ao buscar saldo inicial:', selectError);
          return res.status(500).json({ error: 'Erro ao buscar saldo inicial' });
        }

        const novoSaldo = userProfile.saldo_inicial + amount;

        // Atualizar o saldo do usuário no banco de dados
        const { error: updateError } = await supabaseAdmin
          .from('user_profile')
          .update({ saldo_inicial: novoSaldo })
          .eq('uuid', userId);

        if (updateError) {
          console.error('Erro ao atualizar saldo via webhook:', updateError);
          return res.status(500).json({ error: 'Erro ao atualizar saldo' });
        }

        console.log(`Saldo do usuário ${userId} atualizado com sucesso!`);
      } else if (status === 'pending') {
        console.log(`Pagamento pendente para o usuário ${userId}. Aguardando confirmação.`);
      } else {
        console.log(`Pagamento com status ${status} para o usuário ${userId}.`);
      }

      // Retornar uma resposta bem-sucedida
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Erro no webhook do Mercado Pago:', error);
      res.status(500).json({ error: 'Erro ao processar pagamento no webhook' });
    }
  } else {
    res.status(400).json({ error: 'Tipo de evento não é pagamento' });
  }
}
