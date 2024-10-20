// pages/paymentPending.tsx

import { useRouter } from 'next/router';
import { useEffect } from 'react';

const PaymentPending = () => {
  const router = useRouter();

  useEffect(() => {
    alert('Pagamento pendente. Aguarde a confirmação.');
    router.push('/main');
  }, [router]);

  return <div>Pagamento pendente...</div>;
};

export default PaymentPending;
