import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface POSDatabase extends DBSchema {
  pendingTransactions: {
    key: string;
    value: {
      id: string;
      type: 'sale' | 'return' | 'inventory';
      data: any;
      timestamp: number;
      status: 'pending' | 'syncing' | 'error';
      error?: string;
    };
  };
  products: {
    key: string;
    value: {
      id: string;
      name: string;
      price: number;
      stock: number;
      lastSync: number;
    };
  };
  customers: {
    key: string;
    value: {
      id: string;
      name: string;
      email: string;
      lastSync: number;
    };
  };
}

class OfflineStorage {
  private db: IDBPDatabase<POSDatabase> | null = null;

  async init() {
    this.db = await openDB<POSDatabase>('pos-system', 1, {
      upgrade(db) {
        db.createObjectStore('pendingTransactions', { keyPath: 'id' });
        db.createObjectStore('products', { keyPath: 'id' });
        db.createObjectStore('customers', { keyPath: 'id' });
      },
    });
  }

  async addPendingTransaction(
    type: 'sale' | 'return' | 'inventory',
    data: any
  ) {
    if (!this.db) await this.init();
    
    const transaction = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      status: 'pending' as const
    };

    await this.db!.add('pendingTransactions', transaction);
    return transaction.id;
  }

  async getPendingTransactions() {
    if (!this.db) await this.init();
    return this.db!.getAll('pendingTransactions');
  }

  async updateTransactionStatus(
    id: string,
    status: 'syncing' | 'error',
    error?: string
  ) {
    if (!this.db) await this.init();
    
    const tx = await this.db!.get('pendingTransactions', id);
    if (tx) {
      tx.status = status;
      if (error) tx.error = error;
      await this.db!.put('pendingTransactions', tx);
    }
  }

  async removePendingTransaction(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('pendingTransactions', id);
  }

  async cacheProducts(products: any[]) {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction('products', 'readwrite');
    await Promise.all([
      ...products.map(product => tx.store.put({
        ...product,
        lastSync: Date.now()
      })),
      tx.done
    ]);
  }

  async getCachedProducts() {
    if (!this.db) await this.init();
    return this.db!.getAll('products');
  }

  async cacheCustomers(customers: any[]) {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction('customers', 'readwrite');
    await Promise.all([
      ...customers.map(customer => tx.store.put({
        ...customer,
        lastSync: Date.now()
      })),
      tx.done
    ]);
  }

  async getCachedCustomers() {
    if (!this.db) await this.init();
    return this.db!.getAll('customers');
  }
}

export const offlineStorage = new OfflineStorage(); 