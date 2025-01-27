// components/RegisterForm.tsx

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import Link from 'next/link';
import Image from 'next/image';

const RegisterForm: React.FC = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    senha: '',
    confirmaSenha: '',
    codigoConvite: '',
    captcha: '',
  });

  const [errors, setErrors] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [captchaValue, setCaptchaValue] = useState<string>(''); 

  useEffect(() => {
    if (router.query.codigoConvite) {
      setForm((prevForm) => ({ ...prevForm, codigoConvite: router.query.codigoConvite as string }));
    }
  }, [router.query]);

  const gerarCodigoConvite = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let codigo = '';
    for (let i = 0; i < 6; i++) {
      codigo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return codigo;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors('');

    if (
      !form.nome ||
      !form.telefone ||
      !form.senha ||
      !form.confirmaSenha ||
      !form.captcha
    ) {
      setErrors('Por favor, preencha todos os campos.');
      return;
    }

    if (form.senha !== form.confirmaSenha) {
      setErrors('As senhas não coincidem.');
      return;
    }

    if (form.captcha !== captchaValue) {
      setErrors('Captcha inválido.');
      return;
    }

    setLoading(true);

    const { data: existingUser, error: fetchError } = await supabase
      .from('user_profile')
      .select('*')
      .eq('telefone', form.telefone)
      .single();

    if (existingUser) {
      setErrors('Telefone já está registrado.');
      setLoading(false);
      return;
    }

    const novoConvite = gerarCodigoConvite();

    const { data: newUser, error } = await supabase.from('user_profile').insert([
      {
        nome: form.nome,
        telefone: form.telefone,
        senha: form.senha, 
        convite_ini: form.codigoConvite || null,
        convite_new: novoConvite,
        saldo_inicial: 40,
        convites: 0,
      },
    ]).single();

    if (error) {
      setErrors('Erro ao registrar. Tente novamente.');
      setLoading(false);
      return;
    }

    if (form.codigoConvite) {
      const { data: inviter, error: inviterError } = await supabase
        .from('user_profile')
        .select('*')
        .eq('convite_new', form.codigoConvite)
        .single();

      if (inviter) {

        await supabase
          .from('user_profile')
          .update({ convites: inviter.convites + 1 })
          .eq('convite_new', form.codigoConvite);

        await supabase
          .from('user_convites')
          .insert([
            {
              user_id: inviter.uuid,
              invited_user_nome: form.nome,
              invited_user_telefone: form.telefone,
              rendimento: 0.001, // 0,10%
            },
          ]);
      }
    }

    setLoading(false);
    router.push('/login');
  };

  useEffect(() => {
    const gerarCaptcha = () => {
      const captcha = Math.floor(10000 + Math.random() * 90000).toString();
      setCaptchaValue(captcha);
    };

    gerarCaptcha();
  }, []);

  return (
    <form onSubmit={handleRegistro} className="space-y-4">
    <div className="flex flex-col items-center">
      <Image src="/logo.png" alt="Logo Ocean Invest" width={60} height={60} />
      <h1 className="text-2xl font-bold text-center text-black">Ocean Invest</h1>
    </div>

    <h2 className="text-xl font-semibold text-center text-black">Registrar</h2>

      {errors && <p className="text-red-500 text-sm">{errors}</p>}

      <input
        type="text"
        name="nome"
        placeholder="Nome"
        value={form.nome}
        onChange={handleChange}
        className="w-full px-3 py-2 rounded bg-white bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
      />

      <input
        type="text"
        name="telefone"
        placeholder="Telefone"
        value={form.telefone}
        onChange={handleChange}
        className="w-full px-3 py-2 rounded bg-white bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500  text-black"
      />

      <input
        type="password"
        name="senha"
        placeholder="Senha"
        value={form.senha}
        onChange={handleChange}
        className="w-full px-3 py-2 rounded bg-white bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500  text-black"
      />

      <input
        type="password"
        name="confirmaSenha"
        placeholder="Confirme a Senha"
        value={form.confirmaSenha}
        onChange={handleChange}
        className="w-full px-3 py-2 rounded bg-white bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500  text-black"
      />

      <input
        type="text"
        name="codigoConvite"
        placeholder="Código de Convite (Opcional)"
        value={form.codigoConvite}
        onChange={handleChange}
        className="w-full px-3 py-2 rounded bg-white bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500  text-black"
      />

      <div className="flex flex-wrap items-center space-x-2">
        <span className="text-black">Captcha:</span>
        <div className="bg-gray-700 bg-opacity-50 rounded px-3 py-1">
          <span className="text-black font-bold">{captchaValue}</span>
        </div>
        <input
          type="text"
          name="captcha"
          placeholder="Digite o captcha"
          value={form.captcha}
          onChange={handleChange}
          className="flex-1 min-w-[120px] px-2 py-2 rounded bg-white bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500  text-black"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-300  text-black"
      >
        {loading ? 'Registrando...' : 'Registrar'}
      </button>

      <p className="text-center text-black">
        Já tem uma conta?{' '}
        <Link href="/login" className="text-blue-300 hover:underline">Faça login</Link>
      </p>
    </form>
  );
};

export default RegisterForm;
