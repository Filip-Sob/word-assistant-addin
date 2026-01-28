const STORAGE_KEY = "wa_client_id";

function generateUUID(): string {
  return crypto.randomUUID();
}

export function getOrCreateClientId(): string {
  let clientId = localStorage.getItem(STORAGE_KEY);

  if (!clientId) {
    clientId = generateUUID();
    localStorage.setItem(STORAGE_KEY, clientId);
  }

  return clientId;
}
