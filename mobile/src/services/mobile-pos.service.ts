import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb/QueryDescription';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import { OfflineSyncService } from './offline-sync.service';

export class MobilePosService {
  private syncService: OfflineSyncService;

  constructor(private database: Database) {
    this.syncService = new OfflineSyncService(database);
  }

  async createSale(data: {
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    customerId?: string;
    paymentMethod: string;
    amount: number;
  }) {
    await this.database.action(async () => {
      const salesCollection = this.database.collections.get('sales');
      const sale = await salesCollection.create((sale) => {
        sale.items = data.items;
        sale.customerId = data.customerId;
        sale.paymentMethod = data.paymentMethod;
        sale.amount = data.amount;
        sale.status = 'pending_sync';
        sale.createdAt = new Date();
      });

      // Update local inventory
      const inventoryCollection = this.database.collections.get('inventory');
      for (const item of data.items) {
        const inventory = await inventoryCollection
          .query(Q.where('productId', item.productId))
          .fetchOne();

        await inventory.update(inv => {
          inv.quantity -= item.quantity;
        });
      }
    });

    // Try to sync immediately
    try {
      await this.syncService.synchronize();
    } catch (error) {
      console.error('Failed to sync sale:', error);
    }
  }

  async searchProducts(query: string) {
    const productsCollection = this.database.collections.get('products');
    return productsCollection
      .query(
        Q.or(
          Q.where('name', Q.like(`%${query}%`)),
          Q.where('barcode', Q.like(`%${query}%`))
        )
      )
      .fetch();
  }

  async getInventoryStatus(productId: string) {
    const inventoryCollection = this.database.collections.get('inventory');
    return inventoryCollection
      .query(Q.where('productId', productId))
      .fetchOne();
  }
} 