/**
 * Centralized Generic Multilayer Perceptron (MLP) Engine for Zenith
 * 
 * Unified ML engine that supports:
 * - Supabase cloud storage (primary)
 * - LocalStorage fallback (offline cache)
 * - Synchronous local training for instant predictions
 * - Async cloud sync for cross-device persistence
 */

export class SimpleMLP {
  W1: number[][];
  B1: number[];
  W2: number[][];
  B2: number[];
  modelName: string;
  private _loaded = false;

  constructor(
    _inputSize: number,
    _hiddenSize: number,
    _outputSize: number,
    modelName: string,
    defaultWeightsGenerator: () => { W1: number[][]; B1: number[]; W2: number[][]; B2: number[] }
  ) {
    this.modelName = modelName;
    const def = defaultWeightsGenerator();
    this.W1 = def.W1;
    this.B1 = def.B1;
    this.W2 = def.W2;
    this.B2 = def.B2;
  }

  /** Whether weights have been loaded from persistent storage */
  get loaded(): boolean { return this._loaded; }

  // ─── STORAGE ──────────────────────────────────────────────────────────────────

  /** Load weights from Supabase, fallback to LocalStorage */
  async loadOrInit(supabase: any, userId: string): Promise<void> {
    // 1. Try Supabase first (source of truth)
    const cloudLoaded = await this.loadFromSupabase(supabase, userId);
    if (cloudLoaded) {
      this._loaded = true;
      this._cacheToLocalStorage();
      return;
    }

    // 2. Fallback: try localStorage (offline cache)
    if (this._loadFromLocalStorage()) {
      this._loaded = true;
      // Sync cached weights up to Supabase in background
      this.saveToSupabase(supabase, userId).catch(() => {});
      return;
    }

    // 3. Keep default weights (from constructor)
  }

