import { Button } from '../components/ui/button';

const Inventory = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <Button>Add Item</Button>
      </div>
      <div className="h-[500px] flex items-center justify-center border rounded-lg">
        Inventory content will go here
      </div>
    </div>
  );
};

export default Inventory; 