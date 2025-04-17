import { Route, Routes } from 'react-router-dom';
import { RoleList } from '@/components/roles/RoleList';
import { RoleForm } from '@/components/roles/RoleForm';
import { RequireAuth } from '@/components/auth/RequireAuth';

export function RoleRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <RoleList />
          </RequireAuth>
        }
      />
      <Route
        path="/new"
        element={
          <RequireAuth>
            <RoleForm />
          </RequireAuth>
        }
      />
      <Route
        path="/:id"
        element={
          <RequireAuth>
            <RoleForm />
          </RequireAuth>
        }
      />
    </Routes>
  );
} 