import CrudPage from '../../components/ui/CrudPage';

const columns = [
  { key: 'full_name', label: 'Name', type: 'text', required: true },
  { key: 'designation', label: 'Designation', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'salary', label: 'Salary', type: 'number' },
  { key: 'commission_percent', label: 'Commission %', type: 'number', hideInTable: true },
  { key: 'hire_date', label: 'Hire Date', type: 'date' },
  { key: 'is_active', label: 'Active', type: 'boolean', default: true }
];

export default function Employees() {
  return <CrudPage title="Employees" table="employees" columns={columns}
    searchKeys={['full_name', 'designation']} minRoleWrite="manager" />;
}
