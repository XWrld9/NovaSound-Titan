// Détecteur de qualité réseau et fallback automatique
export class NetworkDetector {
  constructor() {
    this.isOnline = navigator.onLine;
    this.latency = null;
    this.packetLoss = false;
    this.setupListeners();
  }
  
  setupListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Network online');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📵 Network offline');
    });
  }
  
  async testLatency(url = 'https://tleuzlyfelrnykpbwhkc.supabase.co') {
    const start = performance.now();
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors',
        signal: AbortSignal.timeout(5000)
      });
      this.latency = performance.now() - start;
      return this.latency;
    } catch {
      this.latency = null;
      return null;
    }
  }
  
  async testMultiplePings(url = 'https://tleuzlyfelrnykpbwhkc.supabase.co', count = 4) {
    const results = [];
    for (let i = 0; i < count; i++) {
      const latency = await this.testLatency(url);
      if (latency !== null) {
        results.push(latency);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const successRate = results.length / count;
    this.packetLoss = successRate < 0.8; // Plus de 20% de perte = problème
    
    return {
      successRate,
      avgLatency: results.length > 0 ? results.reduce((a, b) => a + b) / results.length : null,
      packetLoss: this.packetLoss
    };
  }
  
  getNetworkQuality() {
    if (!this.isOnline) return 'offline';
    if (this.packetLoss) return 'poor';
    if (!this.latency) return 'unknown';
    if (this.latency < 100) return 'excellent';
    if (this.latency < 200) return 'good';
    if (this.latency < 500) return 'fair';
    return 'poor';
  }
  
  async waitForBetterConnection(maxWait = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const quality = this.getNetworkQuality();
      if (quality === 'excellent' || quality === 'good') {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return false;
  }
}

export const networkDetector = new NetworkDetector();
