import { createBrowserRouter } from 'react-router-dom';
import RootLayout from '@/components/layout/RootLayout';
import Layout from '@/components/layout/Layout';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import Products from '@/pages/Products';
import Customers from '@/pages/Customers';
import Inventory from '@/pages/Inventory';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'orders', element: <Orders /> },
          { path: 'products', element: <Products /> },
          { path: 'customers', element: <Customers /> },
          { path: 'inventory', element: <Inventory /> },
          { path: 'reports', element: <Reports /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
]); 