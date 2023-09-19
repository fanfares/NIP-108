import {
  getPublicKey,
  finishEvent,
  VerifiedEvent,
} from "nostr-tools";
import { decrypt, encrypt, hashToKey } from "./crypto";
import { getLud16Url, isValidLud16 } from "./lightning";

export interface CreateNotePostBody {
  kind42: VerifiedEvent<number>;
  lud16: string;
  secret: string;
  cost: number;
}

export interface GatedNote {
    note: VerifiedEvent<number>;
    iv: string,
    cost: number,
    endpoint: string
}

export interface KeyNote {
    note: VerifiedEvent<number>;
    iv: string,
    gate: string,
}

export interface AnnouncementNote {
  note: VerifiedEvent<number>;
  gate: string,
}

export function eventToGatedNote(event: VerifiedEvent<number>): GatedNote {
    // Extract tags
    const ivTag = event.tags.find(tag => tag[0] === "iv");
    const costTag = event.tags.find(tag => tag[0] === "cost");
    const endpointTag = event.tags.find(tag => tag[0] === "endpoint");

    // Construct GatedNote
    const gatedNote: GatedNote = {
        note: event,
        iv: ivTag ? ivTag[1] : "",   // Assuming an empty string as default value
        cost: costTag ? parseInt(costTag[1]) : 0,   // Assuming a default value of 0
        endpoint: endpointTag ? endpointTag[1] : ""   // Assuming an empty string as default value
    };

    return gatedNote;
}

export function eventToKeyNote(event: VerifiedEvent<number>): KeyNote {
    // Extract tags
    const ivTag = event.tags.find(tag => tag[0] === "iv");
    const gateTag = event.tags.find(tag => tag[0] === "g");

    // Construct GatedNote
    const keyNote: KeyNote = {
        note: event,
        iv: ivTag ? ivTag[1] : "",
        gate: gateTag ? gateTag[1] : ""
    };

    return keyNote;
}

export function eventToAnnouncementNote(event: VerifiedEvent<number>): AnnouncementNote {
  // Extract tags
  const gateTag = event.tags.find(tag => tag[0] === "g");

  // Construct GatedNote
  const announcementNote: AnnouncementNote = {
      note: event,
      gate: gateTag ? gateTag[1] : ""
  };

  return announcementNote;
}

export function createGatedNote(
  privateKey: string,
  secret: string,
  cost: number,
  endpoint: string,
  payload: VerifiedEvent<number>
): VerifiedEvent<number> {
  const noteToEncrypt = JSON.stringify(payload);
  const noteSecretKey = hashToKey(secret);
  const encryptedNote = encrypt(noteToEncrypt, noteSecretKey);

  const event = {
    kind: 42,
    pubkey: getPublicKey(privateKey),
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["iv", encryptedNote.iv],
      ["cost", cost.toString()],
      ["endpoint", endpoint],
    ],
    content: encryptedNote.content,
  };

  return finishEvent(event, privateKey);
}

export function createKeyNote(
  privateKey: string,
  secret: string,
  gatedNote: VerifiedEvent<number>
): VerifiedEvent<number> {
  const noteSecretKey = hashToKey(privateKey);
  const encryptedSecret = encrypt(secret, noteSecretKey);

  const event = {
    kind: 43,
    pubkey: getPublicKey(privateKey),
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["iv", encryptedSecret.iv],
      ["g", gatedNote.id],
    ],
    content: encryptedSecret.content,
  };

  return finishEvent(event, privateKey);
}

export function createAnnouncementNote(
  privateKey: string,
  content: string,
  gatedNote: VerifiedEvent<number>
): VerifiedEvent<number> {

  const event = {
    kind: 1,
    pubkey: getPublicKey(privateKey),
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["g", gatedNote.id],
    ],
    content: content,
  };

  return finishEvent(event, privateKey);
}

