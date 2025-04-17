import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';

export class OfflineSyncService {
  constructor(private database: Database) {}

  async synchronize() {
    const isConnected = await this.checkConnectivity();
    if (!isConnected) return;

    try {
      await synchronize({
        database: this.database,
        pullChanges: async ({ lastPulledAt }) => {
          const response = await fetch(
            `${API_URL}/sync?last_pulled_at=${lastPulledAt}`,
            {
              headers: await this.getAuthHeaders()
            }
          );
          const { changes, timestamp } = await response.json();
          return { changes, timestamp };
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
          await fetch(`${API_URL}/sync`, {
            method: 'POST',
            headers: await this.getAuthHeaders(),
            body: JSON.stringify({ changes, lastPulledAt })
          });
        }
      });

      await AsyncStorage.setItem('lastSyncTime', Date.now().toString());
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  private async checkConnectivity(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected || false;
  }

  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
} 