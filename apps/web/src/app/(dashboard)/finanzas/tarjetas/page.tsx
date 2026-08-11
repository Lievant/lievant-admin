import {
  errorKindOf,
  getAllCardReports,
  getCreditCards,
  type CardExpenseReportItem,
  type CreditCardItem,
  type ErrorKind,
} from '@/lib/api';
import { CreditCardsScreen } from './credit-cards-screen';

export default async function FinanzasTarjetasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; creditCardId?: string }>;
}) {
  const { tab, status, creditCardId } = await searchParams;

  let cards: CreditCardItem[] = [];
  let reports: CardExpenseReportItem[] = [];
  let errorKind: ErrorKind | null = null;
  let reportsErrorKind: ErrorKind | null = null;

  // Cada pestaña se resuelve por separado: el maestro pide finanzas.tarjetas.read
  // y los reportes finanzas.gastos-tarjeta.read. Con un Promise.all, un 403 en
  // los reportes tumbaba también la pestaña de tarjetas.
  const [cardsResult, reportsResult] = await Promise.allSettled([
    getCreditCards(true),
    getAllCardReports({
      ...(status ? { status } : {}),
      ...(creditCardId ? { creditCardId } : {}),
      limit: 100,
    }).then((p) => p.items),
  ]);

  if (cardsResult.status === 'fulfilled') {
    cards = cardsResult.value;
  } else {
    errorKind = errorKindOf(cardsResult.reason);
  }

  if (reportsResult.status === 'fulfilled') {
    reports = reportsResult.value;
  } else {
    reportsErrorKind = errorKindOf(reportsResult.reason);
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <CreditCardsScreen
        cards={cards}
        reports={reports}
        errorKind={errorKind}
        reportsErrorKind={reportsErrorKind}
        activeTab={tab === 'reportes' ? 'reportes' : 'tarjetas'}
        activeStatus={status ?? ''}
        activeCardId={creditCardId ?? ''}
      />
    </div>
  );
}
