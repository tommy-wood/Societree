import { useLocalSearchParams } from 'expo-router';

import { StockForm } from '@/components/stock-form';
import { EmptyState } from '@/components/sites';
import { Screen } from '@/components/ui';
import { useData } from '@/lib/data';

export default function EditStockItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useData().stock.find((i) => i.id === id);
  if (!item) {
    return (
      <Screen center>
        <EmptyState>This item no longer exists.</EmptyState>
      </Screen>
    );
  }
  return <StockForm item={item} />;
}
