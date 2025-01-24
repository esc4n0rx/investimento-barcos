// pages/main.tsx

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import {
  FaHome,
  FaChartLine,
  FaUserFriends,
  FaUser,
  FaSignOutAlt,
} from 'react-icons/fa';

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

interface Withdrawal {
  id: number;
  amount: number;
  data: string; // Usando 'data' em vez de 'created_at'
}

const Main: React.FC = () => {
  const router = useRouter();
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAtivos, setUserAtivos] = useState<PurchasedAtivo[]>([]);
  const [ativos] = useState<Ativo[]>([
    { id: 1, nome: 'Bote Inflável', valor: 70, rendimento_diario: 'R$ 15.00' },
    { id: 2, nome: 'Lancha Esportiva', valor: 250, rendimento_diario: 'R$ 66.00' },
    { id: 3, nome: 'Veleiro Clássico', valor: 600, rendimento_diario: 'R$ 170.00' },
    { id: 4, nome: 'Escuna', valor: 1400, rendimento_diario: 'R$ 630.00' },
    { id: 5, nome: 'Catamarã de Recreio', valor: 1600, rendimento_diario: 'R$ 1000.00' },
    { id: 6, nome: 'Barco de Pesca Oceânica', valor: 2000, rendimento_diario: 'R$ 1560.00' },
    { id: 7, nome: 'Iate de Luxo', valor: 2250, rendimento_diario: 'R$ 2000.00' },
    { id: 8, nome: 'Iate Executivo', valor: 2500, rendimento_diario: 'R$ 2350.00' },
    { id: 9, nome: 'Navio de Cruzeiro', valor: 3000, rendimento_diario: 'R$ 2230.00' },
    { id: 10, nome: 'Super Iate', valor: 3500, rendimento_diario: 'R$ 2450.00' },
  ]);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedAtivo, setSelectedAtivo] = useState<Ativo | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showQrCodeModal, setShowQrCodeModal] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [showWithdrawalModal, setShowWithdrawalModal] = useState<boolean>(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [pixKey, setPixKey] = useState<string>('');
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [showWithdrawalsModal, setShowWithdrawalsModal] = useState<boolean>(false);

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

      await calcularRendimentos(userId);

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

        const rendimentoDiarioValor = parseFloat(
          selectedAtivo.rendimento_diario.replace('R$ ', '').replace(',', '.')
        );
        const dataCompra = new Date().toISOString().split('.')[0] + 'Z';

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

        setUserData({ ...userData, saldo_inicial: novoSaldo });
        setUserAtivos([
          ...userAtivos,
          {
            id: Date.now(),
            ativo: selectedAtivo.nome,
            valor: selectedAtivo.valor,
            rendimento_diario: rendimentoDiarioValor,
            data_compra: dataCompra,
          },
        ]);

        await calcularRendimentos(userId);

        const { data: purchases, error: purchasesError } = await supabase
          .from('registros_main')
          .select('*')
          .eq('user_id', userId);

        if (purchasesError) {
          console.error('Erro ao verificar compras do usuário:', purchasesError);
        } else if (purchases.length === 1) {
          if (userData.convite_ini) {
            const { data: inviterData, error: inviterError } = await supabase
              .from('user_profile')
              .select('uuid, saldo_inicial, convites')
              .eq('convite_new', userData.convite_ini)
              .single();

            if (inviterError || !inviterData) {
              console.error('Erro ao obter dados do usuário que convidou:', inviterError);
            } else {
              const { data: conviteRecord, error: conviteRecordError } = await supabase
                .from('user_convites')
                .select('*')
                .eq('user_id', inviterData.uuid)
                .eq('invited_user_telefone', userData.telefone)
                .single();

              if (conviteRecordError || !conviteRecord) {
                console.error('Erro ao verificar registro de convite:', conviteRecordError);
              } else if (!conviteRecord.bonus_given) {
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
                  const novoSaldoInviter = inviterData.saldo_inicial + bonusAmount;
                  const novoConvites = (inviterData.convites || 0) + 1;

                  const { error: updateInviterError } = await supabase
                    .from('user_profile')
                    .update({ saldo_inicial: novoSaldoInviter, convites: novoConvites })
                    .eq('uuid', inviterData.uuid);

                  if (updateInviterError) {
                    console.error('Erro ao atualizar saldo do usuário que convidou:', updateInviterError);
                  } else {
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
        setUserData((prevData) =>
          prevData ? { ...prevData, saldo_inicial: result.novoSaldo } : null
        );
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

    if (isNaN(amount) || amount < 70) {
      alert('O depósito mínimo é de R$ 70,00');
      return;
    }

    if (userId) {
      try {
        const response = await fetch('/api/createPayment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount, userId }),
        });

        const data = await response.json();

        if (response.ok && data.qr_code_base64 && data.ticket_url) {
          setQrCodeBase64(data.qr_code_base64);
          setPaymentLink(data.ticket_url);
          setShowDepositModal(false);
          setShowQrCodeModal(true);
        } else {
          alert('Erro ao criar o pagamento: ' + data.error);
        }
      } catch (error) {
        console.error('Erro ao processar o pagamento:', error);
        alert('Ocorreu um erro ao processar o pagamento.');
      }
    }
  };

  const handleSaque = async () => {
    if (userAtivos.length === 0) {
      alert('Você precisa ter pelo menos um ativo para realizar um saque.');
      return;
    }

    if ((userData?.saldo_inicial || 0) < 45) {
      alert('O valor mínimo para saque é de R$ 45,00.');
      return;
    }

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
        setUserData({ ...userData, saldo_inicial: novoSaldo, pix_key: pixKey });

        const { error: insertError } = await supabase
          .from('registros_saque')
          .insert([
            {
              user_id: userId,
              nome: userData.nome,
              telefone: userData.telefone,
              pix_key: pixKey,
              amount: amount,
              data: new Date().toISOString(), 
            },
          ]);

        if (insertError) {
          console.error('Erro ao registrar pedido de saque:', insertError);
          alert('Ocorreu um erro ao registrar seu saque. Por favor, tente novamente.');
          setShowWithdrawalModal(false);
          return;
        }

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

  const fetchWithdrawals = async () => {
    if (userId) {
      const { data, error } = await supabase
        .from('registros_saque')
        .select('id, amount, data')
        .eq('user_id', userId);

      if (error) {
        console.error('Erro ao buscar retiradas:', error);
      } else {
        setWithdrawals(data || []);
        setShowWithdrawalsModal(true);
      }
    }
  };

  const HomeContent = () => {
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
          <p className="text-black">
            Saldo Atual:{' '}
            <span className="font-semibold">
              R$ {userData?.saldo_inicial.toFixed(2) || '0,00'}
            </span>
          </p>
          <p className="text-black">
            Usuários Convidados:{' '}
            <span className="font-semibold">{userData?.convites || '0'}</span>
          </p>
        </div>

        {Object.keys(ativosAgrupados).length > 0 ? (
          <div className="bg-white bg-opacity-30 backdrop-blur-md rounded-lg p-4 w-full max-w-2xl">
            <h3 className="text-lg font-bold text-center text-black">Seus Ativos</h3>
            {Object.values(ativosAgrupados).map((ativo, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow-md w-full max-w-md mx-auto"
              >
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
            <p className="text-sm text-black mb-4">
              Saiba como investir de forma segura e lucrativa com nossa plataforma!
            </p>
            <div className="text-black text-sm space-y-4">
              <div>
                <h4 className="font-bold">1. Como faço um depósito?</h4>
                <p>
                  Para fazer um depósito, vá até a seção "Configurações da Conta" e clique em
                  "Depositar". Informe o valor que deseja depositar (mínimo de R$ 100,00) e siga as instruções na tela.
                </p>
              </div>
              <div>
                <h4 className="font-bold">2. Como posso comprar ativos?</h4>
                <p>
                  Na aba "Ativos", você encontrará uma lista de ativos disponíveis. Clique em "Comprar" no ativo desejado e confirme a compra.
                </p>
              </div>
              <div>
                <h4 className="font-bold">3. Como são calculados os rendimentos?</h4>
                <p>
                  Os rendimentos são calculados diariamente com base no rendimento diário de cada ativo que você possui. Eles são adicionados ao seu saldo automaticamente.
                </p>
              </div>
              <div>
                <h4 className="font-bold">4. Como realizo um saque?</h4>
                <p>
                  Vá até "Configurações da Conta" e clique em "Saque". Informe o valor que deseja sacar (mínimo de R$ 45,00) e sua chave PIX. Seu saque será processado em até 24 horas.
                </p>
              </div>
              <div>
                <h4 className="font-bold">5. Como funciona o sistema de convites?</h4>
                <p>
                  Convide amigos usando seu link único na aba "Convites". Você receberá um bônus de 37% do valor investido pelo primeiro amigo que se cadastrar e realizar um investimento, e 1% para os próximos.
                </p>
              </div>
              <div>
                <h4 className="font-bold">6. Onde posso ver meu histórico de retiradas?</h4>
                <p>
                  Em "Configurações da Conta", clique em "Histórico de Retiradas" para visualizar todas as suas solicitações de saque.
                </p>
              </div>
              <div>
                <h4 className="font-bold">7. Como posso entrar em contato com o suporte?</h4>
                <p>
                  Para suporte, entre em contato conosco através do e-mail suporte@boatvest.com ou pelo nosso canal de atendimento no aplicativo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const AtivosContent = () => (
    <div>
      <h3 className="text-lg font-bold text-center text-black mb-4">
        Ativos Disponíveis
      </h3>
      <p className="text-center text-sm text-black mb-4">
        Escolha entre os melhores ativos disponíveis e comece a investir para obter
        rendimentos diários!
      </p>
      <div className="space-y-4">
        {ativos.map((ativo) => (
          <div
            key={ativo.id}
            className="flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow-md w-full max-w-md mx-auto"
          >
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-gray-300 rounded-full shadow-lg overflow-hidden">
                <img
                  src={`/ativo${ativo.id}.jpg`}
                  alt={ativo.nome}
                  className="object-cover w-full h-full"
                />
              </div>
              <div>
                <h4 className="font-bold">{ativo.nome}</h4>
                <p>Rendimento Diário: {ativo.rendimento_diario}</p>
              </div>
            </div>
            <div className="text-right">
              <p>Valor: R$ {ativo.valor.toFixed(2)}</p>
              <button
                className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-lg"
                onClick={() => handleComprar(ativo)}
              >
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
        Convide seus amigos e ganhe rendimentos adicionais! Cada amigo seu que depositar
        e investir em nossa plataforma, você vai receber um bônus de 37% do valor
        investido!
      </p>
      <p className="text-black mb-2">Seu link de convite:</p>
      <div className="bg-gray-100 p-2 rounded mb-4">
        <p className="text-blue-500">{`https://boat-invest.vercel.app/register?codigoConvite=${userData?.convite_new}`}</p>
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
        <button className="bg-blue-500 text-white p-2 rounded" onClick={handleDepositar}>
          Depositar
        </button>
        <button className="bg-blue-500 text-white p-2 rounded" onClick={handleSaque}>
          Saque
        </button>
        <button
          className="bg-blue-500 text-white p-2 rounded"
          onClick={fetchWithdrawals}
        >
          Histórico de Retiradas
        </button>
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
        <FaUserFriends
          className="text-white text-2xl"
          onClick={() => setActiveTab('convites')}
        />
        <FaUser className="text-white text-2xl" onClick={() => setActiveTab('conta')} />
        <FaSignOutAlt className="text-white text-2xl" onClick={handleLogout} />
      </div>

      {/* Modal de Compra */}
      {showModal && selectedAtivo && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Confirmar Compra</h2>
            <p>
              Você deseja comprar o {selectedAtivo.nome} por R$ {selectedAtivo.valor.toFixed(2)}?
            </p>
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
            <p>Informe o valor que deseja depositar (Mínimo R$ 70,00):</p>
            <input
              type="number"
              min="70"
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

      {/* Modal de QR Code e Link de Pagamento */}
      {showQrCodeModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Depósito via Pix</h2>
            {qrCodeBase64 && (
              <div>
                <p>Escaneie o código QR abaixo para realizar o pagamento:</p>
                <img
                  src={`data:image/png;base64,${qrCodeBase64}`}
                  alt="QR Code do Pix"
                  className="my-4 mx-auto"
                />
              </div>
            )}
            {paymentLink && (
              <div className="mt-4">
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                  onClick={() => window.open(paymentLink, '_blank')}
                >
                  Ir para o pagamento
                </button>
              </div>
            )}
            <div className="flex space-x-4 mt-4">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded-lg"
                onClick={() => setShowQrCodeModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Retiradas */}
      {showWithdrawalsModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-auto">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4">Histórico de Retiradas</h2>
            {withdrawals.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Data</th>
                    <th className="text-left">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id}>
                      <td>{new Date(withdrawal.data).toLocaleDateString()}</td>
                      <td>R$ {withdrawal.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Você ainda não possui retiradas.</p>
            )}
            <div className="flex justify-end mt-4">
              <button
                className="bg-red-500 text-white px-4 py-2 rounded-lg"
                onClick={() => setShowWithdrawalsModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Main;
