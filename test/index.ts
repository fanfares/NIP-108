import { VerifiedEvent, finishEvent, generatePrivateKey, getPublicKey } from "nostr-tools";
import { PREntry } from "../database/database";
import { CreateNotePostBody, createGatedNote, createKeyNote, eventToGatedNote, unlockGatedNoteFromKeyNote } from "../server/nostr";

const PORT = Number(Bun.env.PORT);
const SERVER = `${Bun.env.DOMAIN as string}:${PORT}`;
const LNBITS_API = Bun.env.LNBITS_API as string
const LUD16 = Bun.env.LUD16 as string

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

    console.log("Secret: ", secret)
  
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

    console.log("Result: ");
    console.log(unlockedNote.content);
}

runTests();
