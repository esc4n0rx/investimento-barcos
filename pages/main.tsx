// pages/main.tsx

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import { FaHome, FaChartLine, FaUserFriends, FaUser, FaSignOutAlt } from 'react-icons/fa';

interface UserProfile {
  nome: string;
  saldo_inicial: number;
  convites: number;
  convite_new: string;
  convite_ini?: string;
  telefone: string;
  pix_key?: string;
}

interface Ativo {
  id: number;
  nome: string;
  valor: number;
  rendimento_diario: string;
}

interface PurchasedAtivo {
  id: number;
  ativo: string;
  valor: number;
  rendimento_diario: number;
  data_compra: string;
  last_yield_calculated?: string;
}

interface InvitedUser {
  invited_user_nome: string;
  invited_user_telefone: string;
  rendimento: number;
}

const Main: React.FC = () => {
  const router = useRouter();
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAtivos, setUserAtivos] = useState<PurchasedAtivo[]>([]);
  const [ativos, setAtivos] = useState<Ativo[]>([
    { id: 1, nome: 'Ativo 1', valor: 100, rendimento_diario: 'R$ 25.00' },
    { id: 2, nome: 'Ativo 2', valor: 250, rendimento_diario: 'R$ 66.00' },
    { id: 3, nome: 'Ativo 3', valor: 600, rendimento_diario: 'R$ 170.00' },
    { id: 4, nome: 'Ativo 4', valor: 1400, rendimento_diario: 'R$ 630.00' },
    { id: 5, nome: 'Ativo 5', valor: 1600, rendimento_diario: 'R$ 1000.00' },
    { id: 6, nome: 'Ativo 6', valor: 2000, rendimento_diario: 'R$ 1560.00' },
    { id: 7, nome: 'Ativo 7', valor: 2250, rendimento_diario: 'R$ 2000.00' },
    { id: 8, nome: 'Ativo 8', valor: 2500, rendimento_diario: 'R$ 2350.00' },
    { id: 9, nome: 'Ativo 9', valor: 3000, rendimento_diario: 'R$ 2230.00' },
    { id: 10, nome: 'Ativo 10', valor: 3500, rendimento_diario: 'R$ 2450.00' },
  ]);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedAtivo, setSelectedAtivo] = useState<Ativo | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [showWithdrawalModal, setShowWithdrawalModal] = useState<boolean>(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [pixKey, setPixKey] = useState<string>('');

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const decodedToken = JSON.parse(atob(token));
      const userId = decodedToken.user_id;
      setUserId(userId);

      // Fetch user data
      const { data, error } = await supabase
        .from('user_profile')
        .select('nome, saldo_inicial, convites, convite_new, convite_ini, telefone, pix_key')
        .eq('uuid', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar dados do usuário:', error);
        router.push('/login');
      } else {
        setUserData(data);
      }

      // Fetch user's ativos
      await calcularRendimentos(userId);

      // Fetch invited users
      const { data: convidados, error: convitesError } = await supabase
        .from('user_convites')
        .select('invited_user_nome, invited_user_telefone, rendimento')
        .eq('user_id', userId);

      if (convitesError) {
        console.error('Erro ao buscar convidados:', convitesError);
      } else {
        setInvitedUsers(convidados || []);
      }
    };

    if (!userData) {
      fetchUserData();
    }
  }, [userData]);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    router.push('/login');
  };

  const handleComprar = (ativo: Ativo) => {
    setSelectedAtivo(ativo);
    setShowModal(true);
  };

  const confirmarCompra = async () => {
    if (userData && selectedAtivo && userId) {
      if (userData.saldo_inicial >= selectedAtivo.valor) {
        const novoSaldo = userData.saldo_inicial - selectedAtivo.valor;

        // Atualizar saldo do usuário
        const { error: updateError } = await supabase
          .from('user_profile')
          .update({ saldo_inicial: novoSaldo })
          .eq('uuid', userId);

        if (updateError) {
          console.error('Erro ao atualizar saldo do usuário:', updateError);
          alert('Ocorreu um erro ao atualizar seu saldo. Por favor, tente novamente.');
          setShowModal(false);
          return;
        }

        // Converter rendimento_diario para número
        const rendimentoDiarioValor = parseFloat(
          selectedAtivo.rendimento_diario.replace('R$ ', '').replace(',', '.')
        );

        // Formatar data_compra
        const dataCompra = new Date().toISOString().split('.')[0] + 'Z';

        // Registrar compra
        const { error: insertError } = await supabase
          .from('registros_main')
          .insert([
            {
              user_id: userId,
              ativo: selectedAtivo.nome,
              valor: selectedAtivo.valor,
              rendimento_diario: rendimentoDiarioValor,
              data_compra: dataCompra,
            },
          ]);

        if (insertError) {
          console.error('Erro ao registrar a compra:', insertError);
          alert(`Ocorreu um erro ao registrar sua compra: ${insertError.message}`);
          setShowModal(false);
          return;
        }

        // Atualizar estado local
        setUserData({ ...userData, saldo_inicial: novoSaldo });
        setUserAtivos([...userAtivos, {
          id: Date.now(), // Temporary ID, replace with actual ID from DB if needed
          ativo: selectedAtivo.nome,
          valor: selectedAtivo.valor,
          rendimento_diario: rendimentoDiarioValor,
          data_compra: dataCompra,
        }]);

        // Recalcular rendimentos
        await calcularRendimentos(userId);

        // Checar se é a primeira compra do usuário
        const { data: purchases, error: purchasesError } = await supabase
          .from('registros_main')
          .select('*')
          .eq('user_id', userId);

        if (purchasesError) {
          console.error('Erro ao verificar compras do usuário:', purchasesError);
        } else if (purchases.length === 1) {
          // Primeira compra do usuário
          // Verificar se o usuário foi convidado por alguém
          if (userData.convite_ini) {
            // Obter dados do usuário que convidou
            const { data: inviterData, error: inviterError } = await supabase
              .from('user_profile')
              .select('uuid, saldo_inicial, convites')
              .eq('convite_new', userData.convite_ini)
              .single();

            if (inviterError || !inviterData) {
              console.error('Erro ao obter dados do usuário que convidou:', inviterError);
            } else {
              // Verificar se o bônus já foi dado
              const { data: conviteRecord, error: conviteRecordError } = await supabase
                .from('user_convites')
                .select('*')
                .eq('user_id', inviterData.uuid)
                .eq('invited_user_telefone', userData.telefone)
                .single();

              if (conviteRecordError || !conviteRecord) {
                console.error('Erro ao verificar registro de convite:', conviteRecordError);
              } else if (!conviteRecord.bonus_given) {
                // Contar quantos bônus já foram dados ao usuário que convidou
                const { data: bonusesGiven, error: bonusesGivenError } = await supabase
                  .from('user_convites')
                  .select('*')
                  .eq('user_id', inviterData.uuid)
                  .eq('bonus_given', true);

                if (bonusesGivenError) {
                  console.error('Erro ao verificar bônus já dados:', bonusesGivenError);
                } else {
                  const bonusPercentage = bonusesGiven.length === 0 ? 0.37 : 0.01;
                  const bonusAmount = selectedAtivo.valor * bonusPercentage;

                  // Atualizar saldo do usuário que convidou
                  const novoSaldoInviter = inviterData.saldo_inicial + bonusAmount;
                  const novoConvites = (inviterData.convites || 0) + 1;

                  const { error: updateInviterError } = await supabase
                    .from('user_profile')
                    .update({ saldo_inicial: novoSaldoInviter, convites: novoConvites })
                    .eq('uuid', inviterData.uuid);

                  if (updateInviterError) {
                    console.error('Erro ao atualizar saldo do usuário que convidou:', updateInviterError);
                  } else {
                    // Marcar bônus como dado
                    const { error: updateConviteError } = await supabase
                      .from('user_convites')
                      .update({ bonus_given: true })
                      .eq('id', conviteRecord.id);

                    if (updateConviteError) {
                      console.error('Erro ao atualizar registro de convite:', updateConviteError);
                    }
                  }
                }
              }
            }
          }
        }

        alert('Compra realizada com sucesso!');
      } else {
        alert('Saldo insuficiente!');
      }
    }
    setShowModal(false);
  };

  const calcularRendimentos = async (userId: string) => {
    if (userId) {
      // Chamar API para calcular rendimentos
      const response = await fetch('/api/calcularRendimentos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const result = await response.json();
        setUserAtivos(result.ativos);
        setUserData((prevData) => prevData ? { ...prevData, saldo_inicial: result.novoSaldo } : null);
      } else {
        console.error('Erro ao calcular rendimentos');
      }
    }
  };

  // Funções para o Depósito
  const handleDepositar = () => {
    setShowDepositModal(true);
    setDepositAmount('');
  };

  const confirmarDeposito = async () => {
    const amount = parseFloat(depositAmount);

    if (isNaN(amount) || amount < 100) {
      alert('O depósito mínimo é de R$ 100,00');
      return;
    }

    if (userData && userId) {
      const novoSaldo = userData.saldo_inicial + amount;

      // Atualizar saldo do usuário
      const { error: updateError } = await supabase
        .from('user_profile')
        .update({ saldo_inicial: novoSaldo })
        .eq('uuid', userId);

      if (updateError) {
        console.error('Erro ao atualizar saldo do usuário:', updateError);
      } else {
        // Atualizar estado local
        setUserData({ ...userData, saldo_inicial: novoSaldo });

        // Registrar depósito (opcional)
        const { error: insertError } = await supabase
          .from('user_deposits')
          .insert([
            {
              user_id: userId,
              amount: amount,
              date: new Date().toISOString(),
            },
          ]);

        if (insertError) {
          console.error('Erro ao registrar depósito:', insertError);
        }
      }
    }
    setShowDepositModal(false);
  };

  // Funções para o Saque
  const handleSaque = async () => {
    if (userAtivos.length === 0) {
      alert('Você precisa ter pelo menos um ativo para realizar um saque.');
      return;
    }

    if ((userData?.saldo_inicial || 0) < 45) {
      alert('O valor mínimo para saque é de R$ 45,00.');
      return;
    }

    // Se o usuário já tiver uma chave PIX, carregue-a
    if (userData?.pix_key) {
      setPixKey(userData.pix_key);
    }

    setShowWithdrawalModal(true);
    setWithdrawalAmount('');
  };

  const confirmarSaque = async () => {
    const amount = parseFloat(withdrawalAmount);

    if (isNaN(amount) || amount < 45) {
      alert('O valor mínimo para saque é de R$ 45,00.');
      return;
    }

    if (amount > (userData?.saldo_inicial || 0)) {
      alert('Você não possui saldo suficiente para esse saque.');
      return;
    }

    if (!pixKey) {
      alert('Por favor, informe sua chave PIX.');
      return;
    }

    if (userData && userId) {
      const novoSaldo = userData.saldo_inicial - amount;

      // Atualizar saldo do usuário e salvar chave PIX
      const { error: updateError } = await supabase
        .from('user_profile')
        .update({ saldo_inicial: novoSaldo, pix_key: pixKey })
        .eq('uuid', userId);

      if (updateError) {
        console.error('Erro ao atualizar saldo do usuário:', updateError);
        alert('Ocorreu um erro ao processar seu saque. Por favor, tente novamente.');
        setShowWithdrawalModal(false);
        return;
      } else {
        // Atualizar estado local
        setUserData({ ...userData, saldo_inicial: novoSaldo, pix_key: pixKey });

        // Registrar pedido de saque
        const { error: insertError } = await supabase
          .from('registros_saque')
          .insert([
            {
              user_id: userId,
              nome: userData.nome,
              telefone: userData.telefone,
              pix_key: pixKey,
              amount: amount,
            },
          ]);

        if (insertError) {
          console.error('Erro ao registrar pedido de saque:', insertError);
          alert('Ocorreu um erro ao registrar seu saque. Por favor, tente novamente.');
          setShowWithdrawalModal(false);
          return;
        }

        // Enviar email de notificação
        const response = await fetch('/api/processWithdrawal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nome: userData.nome,
            telefone: userData.telefone,
            pix_key: pixKey,
            amount: amount,
          }),
        });

        if (response.ok) {
          alert('Saque solicitado com sucesso! O processamento leva de 2 a 24 horas.');
        } else {
          alert('Ocorreu um erro ao enviar a notificação de saque.');
        }
      }
    }

    setShowWithdrawalModal(false);
  };

  // Componentes de Conteúdo
  const HomeContent = () => {
    // Agrupar ativos por nome e contar quantas vezes foram comprados
    const ativosAgrupados = userAtivos.reduce((acc, ativo) => {
      if (!acc[ativo.ativo]) {
        acc[ativo.ativo] = {
          ...ativo,
          quantidade: 1,
        };
      } else {
        acc[ativo.ativo].quantidade += 1;
      }
      return acc;
    }, {} as Record<string, PurchasedAtivo & { quantidade: number }>);

    return (
      <div>
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
            <img src="/avatar-placeholder.png" alt="Avatar" className="rounded-full" />
          </div>
          <h2 className="text-2xl font-semibold">{userData?.nome || 'Usuário'}</h2>
        </div>

        <div className="bg-white bg-opacity-30 backdrop-blur-md rounded-lg p-6 w-full max-w-2xl mb-4">
          <h3 className="text-lg font-bold text-center text-black">Resumo Financeiro</h3>
          <p className="text-black">Saldo Atual: <span className="font-semibold">R$ {userData?.saldo_inicial.toFixed(2) || '0,00'}</span></p>
          <p className="text-black">Usuários Convidados: <span className="font-semibold">{userData?.convites || '0'}</span></p>
        </div>

        {Object.keys(ativosAgrupados).length > 0 ? (
          <div className="bg-white bg-opacity-30 backdrop-blur-md rounded-lg p-4 w-full max-w-2xl">
            <h3 className="text-lg font-bold text-center text-black">Seus Ativos</h3>
            {Object.values(ativosAgrupados).map((ativo, index) => (
              <div key={index} className="flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow-md w-full max-w-md mx-auto">
                <div>
                  <h4 className="font-bold">{ativo.ativo}</h4>
                  <p>Quantidade: {ativo.quantidade}</p>
                  <p>Rendimento Diário por unidade: R$ {ativo.rendimento_diario.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p>Valor Investido: R$ {ativo.valor.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white bg-opacity-30 backdrop-blur-md rounded-lg p-4 w-full max-w-2xl">
            <h3 className="text-lg font-bold text-center text-black">FAQ</h3>
            <p className="text-sm text-black">
              Saiba como investir de forma segura e lucrativa com nossa plataforma!
            </p>
          </div>
        )}
      </div>
    );
  };

  const AtivosContent = () => (
    <div>
      <h3 className="text-lg font-bold text-center text-black mb-4">Ativos Disponíveis</h3>
      <p className="text-center text-sm text-black mb-4">
        Escolha entre os melhores ativos disponíveis e comece a investir para obter rendimentos diários!
      </p>
      <div className="space-y-4">
        {ativos.map((ativo) => (
          <div key={ativo.id} className="flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow-md w-full max-w-md mx-auto">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-gray-300 rounded-full shadow-lg overflow-hidden">
                <img src={`/ativo${ativo.id}.jpg`} alt={ativo.nome} className="object-cover w-full h-full" />
              </div>
              <div>
                <h4 className="font-bold">{ativo.nome}</h4>
                <p>Rendimento Diário: {ativo.rendimento_diario}</p>
              </div>
            </div>
            <div className="text-right">
              <p>Valor: R$ {ativo.valor.toFixed(2)}</p>
              <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-lg" onClick={() => handleComprar(ativo)}>
                Comprar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ConvitesContent = () => (
    <div>
      <h3 className="text-lg font-bold text-center text-black">Convide Amigos</h3>
      <p className="text-center text-sm text-black mb-4">
        Convide seus amigos e ganhe rendimentos adicionais!
        Cada amigo seu que depositar e investir em nossa plataforma, você vai receber um bônus de 37% do valor investido!
      </p>
      <p className="text-black mb-2">
        Seu link de convite:
      </p>
      <div className="bg-gray-100 p-2 rounded mb-4">
        <p className="text-blue-500">{`https://boatvest.vercel.app/register?codigoConvite=${userData?.convite_new}`}</p>
      </div>
      <div className="bg-gray-100 p-2 rounded mt-4">
        <p>1º convite gera 37% de bônus</p>
        <p>Convites subsequentes geram 1% de bônus</p>
      </div>
      <table className="w-full mt-4">
        <thead>
          <tr>
            <th className="text-left">Nome</th>
            <th className="text-left">Telefone</th>
            <th className="text-left">Bônus Recebido</th>
          </tr>
        </thead>
        <tbody>
          {invitedUsers.map((user, index) => (
            <tr key={index}>
              <td>{user.invited_user_nome}</td>
              <td>{user.invited_user_telefone}</td>
              <td>{user.rendimento ? 'Sim' : 'Não'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const ContaContent = () => (
    <div>
      <h3 className="text-lg font-bold text-center text-black">Configurações da Conta</h3>
      <div className="flex flex-col space-y-3 mt-5">
        <button className="bg-blue-500 text-white p-2 rounded" onClick={handleDepositar}>Depositar</button>
        <button className="bg-blue-500 text-white p-2 rounded" onClick={handleSaque}>Saque</button>
        <button className="bg-blue-500 text-white p-2 rounded">Histórico de Retiradas</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-between h-full p-1 text-black">
      {/* Renderização Condicional */}
      <div className="max-w-2x5 bg-white bg-opacity-35 backdrop-blur-md rounded-lg p-1 mb-5 h-[80vh] overflow-y-auto">
        {activeTab === 'home' && <HomeContent />}
        {activeTab === 'ativos' && <AtivosContent />}
        {activeTab === 'convites' && <ConvitesContent />}
        {activeTab === 'conta' && <ContaContent />}
      </div>

      {/* Dock de Navegação */}
      <div className="fixed bottom-0 w-full max-w-2xl flex justify-around bg-red-500 bg-opacity-80 p-3 rounded-t-xl">
        <FaHome className="text-white text-2xl" onClick={() => setActiveTab('home')} />
        <FaChartLine className="text-white text-2xl" onClick={() => setActiveTab('ativos')} />
        <FaUserFriends className="text-white text-2xl" onClick={() => setActiveTab('convites')} />
        <FaUser className="text-white text-2xl" onClick={() => setActiveTab('conta')} />
        <FaSignOutAlt className="text-white text-2xl" onClick={handleLogout} />
      </div>

      {/* Modal de Compra */}
      {showModal && selectedAtivo && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Confirmar Compra</h2>
            <p>Você deseja comprar o {selectedAtivo.nome} por R$ {selectedAtivo.valor.toFixed(2)}?</p>
            <div className="flex space-x-4 mt-4">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded-lg"
                onClick={confirmarCompra}
              >
                Confirmar
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded-lg"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Saque */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Solicitar Saque</h2>
            <p>Informe o valor que deseja sacar (Mínimo R$ 45,00):</p>
            <input
              type="number"
              min="45"
              step="0.01"
              value={withdrawalAmount}
              onChange={(e) => setWithdrawalAmount(e.target.value)}
              className="w-full border border-gray-300 rounded mt-2 p-2"
            />
            <p className="mt-4">Informe sua chave PIX:</p>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className="w-full border border-gray-300 rounded mt-2 p-2"
            />
            <div className="flex space-x-4 mt-4">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded-lg"
                onClick={confirmarSaque}
              >
                Confirmar
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded-lg"
                onClick={() => setShowWithdrawalModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Depósito */}
      {showDepositModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Fazer Depósito</h2>
            <p>Informe o valor que deseja depositar (Mínimo R$ 100,00):</p>
            <input
              type="number"
              min="100"
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full border border-gray-300 rounded mt-2 p-2"
            />
            <div className="flex space-x-4 mt-4">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded-lg"
                onClick={confirmarDeposito}
              >
                Confirmar
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded-lg"
                onClick={() => setShowDepositModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Main;
