import * as FileSystem from 'expo-file-system';
import { episodeService, Episode } from './episode.service';
import { storageService } from './storage.service';

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;

class DownloadService {
    private activeDownload: FileSystem.DownloadResumable | null = null;
    private activeEpisodeId: string | null = null;
    private progressListener: ((progress: number) => void) | null = null;
    private completeListeners: ((success: boolean) => void)[] = [];

    /**
     * Ensure downloads directory exists
     */
    private async ensureDir(): Promise<void> {
        const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
        if (!info.exists) {
            await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
        }
    }

    /**
     * Get local file path for an episode
     */
    private getLocalPath(episodeId: string, format: string): string {
        return `${DOWNLOADS_DIR}${episodeId}.${format}`;
    }

    /**
     * Check if an episode is downloaded locally
     */
    async isDownloaded(episodeId: string, format: string = 'mp3'): Promise<boolean> {
        const path = this.getLocalPath(episodeId, format);
        const info = await FileSystem.getInfoAsync(path);
        return info.exists;
    }

    /**
     * Check if a download is currently in progress for an episode
     */
    isActivelyDownloading(episodeId: string): boolean {
        return this.activeEpisodeId === episodeId && this.activeDownload !== null;
    }

    /**
     * Set/replace the progress listener for the active download.
     * Used when re-entering a screen with an active download.
     */
    setProgressListener(listener: ((progress: number) => void) | null): void {
        this.progressListener = listener;
    }

    /**
     * Register a callback for when the active download completes.
     * Returns an unsubscribe function.
     */
    onComplete(callback: (success: boolean) => void): () => void {
        this.completeListeners.push(callback);
        return () => {
            const idx = this.completeListeners.indexOf(callback);
            if (idx >= 0) this.completeListeners.splice(idx, 1);
        };
    }

    /**
     * Download an episode to local storage.
     * Returns the local file URI.
     */
    async downloadEpisode(
        episode: Episode,
        onProgress?: (progress: number) => void,
    ): Promise<string> {
        const token = await storageService.getAccessToken();
        if (!token) {
            throw new Error('Please log in to download episodes.');
        }

        // Get signed download URL from API
        const { downloadUrl, format } = await episodeService.getDownloadUrl(episode.id, token);

        if (!downloadUrl) {
            throw new Error('Download not available. Try again later.');
        }

        await this.ensureDir();

        const resolvedFormat = format || episode.audioFormat || 'mp3';
        const localPath = this.getLocalPath(episode.id, resolvedFormat);

        if (onProgress) {
            this.progressListener = onProgress;
        }

        // Download with progress tracking
        const downloadResumable = FileSystem.createDownloadResumable(
            downloadUrl,
            localPath,
            {},
            (downloadProgress) => {
                if (this.progressListener) {
                    if (downloadProgress.totalBytesExpectedToWrite > 0) {
                        const pct = Math.round(
                            (downloadProgress.totalBytesWritten /
                                downloadProgress.totalBytesExpectedToWrite) *
                                100,
                        );
                        this.progressListener(pct);
                    } else if (downloadProgress.totalBytesWritten > 0) {
                        // No total size available - signal indeterminate progress
                        this.progressListener(-1);
                    }
                }
            },
        );

        this.activeDownload = downloadResumable;
        this.activeEpisodeId = episode.id;

        try {
            const result = await downloadResumable.downloadAsync();
            if (!result || result.status !== 200) {
                this.notifyComplete(false);
                throw new Error('Download failed. Please try again.');
            }
            this.notifyComplete(true);
            return result.uri;
        } catch (error) {
            this.notifyComplete(false);
            throw error;
        } finally {
            this.activeDownload = null;
            this.activeEpisodeId = null;
            this.progressListener = null;
            this.completeListeners = [];
        }
    }

    private notifyComplete(success: boolean): void {
        // Copy array since it gets cleared in finally
        const listeners = [...this.completeListeners];
        listeners.forEach(cb => cb(success));
    }

    /**
     * Cancel the current active download
     */
    async cancelDownload(): Promise<void> {
        if (this.activeDownload) {
            try {
                await this.activeDownload.pauseAsync();
            } catch {
                // Ignore pause errors
            }
            // Clean up the partial file
            if (this.activeEpisodeId) {
                const formats = ['mp3', 'wav', 'ogg'];
                for (const fmt of formats) {
                    const path = this.getLocalPath(this.activeEpisodeId, fmt);
                    const info = await FileSystem.getInfoAsync(path);
                    if (info.exists) {
                        await FileSystem.deleteAsync(path, { idempotent: true });
                    }
                }
            }
            this.notifyComplete(false);
            this.activeDownload = null;
            this.activeEpisodeId = null;
            this.progressListener = null;
            this.completeListeners = [];
        }
    }

    /**
     * Delete a downloaded episode
     */
    async deleteDownload(episodeId: string, format: string = 'mp3'): Promise<void> {
        const path = this.getLocalPath(episodeId, format);
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
            await FileSystem.deleteAsync(path);
        }
    }

    /**
     * Get total size of all downloads in bytes
     */
    async getTotalDownloadSize(): Promise<number> {
        const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
        if (!info.exists) return 0;

        const files = await FileSystem.readDirectoryAsync(DOWNLOADS_DIR);
        let total = 0;
        for (const file of files) {
            const fileInfo = await FileSystem.getInfoAsync(`${DOWNLOADS_DIR}${file}`);
            if (fileInfo.exists && fileInfo.size) {
                total += fileInfo.size;
            }
        }
        return total;
    }
}

export const downloadService = new DownloadService();
