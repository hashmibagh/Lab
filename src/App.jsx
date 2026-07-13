import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import Layout from './components/layout/Layout';

import Login from './pages/auth/Login';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/dashboard/Dashboard';
import MedicineList from './pages/medicines/MedicineList';
import Inventory from './pages/inventory/Inventory';
import Purchases from './pages/purchases/Purchases';
import POS from './pages/sales/POS';
import SalesHistory from './pages/sales/SalesHistory';
import Customers from './pages/customers/Customers';
import Suppliers from './pages/suppliers/Suppliers';
import Expenses from './pages/expenses/Expenses';
import Employees from './pages/employees/Employees';
import Prescriptions from './pages/prescriptions/Prescriptions';
import Lab from './pages/lab/Lab';
import Reports from './pages/reports/Reports';
import Notifications from './pages/notifications/Notifications';
import Settings from './pages/settings/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="medicines" element={<MedicineList />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="purchases" element={<ProtectedRoute minRole="manager"><Purchases /></ProtectedRoute>} />
        <Route path="pos" element={<POS />} />
        <Route path="sales" element={<SalesHistory />} />
        <Route path="customers" element={<Customers />} />
        <Route path="suppliers" element={<ProtectedRoute minRole="manager"><Suppliers /></ProtectedRoute>} />
        <Route path="expenses" element={<ProtectedRoute minRole="manager"><Expenses /></ProtectedRoute>} />
        <Route path="employees" element={<ProtectedRoute minRole="manager"><Employees /></ProtectedRoute>} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="lab" element={<Lab />} />
        <Route path="reports" element={<ProtectedRoute minRole="manager"><Reports /></ProtectedRoute>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<ProtectedRoute><Layout /></ProtectedRoute>} />
    </Routes>
  );
}
