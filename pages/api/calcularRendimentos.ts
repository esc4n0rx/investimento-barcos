// pages/api/calcularRendimentos.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../utils/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'ID de usuário não fornecido.' });
  }

  // Buscar ativos do usuário
  const { data: userAtivos, error: ativosError } = await supabaseAdmin
    .from('registros_main')
    .select('id, ativo, valor, rendimento_diario, data_compra, last_yield_calculated')
    .eq('user_id', userId);

  if (ativosError) {
    console.error('Erro ao buscar ativos do usuário:', ativosError);
    return res.status(500).json({ error: 'Erro ao buscar ativos do usuário.' });
  }

  let totalRendimento = 0;

  for (const ativo of userAtivos) {
    let lastYieldDate = ativo.last_yield_calculated ? new Date(ativo.last_yield_calculated) : new Date(ativo.data_compra);
    const currentDate = new Date();

    // Evitar datas futuras
    if (lastYieldDate > currentDate) {
      lastYieldDate = currentDate;
    }

    const timeDiff = currentDate.getTime() - lastYieldDate.getTime();
    const daysSinceLastYield = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    const rendimentoDiario = parseFloat(ativo.rendimento_diario);

    if (!isNaN(rendimentoDiario) && daysSinceLastYield > 0) {
      const rendimento = rendimentoDiario * daysSinceLastYield;
      totalRendimento += rendimento;

      // Atualizar last_yield_calculated
      const { error: updateAtivoError } = await supabaseAdmin
        .from('registros_main')
        .update({ last_yield_calculated: currentDate.toISOString() })
        .eq('id', ativo.id);

      if (updateAtivoError) {
        console.error('Erro ao atualizar last_yield_calculated:', updateAtivoError);
      }
    }
  }

  // Atualizar saldo do usuário
  const { data: userData, error: userError } = await supabaseAdmin
    .from('user_profile')
    .select('saldo_inicial')
    .eq('uuid', userId)
    .single();

  if (userError || !userData) {
    console.error('Erro ao buscar dados do usuário:', userError);
    return res.status(500).json({ error: 'Erro ao buscar dados do usuário.' });
  }

  const novoSaldo = userData.saldo_inicial + totalRendimento;

  const { error: updateError } = await supabaseAdmin
    .from('user_profile')
    .update({ saldo_inicial: novoSaldo })
    .eq('uuid', userId);

  if (updateError) {
    console.error('Erro ao atualizar saldo do usuário:', updateError);
    return res.status(500).json({ error: 'Erro ao atualizar saldo do usuário.' });
  }

  return res.status(200).json({ ativos: userAtivos, novoSaldo });
}
