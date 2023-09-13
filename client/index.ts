import { PREntry } from "../database/database";
import { Invoice } from "../server/lightning";

const PORT = Number(Bun.env.PORT);
const SERVER = `${Bun.env.DOMAIN as string}:${PORT}`;
const LNBITS_API = Bun.env.LNBITS_API as string

const payInvoice = async (pr: string) => {
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

const invoiceResponse = await fetch(SERVER + '/note0');
const invoiceResponseData = await invoiceResponse.json() as PREntry; 

const invoice = await payInvoice(invoiceResponseData.pr);
const invoiceData = await invoice.json();
console.log(invoiceData)

const getResultsResponse = await fetch(invoiceResponseData.successAction.url);
const getResultsResponseData = await getResultsResponse.json();

console.log(JSON.stringify(getResultsResponseData, null, 2));