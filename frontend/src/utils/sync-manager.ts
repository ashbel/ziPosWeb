import { offlineStorage } from './offline-storage';
import api from './api';

class SyncManager {
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;

  startSync(intervalMs: number = 30000) {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(() => {
      this.sync();
    }, intervalMs);

    // Initial sync
    this.sync();
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async sync() {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      // Sync pending transactions
      const pendingTransactions = await offlineStorage.getPendingTransactions();
      
      for (const tx of pendingTransactions) {
        try {
          await offlineStorage.updateTransactionStatus(tx.id, 'syncing');
          
          switch (tx.type) {
            case 'sale':
              await api.post('/sales', tx.data);
              break;
            case 'return':
              await api.post('/returns', tx.data);
              break;
            case 'inventory':
              await api.post('/inventory/adjust', tx.data);
              break;
          }

          await offlineStorage.removePendingTransaction(tx.id);
        } catch (error) {
          await offlineStorage.updateTransactionStatus(
            tx.id,
            'error',
            error.message
          );
        }
      }

      // Update cached data
      const [products, customers] = await Promise.all([
        api.get('/products').then(res => res.data),
        api.get('/customers').then(res => res.data)
      ]);

      await Promise.all([
        offlineStorage.cacheProducts(products),
        offlineStorage.cacheCustomers(customers)
      ]);

    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }
}

export const syncManager = new SyncManager(); 