import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { nome, telefone, pix_key, amount } = req.body;

  if (!nome || !telefone || !pix_key || !amount) {
    return res.status(400).json({ error: 'Dados incompletos para processar o saque.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, 
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECEIVER, 
    subject: 'Novo pedido de saque',
    text: `Nome: ${nome}\nTelefone: ${telefone}\nPIX: ${pix_key}\nValor: R$ ${amount.toFixed(2)}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    res.status(500).json({ error: 'Erro ao enviar email' });
  }
}
