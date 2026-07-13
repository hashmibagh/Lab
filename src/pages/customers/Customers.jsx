import CrudPage from '../../components/ui/CrudPage';

const columns = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'whatsapp', label: 'WhatsApp', type: 'text' },
  { key: 'address', label: 'Address', type: 'textarea' },
  { key: 'cnic', label: 'CNIC / ID', type: 'text' },
  { key: 'medical_notes', label: 'Medical Notes', type: 'textarea', hideInTable: true },
  { key: 'credit_limit', label: 'Credit Limit', type: 'number' },
  { key: 'reward_points', label: 'Reward Points', type: 'number', hideInTable: true },
  { key: 'is_active', label: 'Active', type: 'boolean', default: true }
];

export default function Customers() {
  return <CrudPage title="Customers" table="customers" columns={columns}
    searchKeys={['name', 'phone', 'cnic']} minRoleWrite="cashier" />;
}
