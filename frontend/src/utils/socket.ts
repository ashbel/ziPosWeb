import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';

interface ServerToClientEvents {
  orderUpdate: (order: any) => void;
  stockAlert: (product: any) => void;
  notification: (notification: any) => void;
}

interface ClientToServerEvents {
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
}

class SocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private subscriptions: Set<string> = new Set();

  connect(token: string) {
    this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.resubscribe();
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('orderUpdate', (order) => {
      toast.success(`Order #${order.id} status updated to ${order.status}`);
    });

    this.socket.on('stockAlert', (product) => {
      toast.error(
        `Low stock alert: ${product.name} (${product.currentStock} remaining)`
      );
    });

    this.socket.on('notification', (notification) => {
      toast(notification.message, {
        icon: notification.type === 'success' ? '✅' : '❗',
      });
    });
  }

  subscribe(channel: string) {
    if (!this.socket) return;
    this.subscriptions.add(channel);
    this.socket.emit('subscribe', [channel]);
  }

  unsubscribe(channel: string) {
    if (!this.socket) return;
    this.subscriptions.delete(channel);
    this.socket.emit('unsubscribe', [channel]);
  }

  private resubscribe() {
    if (!this.socket || this.subscriptions.size === 0) return;
    this.socket.emit('subscribe', Array.from(this.subscriptions));
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
    this.subscriptions.clear();
  }
}

export const socketManager = new SocketManager(); 