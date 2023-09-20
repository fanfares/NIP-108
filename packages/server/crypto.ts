import crypto from 'crypto-browserify';

const algorithm: string = 'aes-256-cbc';

export interface EncryptedOutput {
    iv: string;
    content: string;
}

export function hashToKey(inputString: string): Buffer {
    return crypto.createHash('sha256').update(inputString).digest();
}

export function encrypt(text: string, key: Buffer): EncryptedOutput {
    const iv: Buffer = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted: Buffer = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
}

export function decrypt(iv: string, content: string, key: Buffer): string {
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
    const decrypted: Buffer = Buffer.concat([decipher.update(Buffer.from(content, 'hex')), decipher.final()]);

    return decrypted.toString('utf8');
}

// import crypto from 'crypto'
// import * as secp from '@noble/secp256k1'

// let sharedPoint = secp.getSharedSecret(ourPrivateKey, '02' + theirPublicKey)
// let sharedX = sharedPoint.slice(1, 33)

// let iv = crypto.randomFillSync(new Uint8Array(16))
// var cipher = crypto.createCipheriv(
//   'aes-256-cbc',
//   Buffer.from(sharedX),
//   iv
// )
// let encryptedMessage = cipher.update(text, 'utf8', 'base64')
// encryptedMessage += cipher.final('base64')
// let ivBase64 = Buffer.from(iv.buffer).toString('base64')

// let event = {
//   pubkey: ourPubKey,
//   created_at: Math.floor(Date.now() / 1000),
//   kind: 4,
//   tags: [['p', theirPublicKey]],
//   content: encryptedMessage + '?iv=' + ivBase64
// }
