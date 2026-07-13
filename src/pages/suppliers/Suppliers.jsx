import CrudPage from '../../components/ui/CrudPage';

const columns = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'contact_person', label: 'Contact Person', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'whatsapp', label: 'WhatsApp', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'address', label: 'Address', type: 'textarea', hideInTable: true },
  { key: 'tax_number', label: 'Tax Number', type: 'text', hideInTable: true },
  { key: 'opening_balance', label: 'Opening Balance', type: 'number' },
  { key: 'is_active', label: 'Active', type: 'boolean', default: true }
];

export default function Suppliers() {
  return <CrudPage title="Suppliers" table="suppliers" columns={columns}
    searchKeys={['name', 'phone', 'email']} minRoleWrite="manager" />;
}
