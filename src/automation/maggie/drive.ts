import { google, drive_v3 } from 'googleapis';

export interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
}

/**
 * Fetch raw videos waiting in the drop folder.
 */
export async function fetchRawFiles(folderId: string): Promise<DriveFile[]> {
  // TODO: List files via Google Drive API
  // This is a placeholder to be filled with real Drive API calls.
  return [];
}

/**
 * Rename a file within Drive.
 */
export async function renameFile(fileId: string, newName: string): Promise<void> {
  // TODO: Call Drive API to rename file
}

/**
 * Delete files older than `days`.
 */
export async function deleteOldFiles(folderId: string, days: number): Promise<void> {
  // TODO: Query Drive for files and remove those older than `days`
}
