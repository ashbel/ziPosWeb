import { useContext, createContext } from 'react';
import { HardwareIntegrationService } from '@/services/hardware-integration.service';

const HardwareContext = createContext<{
  hardwareService: HardwareIntegrationService;
}>({
  hardwareService: null!
});

export const useHardware = () => {
  const context = useContext(HardwareContext);
  if (!context) {
    throw new Error('useHardware must be used within a HardwareProvider');
  }
  return context;
};

export const HardwareProvider: React.FC = ({ children }) => {
  const hardwareService = new HardwareIntegrationService();

  return (
    <HardwareContext.Provider value={{ hardwareService }}>
      {children}
    </HardwareContext.Provider>
  );
}; 