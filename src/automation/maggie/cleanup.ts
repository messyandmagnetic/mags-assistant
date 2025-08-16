import { deleteOldFiles } from './drive';

/**
 * Handle Drive cleanup and archiving.
 */
export async function cleanup(env: { RAW_FOLDER_ID: string; FINAL_FOLDER_ID: string }): Promise<void> {
  await deleteOldFiles(env.RAW_FOLDER_ID, 21);
  await deleteOldFiles(env.FINAL_FOLDER_ID, 14);
  // TODO: additional organization by date/topic
}
