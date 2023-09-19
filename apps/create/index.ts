import { VerifiedEvent, finishEvent, generatePrivateKey, getPublicKey, relayInit } from "nostr-tools";
import { CreateNotePostBody, createAnnouncementNote, createGatedNote, createKeyNote, eventToGatedNote, unlockGatedNoteFromKeyNote } from "server/nostr";
import { PREntry } from "database";

const SERVER_PORT = Number(Bun.env.SERVER_PORT);
const SERVER = `${Bun.env.DOMAIN as string}:${SERVER_PORT}`;
const LNBITS_API = Bun.env.LNBITS_API as string
const LUD16 = Bun.env.LUD16 as string
const RELAY = Bun.env.NOSTR_RELAY as string

// ------------- HELPERS ------------------

function createTestNote(privateKey?: string, content?: string) {
    const sk = privateKey ?? generatePrivateKey();
  
    const event = {
      kind: 1,
      pubkey: getPublicKey(sk),
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: content ?? "Hello world.",
    };
  
    return finishEvent(event, sk);
  }

  async function payInvoice (pr: string) {
    return fetch("https://legend.lnbits.com/api/v1/payments", {
        method: 'POST',
        headers: {
            'X-Api-Key': LNBITS_API,
            'Content-type': 'application/json'
        },
        body: JSON.stringify({
            out: true,
            bolt11: pr,
        })
    });
}

// ------------- TESTS ------------------

async function testCreateGatedNote(sk?: string){
    const cost = 5000;
    const lud16 = LUD16;
    const endpoint = SERVER;
    const secret = generatePrivateKey();
    const privateKey = sk ?? generatePrivateKey();
    const testNote = createTestNote(privateKey);
  
    const gatedNote = createGatedNote(
      privateKey,
      secret,
      cost,
      endpoint,
      testNote
    );

    const postBody: CreateNotePostBody = {
        kind42: gatedNote,
        lud16: lud16,
        secret: secret,
        cost: cost
    }

    const response = await fetch(endpoint + '/create', {
        method: 'POST',
        headers: {
            'Content-type': 'application/json'
        },
        body: JSON.stringify(postBody)
    })

    return gatedNote;
}


async function testUnlockingGatedNote(gatedNote: VerifiedEvent<number>){
    const gatedNoteData = eventToGatedNote(gatedNote);

    const invoiceResponse = await fetch(gatedNoteData.endpoint + '/' + gatedNoteData.note.id);
    const invoiceResponseData = await invoiceResponse.json() as PREntry; 

    const invoice = await payInvoice(invoiceResponseData.pr);
    const invoiceData = await invoice.json();

    const getResultsResponse = await fetch(invoiceResponseData.successAction.url);
    const getResultsResponseData = await getResultsResponse.json();

    return getResultsResponseData.secret;
}

async function postNotes(gatedNote: VerifiedEvent<number>, keyNote: VerifiedEvent<number>, announcementNote: VerifiedEvent<number>,){
    const relay = relayInit(RELAY);

    await relay.connect();

    await relay.publish(gatedNote)
    await relay.publish(keyNote)
    await relay.publish(announcementNote)

    await relay.close();
}

async function runTests(){
    const nostrSK = generatePrivateKey()

    console.log("Creating gated note...")
    const gatedNote = await testCreateGatedNote(nostrSK);

    console.log("Paying for gated note...")
    const secret = await testUnlockingGatedNote(gatedNote);

    console.log("Creating key note...");
    const keyNote = createKeyNote(nostrSK, secret, gatedNote);

    console.log("Unlocking from key note...");
    const unlockedNote = unlockGatedNoteFromKeyNote(nostrSK, keyNote, gatedNote)

    console.log("Creating announcement note...");
    const announcementNote = createAnnouncementNote(nostrSK, "Pay for my note!", gatedNote)

    console.log("Posting Notes...");
    await postNotes(gatedNote, keyNote, announcementNote);

    console.log("Result: " + unlockedNote.content);
}

runTests();
