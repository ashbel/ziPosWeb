import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Settings,
  BarChart,
  Truck,
  Bell,
  FileText,
  Globe,
  Server,
  Database,
  Mail,
  MessageSquare,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Sales', href: '/sales', icon: ShoppingCart },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Reports', href: '/reports', icon: BarChart },
  { name: 'Shipping', href: '/shipping', icon: Truck },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Localization', href: '/localization', icon: Globe },
  { name: 'System', href: '/system', icon: Server },
  { name: 'Backup', href: '/backup', icon: Database },
  { name: 'Communication', href: '/communication', icon: Mail },
  { name: 'Integration', href: '/integration', icon: MessageSquare },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-64 bg-background border-r">
      <div className="flex h-16 items-center px-4">
        <h1 className="text-xl font-bold">POS System</h1>
      </div>
      <nav className="space-y-1 px-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center px-2 py-2 text-sm font-medium rounded-md',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
} 