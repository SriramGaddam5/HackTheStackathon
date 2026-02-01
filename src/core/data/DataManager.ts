
        export class DataManager {
          private autoSaveInterval: number = 30000; // 30 seconds
          private lastSavepoint: string;
          
          constructor() {
            this.initializeAutoSave();
            this.setupCrashHandler();
          }
          
          private initializeAutoSave(): void {
            setInterval(() => this.performAutoSave(), this.autoSaveInterval);
          }
          
          private async performAutoSave(): Promise<void> {
            try {
              const currentState = await this.serializeCurrentState();
              await this.saveToStorage(currentState);
              this.lastSavepoint = currentState;
            } catch (error) {
              console.error('Auto-save failed:', error);
              this.triggerEmergencyBackup();
            }
          }
          
          private setupCrashHandler(): void {
            window.addEventListener('unhandledrejection', this.handleCrash.bind(this));
            window.addEventListener('error', this.handleCrash.bind(this));
          }
        }