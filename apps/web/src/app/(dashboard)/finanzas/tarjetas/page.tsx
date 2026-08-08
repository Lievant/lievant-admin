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

  try {
    [cards, reports] = await Promise.all([
      getCreditCards(true),
      getAllCardReports({
        ...(status ? { status } : {}),
        ...(creditCardId ? { creditCardId } : {}),
        limit: 100,
      }).then((p) => p.items),
    ]);
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <CreditCardsScreen
        cards={cards}
        reports={reports}
        errorKind={errorKind}
        activeTab={tab === 'reportes' ? 'reportes' : 'tarjetas'}
        activeStatus={status ?? ''}
        activeCardId={creditCardId ?? ''}
      />
    </div>
  );
}
