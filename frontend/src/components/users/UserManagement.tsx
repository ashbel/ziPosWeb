import React, { useState } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useRoles } from '@/hooks/useRoles';
import { UserForm } from './UserForm';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-hot-toast';

export const UserManagement = () => {
  const [isAddingUser, setIsAddingUser] = useState(false);
  const { data: users, isLoading } = useUsers();
  const { data: roles } = useRoles();
  const { createUser, updateUser, deleteUser } = useUsers();

  const handleCreateUser = async (data: any) => {
    try {
      await createUser.mutateAsync(data);
      setIsAddingUser(false);
      toast.success('User created successfully');
    } catch (error) {
      toast.error('Failed to create user');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <button
          onClick={() => setIsAddingUser(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Add User
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center">Loading...</div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users?.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4">{user.name}</td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">{user.role.name}</td>
                  <td className="px-6 py-4">{user.branch.name}</td>
                  <td className="px-6 py-4 space-x-2">
                    <button
                      onClick={() => {/* Handle edit */}}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteUser.mutate(user.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={isAddingUser}
        onClose={() => setIsAddingUser(false)}
        className="fixed inset-0 z-10 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
          <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <UserForm
              roles={roles || []}
              onSubmit={handleCreateUser}
              onCancel={() => setIsAddingUser(false)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}; 