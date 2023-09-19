import { Database } from "bun:sqlite";
import { NoteEntry, PREntry, changeNotePrice, createNoteEntry, getNoteEntry, getPREntry, setupNoteTable, setupPRTable } from "database";

// ------------------------ DATABASE SETUP -------------------------------

const DB = new Database(Bun.env.DB_FILENAME, { create: true });
const NOTE_TABLE = Bun.env.DB_NOTE_TABLE as string;
const PR_TABLE = Bun.env.DB_PR_TABLE as string;

setupNoteTable(DB, NOTE_TABLE); // Setup the table immediately after its definition
setupPRTable(DB, PR_TABLE); // Setup the table immediately after its definition

// ------------------------ ADD ENTRY -------------------------------------

const addEntry = (noteId: string, lud16: string, secret: string, price: number, ) => {
  createNoteEntry(DB, NOTE_TABLE, noteId, lud16, secret, price);

  console.log(`Created new Note with noteId ${noteId} to ${price}`);
};

// ------------------------ CHANGE PRICE --------------------------------------

const changePrice = (noteId: string, newPrice: number) => {
  changeNotePrice(DB, NOTE_TABLE, noteId, newPrice);
  console.log(`Updated price for noteId ${noteId} to ${newPrice}`);
};

// ------------------------ GET NOTE --------------------------------------

const getEntry = (noteId: string) => {
  const result = getNoteEntry(DB, NOTE_TABLE, noteId);

  console.log('Entry Details:');
  console.log(`Note ID: ${result.noteId}`);
  console.log(`Price: ${result.price}`);
  console.log(`Secret: ${result.secret}`);
  console.log(`Timestamp: ${new Date(result.timestamp).toLocaleString()}`);
};

// ------------------------ GET ALL NOTES -------------------------------

const getAllEntries = () => {
  const selectAllQuery = DB.query(`SELECT * FROM ${NOTE_TABLE} ORDER BY timestamp DESC`); // Added the ORDER BY clause
  const results = selectAllQuery.all() as NoteEntry[];

  if (results.length === 0) {
    console.log("No entries found in the database.");
    return;
  }

  console.log('All Entries:');
  results.forEach(entry => {
    console.log('--------------------------');
    console.log(`Note ID: ${entry.noteId}`);
    console.log(`Price: ${entry.price}`);
    console.log(`Secret: ${entry.secret}`);
    console.log(`Timestamp: ${new Date(entry.timestamp).toISOString()}`);
  });
};

// ------------------------ GET PRs ---------------------------------------
const getPR = (paymentHash: string) => {
  const result = getPREntry(DB, PR_TABLE, paymentHash);

  console.log('PR Entry Details:');
  console.log(`Payment Hash: ${result.paymentHash}`);
  console.log(`PR: ${result.pr}`);
  console.log(`Verify: ${result.verify}`);
  console.log(`Status: ${result.status}`);
  console.log(`Timestamp: ${new Date(result.timestamp).toISOString()}`);
}

// ------------------------ GET ALL PRs ---------------------------------------
const getAllPREntries = () => {
  const selectAllQuery = DB.query(`SELECT * FROM ${PR_TABLE} ORDER BY timestamp DESC`);
  const results = selectAllQuery.all() as PREntry[];

  if (results.length === 0) {
      console.log(`No PR entries found in the table ${PR_TABLE}.`);
      return;
  }

  console.log(`All PR Entries in table ${PR_TABLE}:`);
  results.forEach(entry => {
      console.log('--------------------------');
      console.log(`Payment Hash: ${entry.paymentHash}`);
      console.log(`PR: ${entry.pr}`);
      console.log(`Verify: ${entry.verify}`);
      console.log(`Status: ${entry.status}`);
      console.log(`Timestamp: ${new Date(entry.timestamp).toISOString()}`);
  });
}


