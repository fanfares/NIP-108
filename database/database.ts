import { Database } from "bun:sqlite";
import { randomBytes } from "crypto";
import { Invoice } from "../server/lightning";

export interface NoteEntry {
    noteId: string;     // Corresponds to the TEXT type in SQLite
    price: number;      // Corresponds to the INTEGER type in SQLite
    secret: string;     // Corresponds to the TEXT type in SQLite
    timestamp: number;  // Corresponds to the INTEGER type in SQLite (representing Unix timestamp)
}

export function setupNoteTable(db: Database, table: string){
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${table} (
      noteId TEXT PRIMARY KEY,
      price INTEGER,
      secret TEXT,
      timestamp INTEGER
    );
  `;

  db.query(createTableQuery).run();
}

export interface PREntry extends Invoice {
    noteId: string;
    timestamp: number;
    paymentStatus: "UNPAID" | "PAID";
}

export function setupPRTable(db: Database, table: string) {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${table} (
      paymentHash TEXT PRIMARY KEY,
      noteId TEXT,
      pr TEXT,
      verify TEXT,
      status TEXT,
      paymentStatus TEXT,
      successAction TEXT,
      routes TEXT,
      timestamp INTEGER
    );
  `;

  db.query(createTableQuery).run();
}

// ------------------- NOTE ENTRIES ------------------------

export function createNoteEntry(db: Database, table: string, noteId: string, price: number) {
    const secret = randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now()); // Current Unix timestamp
  
    const insertQuery = db.query(`
      INSERT INTO ${table} (noteId, price, secret, timestamp)
      VALUES ($noteId, $price, $secret, $timestamp);
    `);
  
    insertQuery.run({ $noteId: noteId, $price: price, $secret: secret, $timestamp: timestamp });
  };

export function getNoteEntry(db: Database, table: string, noteId: string): NoteEntry {
    const selectQuery = db.query(`SELECT * FROM ${table} WHERE noteId = $noteId`);
    const result = selectQuery.get({ $noteId: noteId }) as NoteEntry | undefined;
  
    if (!result) {
        throw new Error(`No entry found for noteId: ${noteId}`);
    }

    return result;
}

export function changeNotePrice(db: Database, table: string, noteId: string, newPrice: number){
    const selectQuery = db.query(`SELECT * FROM ${table} WHERE noteId = $noteId`);
    const entry = selectQuery.get({ $noteId: noteId });
    
    if (!entry) {
        throw new Error(`No entry found with noteId: ${noteId}`);
    }
  
    const updateQuery = db.query(`UPDATE ${table} SET price = $price WHERE noteId = $noteId`);
    updateQuery.run({ $noteId: noteId, $price: newPrice });
  
}

// ------------------- PR ENTRIES ------------------------

export function createPrEntry(db: Database, table: string, entry: Omit<PREntry, 'timestamp' | 'paymentStatus'>) {
    const timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp
    const paymentStatus = "UNPAID";

    const insertQuery = db.query(`
      INSERT INTO ${table} (paymentHash, noteId, pr, verify, status, paymentStatus, successAction, routes, timestamp)
      VALUES ($paymentHash, $noteId, $pr, $verify, $status, $paymentStatus, $successAction, $routes, $timestamp);
    `);

    insertQuery.run({
        $paymentHash: entry.paymentHash,
        $noteId: entry.noteId,
        $pr: entry.pr,
        $verify: entry.verify,
        $status: entry.status,
        $paymentStatus: paymentStatus,
        $successAction: JSON.stringify(entry.successAction), // Assuming this is an object and storing it as a string
        $routes: JSON.stringify(entry.routes),  // Assuming you want to store the routes array as a string
        $timestamp: timestamp
    });

    return getPREntry(db, table, entry.paymentHash)
}

export function getPREntry(db: Database, table: string, paymentHash: string): PREntry {
    const selectQuery = db.query(`SELECT * FROM ${table} WHERE paymentHash = $paymentHash`);
    const rawResult = selectQuery.get({ $paymentHash: paymentHash }) as PREntry;

    if (!rawResult) {
        throw new Error(`No entry found with paymentHash: ${paymentHash}`);
    }

    // Deserialize properties that were stringified
    const result: PREntry = {
        ...rawResult,
        successAction: JSON.parse((rawResult as any).successAction),
        routes: JSON.parse((rawResult as any).routes)
    };

    return result;
}

export function markPaid(db: Database, table: string, paymentHash: string): void {

    const prEntry = getPREntry(db, table, paymentHash);

    const updateQuery = db.query(`
        UPDATE ${table}
        SET paymentStatus = $newStatus
        WHERE paymentHash = $paymentHash;
    `);

    updateQuery.run({
        $paymentHash: prEntry.paymentHash,
        $newStatus: "PAID"
    });
}