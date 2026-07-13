import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CrudPage from '../../components/ui/CrudPage';
import { TableSkeleton } from '../../components/ui/Feedback';

export default function Expenses() {
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    supabase.from('expense_categories').select('id, name').then(({ data }) => setCategories(data ?? []));
  }, []);

  if (!categories) return <TableSkeleton rows={6} cols={4} />;

  const columns = [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'category_id', label: 'Category', type: 'select', options: categories.map((c) => ({ value: c.id, label: c.name })) },
    { key: 'amount', label: 'Amount', type: 'number', required: true },
    { key: 'expense_date', label: 'Date', type: 'date' },
    { key: 'is_recurring', label: 'Recurring', type: 'boolean' },
    { key: 'notes', label: 'Notes', type: 'textarea', hideInTable: true }
  ];

  return <CrudPage title="Expenses" table="expenses" columns={columns} searchKeys={['title']} minRoleWrite="manager" />;
}
