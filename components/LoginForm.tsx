import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import Link from 'next/link';

const LoginForm: React.FC = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    telefone: '',
    senha: '',
  });

  const [errors, setErrors] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors('');

    if (!form.telefone || !form.senha) {
      setErrors('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);

    // Verificação manual de `telefone` e `senha`
    const { data: user, error } = await supabase
      .from('user_profile')
      .select('*')
      .eq('telefone', form.telefone)
      .single();

    if (error || !user || user.senha !== form.senha) {
      setErrors('Telefone ou senha inválidos.');
      setLoading(false);
      return;
    }

    // Simulação de criação de um token JWT customizado (use uma função serverless para gerar tokens reais)
    const customToken = btoa(JSON.stringify({ user_id: user.uuid, telefone: user.telefone }));

    // Armazena o token no local storage
    localStorage.setItem('auth_token', customToken);

    setLoading(false);
    router.push('/main');
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-black">Login</h2>

      {errors && <p className="text-red-500 text-sm">{errors}</p>}

      <input
        type="text"
        name="telefone"
        placeholder="Telefone"
        value={form.telefone}
        onChange={handleChange}
        className="w-full px-3 py-2 rounded bg-white bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
      />

      <input
        type="password"
        name="senha"
        placeholder="Senha"
        value={form.senha}
        onChange={handleChange}
        className="w-full px-3 py-2 rounded bg-white bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-300 text-black"
      >
        {loading ? 'Entrando...' : 'Login'}
      </button>

      <p className="text-center text-black">
        Não tem uma conta?{' '}
        <Link href="/register" className="text-blue-300 hover:underline">
          Registre-se
        </Link>
      </p>
    </form>
  );
};

export default LoginForm;
