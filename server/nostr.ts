import { generatePrivateKey, getPublicKey, finishEvent, VerifiedEvent } from 'nostr-tools';
import fs from "fs";
import { decrypt, encrypt, hashToKey } from './crypto';


export function createGatedNote(
    privateKey: string,
    secret: string,
    cost: number,
    endpoint: string,
    payload: VerifiedEvent<number>,
){

    const noteToEncrypt = JSON.stringify(payload);
    const noteSecretKey = hashToKey(secret);
    const encryptedNote = encrypt(noteToEncrypt, noteSecretKey)

    const event = {
        kind: 42,
        pubkey: getPublicKey(privateKey),
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['iv', encryptedNote.iv],
            ['cost', cost.toString()],
            ['endpoint', endpoint]
        ],
        content: encryptedNote.content,
    }

    return finishEvent(event, privateKey)
}

export function createKeyNote(
    privateKey: string,
    secret: string,
    gatedNote: VerifiedEvent<number>,
){

    const noteSecretKey = hashToKey(privateKey);
    const encryptedSecret = encrypt(secret, noteSecretKey)

    const event = {
        kind: 43,
        pubkey: getPublicKey(privateKey),
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['iv', encryptedSecret.iv],
            ['gate', gatedNote.id]
        ],
        content: encryptedSecret.content,
    }

    return finishEvent(event, privateKey)
}

export function unlockGatedNote(
    gatedNote: VerifiedEvent<number>,
    secret: string
): VerifiedEvent<number> {
    
    // 1. Derive the encryption key from the secret
    const noteSecretKey = hashToKey(secret);

    // 2. Extract the iv and content from the gatedNote
    const ivTag = gatedNote.tags?.find(tag => tag[0] === 'iv');
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
    gatedNote: VerifiedEvent<number>,
): VerifiedEvent<number> {

    // 1. Derive the encryption key from the private key
    const keyNoteSecretKey = hashToKey(privateKey);

    // Extract the iv and encrypted secret content from the keyNote
    const ivTag = keyNote.tags?.find(tag => tag[0] === 'iv');
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


// --------------- TESTING -------------------------
function createTestNote(content?: string){

    const privateKey = generatePrivateKey();

    const event = {
        kind: 1,
        pubkey: getPublicKey(privateKey),
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: content ?? "Hello world.",
    }

    return finishEvent(event, privateKey)
}

function testGatedNote(){
    const secret = "Tomatoes";
    const cost = 5000;
    const endpoint = "";
    const privateKey = generatePrivateKey();
    const testNote = createTestNote();
    
    const gatedNote = createGatedNote(privateKey, secret, cost, endpoint, testNote)

    const ungatedNote = unlockGatedNote(gatedNote, secret)

    const keyNote = createKeyNote(privateKey, secret, gatedNote)

    const ungatedFromKeyNote = unlockGatedNoteFromKeyNote(privateKey, keyNote, gatedNote)

    console.log(gatedNote.content)

    console.log(ungatedNote.content)

    console.log(keyNote.content)

    console.log(ungatedFromKeyNote.content)
}

testGatedNote();
