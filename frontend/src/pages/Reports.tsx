import { Button } from '../components/ui/button';

const Reports = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reports</h1>
        <Button>Generate Report</Button>
      </div>
      <div className="h-[500px] flex items-center justify-center border rounded-lg">
        Reports content will go here
      </div>
    </div>
  );
};

export default Reports; 