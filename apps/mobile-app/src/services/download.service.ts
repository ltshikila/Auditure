import * as FileSystem from 'expo-file-system';
import { episodeService, Episode } from './episode.service';
import { storageService } from './storage.service';

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;

class DownloadService {
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

        const localPath = this.getLocalPath(episode.id, format);

        // Download with progress tracking
        const downloadResumable = FileSystem.createDownloadResumable(
            downloadUrl,
            localPath,
            {},
            (downloadProgress) => {
                if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
                    const pct = Math.round(
                        (downloadProgress.totalBytesWritten /
                            downloadProgress.totalBytesExpectedToWrite) *
                            100,
                    );
                    onProgress(pct);
                }
            },
        );

        const result = await downloadResumable.downloadAsync();
        if (!result || result.status !== 200) {
            throw new Error('Download failed. Please try again.');
        }

        return result.uri;
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