  /** Load weights from Supabase public.ml_weights table */
  async loadFromSupabase(supabase: any, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('ml_weights')
        .select('weights')
        .eq('user_id', userId)
        .eq('model_name', this.modelName)
        .maybeSingle();

      if (error) {
        console.error(`Error loading weights for ${this.modelName}:`, error);
        return false;
      }

      if (data && data.weights) {
        const loaded = data.weights;
        if (loaded.W1 && loaded.B1 && loaded.W2 && loaded.B2 && 
            loaded.W1.length === this.W1.length && loaded.B1.length === this.B1.length) {
          this.W1 = loaded.W1;
          this.B1 = loaded.B1;
          this.W2 = loaded.W2;
          this.B2 = loaded.B2;
          return true;
        }
      }
    } catch (e) {
      console.error(`Catch error loading weights for ${this.modelName}:`, e);
    }
    return false;
  }

  /** Save weights to Supabase public.ml_weights table */
  async saveToSupabase(supabase: any, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ml_weights')
        .upsert({
          user_id: userId,
          model_name: this.modelName,
          weights: {
            W1: this.W1,
            B1: this.B1,
            W2: this.W2,
            B2: this.B2
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,model_name'
        });

      if (error) {
        console.error(`Error saving weights for ${this.modelName}:`, error);
        return false;
      }
      return true;
    } catch (e) {
      console.error(`Catch error saving weights for ${this.modelName}:`, e);
    }
    return false;
  }

  /** Cache current weights to localStorage (silent fail for non-browser envs) */
  private _cacheToLocalStorage(): void {
    try {
      localStorage.setItem(this.modelName, JSON.stringify({
        W1: this.W1, B1: this.B1, W2: this.W2, B2: this.B2
      }));
    } catch { /* localStorage not available */ }
  }

  /** Load weights from localStorage cache */
  private _loadFromLocalStorage(): boolean {
    try {
      const saved = localStorage.getItem(this.modelName);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.W1 && parsed.B1 && parsed.W2 && parsed.B2 &&
            parsed.W1.length === this.W1.length && parsed.B1.length === this.B1.length) {
          this.W1 = parsed.W1;
          this.B1 = parsed.B1;
          this.W2 = parsed.W2;
          this.B2 = parsed.B2;
          return true;
        }
      }
    } catch { /* localStorage not available */ }
    return false;
  }

  /** Reset weights by removing from localStorage */
  reset(): void {
    try { localStorage.removeItem(this.modelName); } catch { /* noop */ }
  }

  // ─── INFERENCE ────────────────────────────────────────────────────────────────

  predict(x: number[]): number[] {
    const h = new Array(this.B1.length).fill(0);
    for (let col = 0; col < this.B1.length; col++) {
      let sum = 0;
      for (let row = 0; row < x.length; row++) {
        sum += x[row] * this.W1[row][col];
      }
      h[col] = Math.max(0, sum + this.B1[col]); // relu
    }

    const y = new Array(this.B2.length).fill(0);
    for (let col = 0; col < this.B2.length; col++) {
      let sum = 0;
      for (let row = 0; row < h.length; row++) {
        sum += h[row] * this.W2[row][col];
      }
      y[col] = 1 / (1 + Math.exp(-(sum + this.B2[col]))); // sigmoid
    }

    return y;
  }

  // ─── TRAINING ─────────────────────────────────────────────────────────────────

  /**
   * Train locally (synchronous). Updates weights in-memory and caches to localStorage.
   * Use this for fast, synchronous training in the browser.
   */
  trainLocal(x: number[], targets: number[], lr: number = 0.15): number[] {
    this._backprop(x, targets, lr);
    this._cacheToLocalStorage();
    return this.predict(x);
  }

  /**
   * Train and save to Supabase (async). Backward compatible with existing callers.
   * Used by Hub backgroundTrainer and Kratos for cloud-synced training.
   */
  async train(supabase: any, userId: string, x: number[], targets: number[], lr: number = 0.15): Promise<number[]> {
    this._backprop(x, targets, lr);
    this._cacheToLocalStorage();
    await this.saveToSupabase(supabase, userId);
    return this.predict(x);
  }

  /**
   * Train locally, then sync to Supabase in background (fire-and-forget).
   * Returns predictions immediately without waiting for the cloud save.
   */
  trainAndSync(supabase: any, userId: string, x: number[], targets: number[], lr: number = 0.15): number[] {
    this._backprop(x, targets, lr);
    this._cacheToLocalStorage();
    this.saveToSupabase(supabase, userId).catch(() => {});
    return this.predict(x);
  }

  /** Core backpropagation (SGD with BCE loss gradient) */
  private _backprop(x: number[], targets: number[], lr: number): void {
    // Forward pass (with pre-activation values for ReLU derivative)
    const hIn = new Array(this.B1.length).fill(0);
    const h = new Array(this.B1.length).fill(0);
    for (let col = 0; col < this.B1.length; col++) {
      let sum = 0;
      for (let row = 0; row < x.length; row++) {
        sum += x[row] * this.W1[row][col];
      }
      hIn[col] = sum + this.B1[col];
      h[col] = Math.max(0, hIn[col]); // relu
    }

    const y = new Array(this.B2.length).fill(0);
    for (let col = 0; col < this.B2.length; col++) {
      let sum = 0;
      for (let row = 0; row < h.length; row++) {
        sum += h[row] * this.W2[row][col];
      }
      y[col] = 1 / (1 + Math.exp(-(sum + this.B2[col]))); // sigmoid
    }

    // Output delta (BCE loss gradient)
    const delta2 = new Array(this.B2.length).fill(0);
    for (let k = 0; k < this.B2.length; k++) {
      delta2[k] = y[k] - targets[k];
    }

    // Hidden delta
    const delta1 = new Array(this.B1.length).fill(0);
    for (let j = 0; j < this.B1.length; j++) {
      let errorSum = 0;
      for (let k = 0; k < this.B2.length; k++) {
        errorSum += delta2[k] * this.W2[j][k];
      }
      delta1[j] = errorSum * (hIn[j] > 0 ? 1 : 0);
    }

    // Update weights W2 & B2
    for (let k = 0; k < this.B2.length; k++) {
      this.B2[k] -= lr * delta2[k];
      for (let j = 0; j < h.length; j++) {
        this.W2[j][k] -= lr * delta2[k] * h[j];
      }
    }

    // Update weights W1 & B1
    for (let j = 0; j < this.B1.length; j++) {
      this.B1[j] -= lr * delta1[j];
      for (let i = 0; i < x.length; i++) {
        this.W1[i][j] -= lr * delta1[j] * x[i];
      }
    }
  }
}
