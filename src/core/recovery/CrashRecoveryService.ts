
        export class CrashRecoveryService {
          private static readonly BACKUP_KEY = 'emergency_backup';
          private static readonly MAX_BACKUPS = 5;
          
          public async saveEmergencyBackup(data: any): Promise<void> {
            try {
              const timestamp = new Date().getTime();
              const backup = {
                timestamp,
                data,
                version: process.env.APP_VERSION
              };
              
              await localStorage.setItem(
                `${CrashRecoveryService.BACKUP_KEY}_${timestamp}`,
                JSON.stringify(backup)
              );
              
              await this.cleanupOldBackups();
            } catch (error) {
              console.error('Emergency backup failed:', error);
            }
          }
          
          public async recoverLatestBackup(): Promise<any> {
            const backups = await this.getAllBackups();
            return backups.length > 0 ? backups[0].data : null;
          }
          
          private async cleanupOldBackups(): Promise<void> {
            const backups = await this.getAllBackups();
            if (backups.length > CrashRecoveryService.MAX_BACKUPS) {
              // Remove oldest backups
              backups
                .slice(CrashRecoveryService.MAX_BACKUPS)
                .forEach(backup => localStorage.removeItem(
                  `${CrashRecoveryService.BACKUP_KEY}_${backup.timestamp}`
                ));
            }
          }
        }