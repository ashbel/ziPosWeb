import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout';
import Dashboard from '../components/admin/Dashboard';
import UsersManagement from '../components/admin/UsersManagement';
import RolesManagement from '../components/admin/RolesManagement';

const AdminRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UsersManagement />} />
        <Route path="roles" element={<RolesManagement />} />
        <Route path="reports" element={<div>Reports</div>} />
        <Route path="search" element={<div>Search</div>} />
        <Route path="files" element={<div>Files</div>} />
        <Route path="settings" element={<div>Settings</div>} />
        <Route path="localization" element={<div>Localization</div>} />
        <Route path="communications" element={<div>Communications</div>} />
        <Route path="backups" element={<div>Backups</div>} />
        <Route path="integrations" element={<div>Integrations</div>} />
        <Route path="monitoring" element={<div>Monitoring</div>} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes; 