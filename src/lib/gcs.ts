import { Storage } from '@google-cloud/storage';

let _storage: Storage | null = null;

/**
 * Get a singleton Google Cloud Storage client.
 * Reads credentials from GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY env vars.
 */
export function getGcsStorage(): Storage {
  if (_storage) return _storage;

  const projectId = process.env.GCS_PROJECT_ID;
  const clientEmail = process.env.GCS_CLIENT_EMAIL;
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('GCS credentials not configured (GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY)');
  }

  _storage = new Storage({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });

  return _storage;
}

export function getGcsBucket() {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) throw new Error('GCS_BUCKET_NAME not configured');
  return getGcsStorage().bucket(bucketName);
}
