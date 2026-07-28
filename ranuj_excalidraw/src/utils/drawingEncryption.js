const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveKey(password, salt, iterations = 310000) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptDrawingPayload(payload, password) {
  if (!password || password.length < 6) throw new Error("Use a password with at least 6 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 310000;
  const key = await deriveKey(password, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(payload))
  );
  return {
    app: "SketchyDraw",
    version: 1,
    encrypted: true,
    algorithm: "AES-256-GCM",
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations },
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptDrawingPayload(container, password) {
  if (!container?.encrypted || !container?.ciphertext) throw new Error("This is not a protected SketchyDraw file.");
  try {
    const salt = base64ToBytes(container.salt);
    const iv = base64ToBytes(container.iv);
    const key = await deriveKey(password, salt, Number(container?.kdf?.iterations) || 310000);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBytes(container.ciphertext)
    );
    return JSON.parse(decoder.decode(plaintext));
  } catch (error) {
    throw new Error("Wrong password or damaged protected file.");
  }
}

export function downloadProtectedDrawing(container, fileName = "drawing.sketchylock") {
  const blob = new Blob([JSON.stringify(container, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
