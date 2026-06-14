import { Storage } from '@google-cloud/storage';

const storage = new Storage();

export function getFiscalDocumentBucketName(): string {
  return process.env.STORAGE_BUCKET_NAME || 'mythoria-generated-stories';
}

export async function downloadFiscalDocumentPdf(storagePath: string): Promise<Buffer> {
  const [buffer] = await storage.bucket(getFiscalDocumentBucketName()).file(storagePath).download();
  return buffer;
}
