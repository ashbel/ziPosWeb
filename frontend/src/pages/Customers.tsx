import { Button } from '../components/ui/button';

const Customers = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Button>Add Customer</Button>
      </div>
      <div className="h-[500px] flex items-center justify-center border rounded-lg">
        Customers content will go here
      </div>
    </div>
  );
};

export default Customers; 