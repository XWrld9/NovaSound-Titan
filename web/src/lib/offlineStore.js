/**
 * Offline Store - NovaSound TITAN LUX V410000
 * Stockage local pour les messages et données hors-ligne
 */

const OFFLINE_STORE_KEY = 'novasound_offline_data';
const OFFLINE_MESSAGES_KEY = 'novasound_offline_messages';

// Stockage générique pour les données hors-ligne
export const offlineStore = {
  // Sauvegarder des données
  async save(key, data) {
    try {
      const store = JSON.parse(localStorage.getItem(OFFLINE_STORE_KEY) || '{}');
      store[key] = {
        data,
        timestamp: Date.now(),
        synced: false
      };
      localStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify(store));
      return true;
    } catch (error) {
      console.error('[OfflineStore] save error:', error);
      return false;
    }
  },

  // Récupérer des données
  async get(key) {
    try {
      const store = JSON.parse(localStorage.getItem(OFFLINE_STORE_KEY) || '{}');
      return store[key]?.data || null;
    } catch (error) {
      console.error('[OfflineStore] get error:', error);
      return null;
    }
  },

  // Marquer comme synchronisé
  async markSynced(key) {
    try {
      const store = JSON.parse(localStorage.getItem(OFFLINE_STORE_KEY) || '{}');
      if (store[key]) {
        store[key].synced = true;
        localStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify(store));
      }
      return true;
    } catch (error) {
      console.error('[OfflineStore] markSynced error:', error);
      return false;
    }
  },

  // Nettoyer les anciennes données (plus de 7 jours)
  async cleanup() {
    try {
      const store = JSON.parse(localStorage.getItem(OFFLINE_STORE_KEY) || '{}');
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      Object.keys(store).forEach(key => {
        if (store[key].timestamp < sevenDaysAgo) {
          delete store[key];
        }
      });
      
      localStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify(store));
      return true;
    } catch (error) {
      console.error('[OfflineStore] cleanup error:', error);
      return false;
    }
  }
};

// Gestion spécifique pour les messages du chat
export const offlineMessages = {
  // Ajouter un message hors-ligne
  async addMessage(content, replyTo = null) {
    try {
      const messages = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      const message = {
        id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        replyTo,
        timestamp: Date.now(),
        synced: false,
        pending: true
      };
      messages.push(message);
      localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(messages));
      return message;
    } catch (error) {
      console.error('[OfflineMessages] addMessage error:', error);
      return null;
    }
  },

  // Récupérer tous les messages non synchronisés
  async getPendingMessages() {
    try {
      const messages = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      return messages.filter(msg => !msg.synced);
    } catch (error) {
      console.error('[OfflineMessages] getPendingMessages error:', error);
      return [];
    }
  },

  // Marquer un message comme synchronisé
  async markMessageSynced(messageId) {
    try {
      const messages = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        messages[messageIndex].synced = true;
        messages[messageIndex].pending = false;
        localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(messages));
      }
      return true;
    } catch (error) {
      console.error('[OfflineMessages] markMessageSynced error:', error);
      return false;
    }
  },

  // Supprimer un message (après synchronisation réussie)
  async removeMessage(messageId) {
    try {
      const messages = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      const filteredMessages = messages.filter(msg => msg.id !== messageId);
      localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(filteredMessages));
      return true;
    } catch (error) {
      console.error('[OfflineMessages] removeMessage error:', error);
      return false;
    }
  },

  // Nettoyer les anciens messages (plus de 24h)
  async cleanup() {
    try {
      const messages = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const filteredMessages = messages.filter(msg => 
        msg.timestamp > oneDayAgo || !msg.synced
      );
      localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(filteredMessages));
      return true;
    } catch (error) {
      console.error('[OfflineMessages] cleanup error:', error);
      return false;
    }
  }
};

// Nettoyage automatique au démarrage
if (typeof window !== 'undefined') {
  setTimeout(() => {
    offlineStore.cleanup();
    offlineMessages.cleanup();
  }, 5000);
}

export default offlineStore;