const deleteEntryById = (noteId: string) => {
  // First, try fetching the entry to check if it exists
  const selectQuery = DB.query(`SELECT * FROM ${NOTE_TABLE} WHERE noteId = $noteId`);
  const entry = selectQuery.get({ $noteId: noteId });
  
  if (!entry) {
      console.log(`No entry found with noteId: ${noteId}`);
      return;
  }

  // If the note exists, delete associated PRs with that noteId
  const deletePRsQuery = DB.query(`DELETE FROM ${PR_TABLE} WHERE noteId = $noteId`);
  deletePRsQuery.run({ $noteId: noteId });
  console.log(`Deleted PR entries associated with noteId: ${noteId}`);

  // Then, delete the note entry
  const deleteQuery = DB.query(`DELETE FROM ${NOTE_TABLE} WHERE noteId = $noteId`);
  deleteQuery.run({ $noteId: noteId });

  console.log(`Deleted entry with noteId: ${noteId}`);
};

// ------------------------ DELETE ALL NOTES ------------------------------

const deleteAllEntries = () => {
  const dropNoteTableQuery = `DROP TABLE IF EXISTS ${NOTE_TABLE}`;
  DB.query(dropNoteTableQuery).run();
  console.log(`Deleted all entries from table ${NOTE_TABLE}`);

  const dropPRTableQuery = `DROP TABLE IF EXISTS ${PR_TABLE}`;
  DB.query(dropPRTableQuery).run();
  console.log(`Deleted all PR entries from table ${PR_TABLE}`);
};

// ------------------------ CLI INTERFACE ---------------------------------

const args = process.argv.slice(2); // Slice off node path and script name

switch (args[0]?.toLowerCase()) {
  case 'create'.toLowerCase():
    if (args.length !== 5) {
      console.error('Usage: create <noteId> <lud16> <secret> <price>');
      process.exit(1);
    }
    const noteId = args[1];
    const lud16 = args[2];
    const secret = args[3];
    const price = parseInt(args[4], 10);
    if (isNaN(price)) {
      console.error('Price must be a valid number.');
      process.exit(1);
    }
    addEntry(noteId, lud16, secret, price);
    console.log(`Added entry with noteId ${noteId} and price ${price}`);
    break;
  case 'changePrice'.toLowerCase():
    if (args.length !== 3) {
        console.error('Usage: changePrice <noteId> <newPrice>');
        process.exit(1);
    }
    const noteIdForUpdate = args[1];
    const updatedPrice = parseInt(args[2], 10);
    if (isNaN(updatedPrice)) {
        console.error('Price must be a valid number.');
        process.exit(1);
    }
    changePrice(noteIdForUpdate, updatedPrice);
    break;
  case 'get'.toLowerCase():
    if (args.length !== 2) {
      console.error('Usage: get <noteId>');
      process.exit(1);
    }
    const retrieveNoteId = args[1];
    getEntry(retrieveNoteId);
    break;
  case 'getAll'.toLowerCase():
    getAllEntries();
    break;
  case 'getPR'.toLowerCase():
    if (args.length !== 2) {
      console.error('Usage: getPR <pr>');
      process.exit(1);
    }
    const pr = args[1];
    getPR(pr);
    break;
  case 'getAllPR'.toLowerCase():
    getAllPREntries();
    break;
  case 'delete'.toLowerCase():
    if (args.length !== 2) {
      console.error('Usage: delete <noteId>');
      process.exit(1);
    }
    const deleteNoteId = args[1];
    deleteEntryById(deleteNoteId);
    break;

  case 'deleteAll'.toLowerCase():
    deleteAllEntries();
    console.log("Deleted all entries");
    break;

  default:
    console.error(`Invalid command: ${args[0]}`);
    console.log('\nAvailable commands and their usage:\n');
    console.log('  create <noteId> <lud16> <secret> <price>   - Add a new entry with given noteId and price.');
    console.log('  get <noteId>                               - Retrieve the details for the given noteId.');
    console.log('  getAll                                     - Fetch all entries from the database.');
    console.log('  getpr <pr>                                 - Retrieve the pr for the given noteId.');
    console.log('  getAllPr                                   - Fetch all pr entries from the database.');
    console.log('  delete <noteId>                            - Delete an entry with the given noteId.');
    console.log('  deleteAll                                  - Delete all entries from the database.');
    console.log('  changePrice <noteId> <price>               - Update the price for the given noteId.');
    console.log('\nExample:\n');
    console.log('  bun database create "example-note" 5000\n');
}
