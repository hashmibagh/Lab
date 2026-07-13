import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CrudPage from '../../components/ui/CrudPage';
import { TableSkeleton } from '../../components/ui/Feedback';

export default function Prescriptions() {
  const [customers, setCustomers] = useState(null);

  useEffect(() => {
    supabase.from('customers').select('id, name').is('deleted_at', null).then(({ data }) => setCustomers(data ?? []));
  }, []);

  if (!customers) return <TableSkeleton rows={6} cols={4} />;

  const columns = [
    { key: 'patient_name', label: 'Patient Name', type: 'text', required: true },
    { key: 'customer_id', label: 'Linked Customer', type: 'select', options: customers.map((c) => ({ value: c.id, label: c.name })), hideInTable: true },
    { key: 'doctor_name', label: 'Doctor', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'image_url', label: 'Prescription Scan / PDF', type: 'file', bucket: 'prescriptions', fileKind: 'file' }
  ];

  return <CrudPage title="Prescriptions" table="prescriptions" columns={columns}
    searchKeys={['patient_name', 'doctor_name']} minRoleWrite="pharmacist" />;
}
