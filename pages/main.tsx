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
}

interface Ativo {
  id: number;
  nome: string;
  valor: number;
  rendimento_diario: number;
}

interface PurchasedAtivo {
  ativo: string;
  valor: number;
  rendimento_diario: number;
  data_compra: string;
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
    { id: 1, nome: 'Ativo 1', valor: 100, rendimento_diario: 5 },
    { id: 2, nome: 'Ativo 2', valor: 150, rendimento_diario: 6 },
    { id: 3, nome: 'Ativo 3', valor: 200, rendimento_diario: 7 },
    { id: 4, nome: 'Ativo 4', valor: 250, rendimento_diario: 8 },
    { id: 5, nome: 'Ativo 5', valor: 300, rendimento_diario: 10 },
    { id: 6, nome: 'Ativo 6', valor: 400, rendimento_diario: 12 },
    { id: 7, nome: 'Ativo 7', valor: 450, rendimento_diario: 13 },
    { id: 8, nome: 'Ativo 8', valor: 500, rendimento_diario: 15 },
    { id: 9, nome: 'Ativo 9', valor: 600, rendimento_diario: 17 },
    { id: 10, nome: 'Ativo 10', valor: 700, rendimento_diario: 18 },
  ]);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedAtivo, setSelectedAtivo] = useState<Ativo | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);

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
        .select('nome, saldo_inicial, convites, convite_new')
        .eq('uuid', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar dados do usuário:', error);
        router.push('/login');
      } else {
        setUserData(data);
      }

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

      // Buscar usuários convidados
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

    fetchUserData();
  }, []);

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
      // Verificar se o usuário já possui esse ativo
      const { data: existingAtivo, error: existingAtivoError } = await supabase
        .from('registros_main')
        .select('*')
        .eq('user_id', userId)
        .eq('ativo', selectedAtivo.nome)
        .single();

      if (existingAtivo) {
        alert('Você já possui este ativo!');
        setShowModal(false);
        return;
      }

      if (userData.saldo_inicial >= selectedAtivo.valor) {
        const novoSaldo = userData.saldo_inicial - selectedAtivo.valor;

        // Atualizar saldo do usuário
        const { error: updateError } = await supabase
          .from('user_profile')
          .update({ saldo_inicial: novoSaldo })
          .eq('uuid', userId);

        // Registrar compra
        const { error: insertError } = await supabase
          .from('registros_main')
          .insert([
            {
              user_id: userId,
              ativo: selectedAtivo.nome,
              valor: selectedAtivo.valor,
              rendimento_diario: selectedAtivo.rendimento_diario,
              data_compra: new Date().toISOString(),
            },
          ]);

        if (updateError || insertError) {
          console.error('Erro ao completar a compra:', updateError || insertError);
        } else {
          // Atualizar estado local
          setUserData({ ...userData, saldo_inicial: novoSaldo });
          setUserAtivos([...userAtivos, {
            ativo: selectedAtivo.nome,
            valor: selectedAtivo.valor,
            rendimento_diario: selectedAtivo.rendimento_diario,
            data_compra: new Date().toISOString(),
          }]);
        }
      } else {
        alert('Saldo insuficiente!');
      }
    }
    setShowModal(false);
  };

  // Componentes de Conteúdo
  const HomeContent = () => {
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

        {userAtivos.length > 0 ? (
          <div className="bg-white bg-opacity-30 backdrop-blur-md rounded-lg p-4 w-full max-w-2xl">
            <h3 className="text-lg font-bold text-center text-black">Seus Ativos</h3>
            {userAtivos.map((ativo, index) => (
              <div key={index} className="flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow-md w-full max-w-md mx-auto">
                <div>
                  <h4 className="font-bold">{ativo.ativo}</h4>
                  <p>Rendimento Diário: {ativo.rendimento_diario}%</p>
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
                <p>Rendimento Diário: {ativo.rendimento_diario}%</p>
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
      </p>
      <p className="text-black mb-2">
        Seu link de convite:
      </p>
      <div className="bg-gray-100 p-2 rounded mb-4">
        <p className="text-blue-500">{`https://boatvest.vercel.app/register?codigoConvite=${userData?.convite_new}`}</p>
      </div>
      <div className="bg-gray-100 p-2 rounded mt-4">
        <p>1 convite gera 0,10% de rendimento</p>
        <p>2 convites geram 0,20% de rendimento</p>
        <p>3 convites geram 0,25% de rendimento</p>
      </div>
      <table className="w-full mt-4">
        <thead>
          <tr>
            <th className="text-left">Nome</th>
            <th className="text-left">Telefone</th>
            <th className="text-left">Rendimento</th>
          </tr>
        </thead>
        <tbody>
          {invitedUsers.map((user, index) => (
            <tr key={index}>
              <td>{user.invited_user_nome}</td>
              <td>{user.invited_user_telefone}</td>
              <td>{(user.rendimento * 100).toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const ContaContent = () => (
    <div>
      <h3 className="text-lg font-bold text-center text-black " >Configurações da Conta</h3>
      <div className="flex flex-col space-y-3 mt-5">
        <button className="bg-blue-500 text-white p-2 rounded">Depositar</button>
        <button className="bg-blue-500 text-white p-2 rounded">Saque</button>
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
    </div>
  );
};

export default Main;
