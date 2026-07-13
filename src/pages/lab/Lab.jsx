import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CrudPage from '../../components/ui/CrudPage';
import { TableSkeleton } from '../../components/ui/Feedback';

const STATUS_OPTIONS = [
  { value: 'requested', label: 'Requested' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }
];

export default function Lab() {
  const [customers, setCustomers] = useState(null);

  useEffect(() => {
    supabase.from('customers').select('id, name').is('deleted_at', null).then(({ data }) => setCustomers(data ?? []));
  }, []);

  if (!customers) return <TableSkeleton rows={6} cols={4} />;

  const columns = [
    { key: 'test_name', label: 'Test', type: 'text', required: true },
    { key: 'customer_id', label: 'Patient', type: 'select', options: customers.map((c) => ({ value: c.id, label: c.name })) },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, default: 'requested' },
    { key: 'report_url', label: 'Report URL', type: 'text', hideInTable: true }
  ];

  return <CrudPage title="Laboratory" table="lab_test_requests" columns={columns} searchKeys={['test_name']} minRoleWrite="pharmacist" />;
}
