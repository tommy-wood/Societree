import { useLocalSearchParams } from 'expo-router';

import { StockForm } from '@/components/stock-form';

export default function NewStockItem() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return <StockForm defaultCategory={category === 'tool' ? 'tool' : 'material'} />;
}
