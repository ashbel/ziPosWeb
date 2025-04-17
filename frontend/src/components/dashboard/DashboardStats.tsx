import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, Users, TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}

const StatCard = ({ title, value, icon, description }: StatCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

export function DashboardStats() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Revenue"
        value="$45,231.89"
        icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        description="+20.1% from last month"
      />
      <StatCard
        title="Sales"
        value="+2350"
        icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
        description="+180.1% from last month"
      />
      <StatCard
        title="Active Customers"
        value="+573"
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
        description="+19% from last month"
      />
      <StatCard
        title="Growth"
        value="+12.3%"
        icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        description="+12% from last month"
      />
    </div>
  );
} 