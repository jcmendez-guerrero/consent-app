import { BlobServiceClient } from '@azure/storage-blob';
import { ManagedIdentityCredential } from '@azure/identity';

let _client = null;

export function getBlobServiceClient() {
  if (_client) return _client;
  const accountName = 'azusaappconsentnp01';
  const clientId = process.env.MANAGED_IDENTITY_CLIENT_ID;
  const credential = new ManagedIdentityCredential({ clientId });
  _client = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential,
  );
  return _client;
}
