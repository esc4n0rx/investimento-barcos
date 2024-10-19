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
    .select('ativo, valor, rendimento_diario, data_compra')
    .eq('user_id', userId);

  if (ativosError) {
    console.error('Erro ao buscar ativos do usuário:', ativosError);
    return res.status(500).json({ error: 'Erro ao buscar ativos do usuário.' });
  }

  // Calcular rendimento total dos ativos
  let totalRendimento = 0;
  userAtivos.forEach((ativo) => {
    const daysHeld = Math.floor((new Date().getTime() - new Date(ativo.data_compra).getTime()) / (1000 * 60 * 60 * 24));
    const rendimento = ativo.valor * (ativo.rendimento_diario / 100) * daysHeld;
    totalRendimento += rendimento;
  });

  // Calcular rendimento dos convites
  const { data: invitedUsers, error: invitedUsersError } = await supabaseAdmin
    .from('user_convites')
    .select('rendimento')
    .eq('user_id', userId);

  if (invitedUsersError) {
    console.error('Erro ao buscar convites do usuário:', invitedUsersError);
    return res.status(500).json({ error: 'Erro ao buscar convites do usuário.' });
  }

  let rendimentoExtra = 0;
  const numConvites = invitedUsers.length;

  if (numConvites === 1) {
    rendimentoExtra = 0.001; // 0,10%
  } else if (numConvites === 2) {
    rendimentoExtra = 0.002; // 0,20%
  } else if (numConvites >= 3) {
    rendimentoExtra = 0.0025; // 0,25%
  }

  // Aplicar rendimento extra ao saldo inicial
  const { data: userData, error: userError } = await supabaseAdmin
    .from('user_profile')
    .select('saldo_inicial')
    .eq('uuid', userId)
    .single();

  if (userError) {
    console.error('Erro ao buscar dados do usuário:', userError);
    return res.status(500).json({ error: 'Erro ao buscar dados do usuário.' });
  }

  const rendimentoConvites = userData.saldo_inicial * rendimentoExtra;

  const novoSaldo = userData.saldo_inicial + totalRendimento + rendimentoConvites;

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
