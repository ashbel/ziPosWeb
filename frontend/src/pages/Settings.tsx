import { Button } from '../components/ui/button';

const Settings = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button>Save Changes</Button>
      </div>
      <div className="h-[500px] flex items-center justify-center border rounded-lg">
        Settings content will go here
      </div>
    </div>
  );
};

export default Settings; 