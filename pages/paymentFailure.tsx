// pages/paymentFailure.tsx

import { useRouter } from 'next/router';
import { useEffect } from 'react';

const PaymentFailure = () => {
  const router = useRouter();

  useEffect(() => {
    alert('Pagamento não foi concluído. Por favor, tente novamente.');
    router.push('/main');
  }, [router]);

  return <div>Pagamento não concluído.</div>;
};

export default PaymentFailure;
