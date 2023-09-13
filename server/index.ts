import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { checkPaid, getInvoice } from "./lightning";
import { Database } from "bun:sqlite";
import { createPrEntry, getNoteEntry, getPREntry, markPaid, setupNoteTable, setupPRTable } from "../database/database";

// ------------------- LIGHTNING SETUP ----------------

const LUD16 = Bun.env.LUD16 as string;

// ------------------- DATABASE SETUP ------------------

const DB = new Database(Bun.env.DB_FILENAME, { create: true });
const NOTE_TABLE = Bun.env.DB_NOTE_TABLE as string;
const PR_TABLE = Bun.env.DB_PR_TABLE as string;

setupNoteTable(DB, NOTE_TABLE); // Setup the table immediately after its definition
setupPRTable(DB, PR_TABLE); // Setup the table immediately after its definition

// -------------------- SERVER SETUP --------------------

const APP = express();
const PORT = Number(Bun.env.PORT);
const DOMAIN = `${Bun.env.DOMAIN as string}:${PORT}`;

APP.use(cors())
APP.use(bodyParser.json())

APP.get("/:noteId", async (request, response) => {
  try {
    const noteId = request.params.noteId;
    const noteEntry = getNoteEntry(DB, NOTE_TABLE, noteId);

    const invoice = await getInvoice(
      LUD16,
      DOMAIN,
      noteEntry.price,
      noteId,
    )

    const prEntry = createPrEntry(DB, PR_TABLE, {
      noteId,
      ...invoice,
    })

    response.status(402).send(prEntry);
  } catch(e: any){
    console.log(`ERROR: ${e.toString()}`)
    response.status(e.status ?? 500).send({error: e.toString()});
  }
});

APP.get("/:noteId/:paymentHash", async (request, response) => {
  try {
    const noteId = request.params.noteId;
    const paymentHash = request.params.paymentHash;
    const noteEntry = getNoteEntry(DB, NOTE_TABLE, noteId);
    const prEntry = getPREntry(DB, PR_TABLE, paymentHash);

    if(noteEntry.noteId !== prEntry.noteId){
      throw new Error("The payment hash provided is not associated with the note ID")
    }

    if(prEntry.paymentStatus === "PAID"){
      response.status(200).send(noteEntry)
      return;
    }

    const verify = await checkPaid(prEntry.verify);

    if(!verify.settled){
      response.status(402).send(prEntry);
      return;
    }

    markPaid(DB, PR_TABLE, paymentHash)

    response.status(200).send(noteEntry);
  } catch(e: any){
    console.log(`ERROR: ${e.toString()}`);
    response.status(e.status ?? 500).send({error: e.toString()});
  }
});

APP.listen(PORT, () => {
  console.log("Welcome to NIP-108: Lightning Gated Notes")
  console.log(`Listening on port ${PORT}...`);
});