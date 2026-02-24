// Détecteur de qualité réseau
export class NetworkDetector {
  constructor() {
    this.isOnline = navigator.onLine;
    this.latency = null;
    this.packetLoss = false;
    this._setupListeners();
  }

  _setupListeners() {
    window.addEventListener('online',  () => { this.isOnline = true;  });
    window.addEventListener('offline', () => { this.isOnline = false; });
  }

  async testLatency(url) {
    // Utilise l'URL Supabase depuis les variables d'environnement
    const target = url || import.meta.env.VITE_SUPABASE_URL || 'https://www.google.com';
    const start = performance.now();
    try {
      await fetch(target, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(5000) });
      this.latency = performance.now() - start;
      return this.latency;
    } catch {
      this.latency = null;
      return null;
    }
  }

  async testMultiplePings(count = 3) {
    const results = [];
    for (let i = 0; i < count; i++) {
      const latency = await this.testLatency();
      if (latency !== null) results.push(latency);
      if (i < count - 1) await new Promise(r => setTimeout(r, 300));
    }
    const successRate = results.length / count;
    this.packetLoss = successRate < 0.8;
    return {
      successRate,
      avgLatency: results.length ? results.reduce((a, b) => a + b) / results.length : null,
      packetLoss: this.packetLoss
    };
  }

  getNetworkQuality() {
    if (!this.isOnline)  return 'offline';
    if (this.packetLoss) return 'poor';
    if (!this.latency)   return 'unknown';
    if (this.latency < 100) return 'excellent';
    if (this.latency < 300) return 'good';
    if (this.latency < 600) return 'fair';
    return 'poor';
  }

  async waitForBetterConnection(maxWait = 15000) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      const q = this.getNetworkQuality();
      if (q === 'excellent' || q === 'good') return true;
      await new Promise(r => setTimeout(r, 1500));
    }
    return false;
  }
}

export const networkDetector = new NetworkDetector();
