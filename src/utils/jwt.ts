// JWT Native Utility using Web Crypto API (fully compatible with Node and Next.js Edge Runtime)

function bufferToBase64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binString = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binString += String.fromCharCode(bytes[i]);
  }
  return btoa(binString)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlToBuffer(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

function utf8ToBase64url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return bufferToBase64url(bytes);
}

function base64urlToUtf8(str: string): string {
  const bytes = base64urlToBuffer(str);
  return new TextDecoder().decode(bytes);
}

function stringToBuffer(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Sign JWT using HS256 (Web Crypto API)
export async function signJWT(payload: any, secret: string, expiresInSeconds: number): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = utf8ToBase64url(JSON.stringify(header));
  const encodedPayload = utf8ToBase64url(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    stringToBuffer(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    stringToBuffer(dataToSign)
  );

  const encodedSignature = bufferToBase64url(signatureBuffer);
  return `${dataToSign}.${encodedSignature}`;
}

// Verify JWT using HS256 (Web Crypto API)
export async function verifyJWT(token: string, secret: string): Promise<any | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      stringToBuffer(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = base64urlToBuffer(encodedSignature);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      stringToBuffer(dataToSign)
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64urlToUtf8(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    return null;
  }
}
