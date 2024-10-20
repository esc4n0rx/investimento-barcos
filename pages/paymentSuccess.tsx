// pages/paymentSuccess.tsx

import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const PaymentSuccess = () => {
  const router = useRouter();

  useEffect(() => {
    const updateBalance = async () => {
        const { payment_id, status } = router.query;
      
        if (status === 'approved' && payment_id) {
          // Obter detalhes do pagamento
          try {
            const response = await fetch('/api/getPaymentStatus', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ payment_id }),
            });
      
            const data = await response.json();
      
            if (response.ok) {
              const amount = data.transaction_amount;
              const userId = data.payer.id;
      
              // Buscar saldo inicial do usuário
              const { data: userProfile, error: selectError } = await supabase
                .from('user_profile')
                .select('saldo_inicial')
                .eq('uuid', userId)
                .single();
      
              if (selectError) {
                console.error('Erro ao buscar saldo inicial:', selectError);
              } else {
                const novoSaldo = userProfile.saldo_inicial + amount;
      
                // Atualizar saldo do usuário
                const { error: updateError } = await supabase
                  .from('user_profile')
                  .update({ saldo_inicial: novoSaldo })
                  .eq('uuid', userId);  // Adiciona o filtro pelo ID do usuário
      
                if (updateError) {
                  console.error('Erro ao atualizar saldo:', updateError);
                } else {
                  alert('Depósito realizado com sucesso!');
                  router.push('/main');
                }
              }
            } else {
              console.error('Erro ao obter detalhes do pagamento:', data.error);
              alert('Erro ao processar o pagamento.');
            }
          } catch (error) {
            console.error('Erro ao atualizar saldo:', error);
          }
        }
      };
      
      if (router.isReady) {
        updateBalance();
      }
  }, [router]);

  return <div>Pagamento concluído.</div>;
};
