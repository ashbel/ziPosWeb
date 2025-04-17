import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { BehaviorSubject } from 'rxjs';
import { NetworkInfo } from '@capacitor/network';
import { Printer } from '@awesome-cordova-plugins/printer';
import { Storage } from '@ionic/storage';

export class MobileFeaturesService {
  private syncStatus$ = new BehaviorSubject<'syncing' | 'synced' | 'error'>('synced');
  private networkStatus$ = new BehaviorSubject<boolean>(true);

  constructor(
    private database: Database,
    private storage: Storage,
    private api: ApiService
  ) {
    this.initializeNetworkListener();
  }

  private async initializeNetworkListener() {
    NetworkInfo.addListener('networkStatusChange', status => {
      this.networkStatus$.next(status.connected);
      if (status.connected) {
        this.syncPendingTransactions();
      }
    });
  }

  async performMobileInventoryCount(data: {
    productId: string;
    count: number;
    location: string;
    notes?: string;
  }) {
    const collection = this.database.collections.get('inventory_counts');
    
    await this.database.action(async () => {
      await collection.create(count => {
        count.productId = data.productId;
        count.count = data.count;
        count.location = data.location;
        count.notes = data.notes;
        count.timestamp = new Date();
        count.syncStatus = 'pending';
      });
    });

    if (this.networkStatus$.value) {
      await this.syncInventoryCounts();
    }
  }

  async processMobileSale(sale: {
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    customerId?: string;
    paymentMethod: string;
    total: number;
  }) {
    const collection = this.database.collections.get('sales');
    
    await this.database.action(async () => {
      await collection.create(record => {
        record.items = sale.items;
        record.customerId = sale.customerId;
        record.paymentMethod = sale.paymentMethod;
        record.total = sale.total;
        record.timestamp = new Date();
        record.syncStatus = 'pending';
      });
    });

    if (this.networkStatus$.value) {
      await this.syncSales();
    }
  }

  async printMobileReceipt(sale: any) {
    const receiptHtml = this.generateReceiptHtml(sale);
    
    try {
      await Printer.print(receiptHtml, {
        name: `Receipt-${sale.id}`,
        duplex: false,
        orientation: 'portrait'
      });
      return true;
    } catch (error) {
      console.error('Printing failed:', error);
      return false;
    }
  }

  private generateReceiptHtml(sale: any): string {
    // Implementation of receipt HTML generation
    return `
      <html>
        <body style="font-family: monospace;">
          <!-- Receipt content -->
        </body>
      </html>
    `;
  }

  async syncPendingTransactions() {
    this.syncStatus$.next('syncing');

    try {
      await Promise.all([
        this.syncInventoryCounts(),
        this.syncSales()
      ]);
      
      this.syncStatus$.next('synced');
    } catch (error) {
      console.error('Sync failed:', error);
      this.syncStatus$.next('error');
    }
  }

  private async syncInventoryCounts() {
    const collection = this.database.collections.get('inventory_counts');
    const pendingCounts = await collection
      .query(Q.where('syncStatus', 'pending'))
      .fetch();

    for (const count of pendingCounts) {
      try {
        await this.api.post('/inventory/counts', {
          productId: count.productId,
          count: count.count,
          location: count.location,
          notes: count.notes,
          timestamp: count.timestamp
        });

        await this.database.action(async () => {
          await count.update(record => {
            record.syncStatus = 'synced';
          });
        });
      } catch (error) {
        console.error(`Failed to sync count ${count.id}:`, error);
      }
    }
  }

  private async syncSales() {
    const collection = this.database.collections.get('sales');
    const pendingSales = await collection
      .query(Q.where('syncStatus', 'pending'))
      .fetch();

    for (const sale of pendingSales) {
      try {
        await this.api.post('/sales', {
          items: sale.items,
          customerId: sale.customerId,
          paymentMethod: sale.paymentMethod,
          total: sale.total,
          timestamp: sale.timestamp
        });

        await this.database.action(async () => {
          await sale.update(record => {
            record.syncStatus = 'synced';
          });
        });
      } catch (error) {
        console.error(`Failed to sync sale ${sale.id}:`, error);
      }
    }
  }

  async getMobileDashboardData() {
    const cachedData = await this.storage.get('dashboard_data');
    const cacheExpiry = await this.storage.get('dashboard_data_expiry');

    if (cachedData && cacheExpiry && new Date().getTime() < cacheExpiry) {
      return cachedData;
    }

    if (!this.networkStatus$.value) {
      return cachedData || { error: 'Offline mode' };
    }

    try {
      const data = await this.api.get('/mobile/dashboard');
      
      await this.storage.set('dashboard_data', data);
      await this.storage.set(
        'dashboard_data_expiry',
        new Date().getTime() + 5 * 60 * 1000 // 5 minutes cache
      );

      return data;
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      return cachedData || { error: 'Failed to fetch data' };
    }
  }
} 