export function unlockGatedNote(
  gatedNote: VerifiedEvent<number>,
  secret: string
): VerifiedEvent<number> {
  // 1. Derive the encryption key from the secret
  const noteSecretKey = hashToKey(secret);

  // 2. Extract the iv and content from the gatedNote
  const ivTag = gatedNote.tags?.find((tag) => tag[0] === "iv");
  const content = gatedNote.content;

  if (!ivTag) {
    throw new Error("IV not found in the gatedNote tags");
  }

  const iv = ivTag[1];

  // 3. Decrypt the content using the derived key and iv
  const decryptedContent = decrypt(iv, content, noteSecretKey);

  // 4. Parse the decrypted content into a VerifiedEvent<number> object
  return JSON.parse(decryptedContent) as VerifiedEvent<number>;
}

export function unlockGatedNoteFromKeyNote(
  privateKey: string,
  keyNote: VerifiedEvent<number>,
  gatedNote: VerifiedEvent<number>
): VerifiedEvent<number> {
  // 1. Derive the encryption key from the private key
  const keyNoteSecretKey = hashToKey(privateKey);

  // Extract the iv and encrypted secret content from the keyNote
  const ivTag = keyNote.tags?.find((tag) => tag[0] === "iv");
  const encryptedSecretContent = keyNote.content;

  if (!ivTag) {
    throw new Error("IV not found in the keyNote tags");
  }

  const iv = ivTag[1];

  // Decrypt the secret using the derived key and iv from the keyNote
  const decryptedSecret = decrypt(iv, encryptedSecretContent, keyNoteSecretKey);

  // 2. Use the decrypted secret to decrypt the gatedNote
  return unlockGatedNote(gatedNote, decryptedSecret);
}

export async function verifyCreateNote(post: CreateNotePostBody, serverEndpoint: string) {
    const { kind42, lud16, secret, cost } = post;
  
    // Check Secret
    if (!secret) throw new Error("Secret needs to exist");
  
    // Check Cost
    if (cost <= 0) throw new Error("Cost needs to be at least 1 mSat");
  
    // Check lud16
    if (!isValidLud16(lud16)) throw new Error(`${lud16} is not a valid lud16`);
  
    const testLud16Url = getLud16Url(lud16);
    const testLud16Response = await fetch(testLud16Url);
    if (testLud16Response.status !== 200)
      throw new Error(
        `${lud16} does not return a valid response ${testLud16Response.toString()}`
      );
  
    // Verify kind42 structure
    const kind = kind42.kind;
    const pubkey = kind42.pubkey;
    const createdAt = kind42.created_at;
    const content = kind42.content;
    const id = kind42.id;
    const tags = kind42.tags;
  
    if (!kind) throw new Error(`Invalid kind42.kind value ${kind42}`);
    if (!pubkey) throw new Error(`Missing kind42.pubkey ${kind42}`);
    if (!createdAt) throw new Error(`Missing kind42.created_at ${kind42}`);
    if (!content) throw new Error(`Missing kind42.content ${kind42}`);
    if (!id) throw new Error(`Missing kind42.id ${kind42}`);
    if (!tags || tags.length === 0) throw new Error(`Missing kind42.tags ${kind42}`);
  
    // Check for specific tags
    const ivTag = kind42.tags.find((tag) => tag[0] === "iv");
    const costTag = kind42.tags.find((tag) => tag[0] === "cost");
    const endpointTag = kind42.tags.find((tag) => tag[0] === "endpoint");
  
    if (!ivTag) throw new Error(`Missing 'iv' tag in  ${kind42}`);
    if (!costTag) throw new Error(`Missing 'cost' tag in  ${kind42}`);
    if (!endpointTag) throw new Error(`Missing 'endpoint' tag in  ${kind42}`);
  
    if(endpointTag[1] !== serverEndpoint) throw new Error(`Expected endpoint: ${serverEndpoint} Got ${endpointTag[1]}`);
  
    const ungatedNote = unlockGatedNote(kind42, secret);
  
    if(!ungatedNote.id) throw new Error(`Secret ${secret} did not decrypt the note ${ungatedNote.toString()}`);
  
  }
