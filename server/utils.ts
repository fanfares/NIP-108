import { generatePrivateKey } from 'nostr-tools';

function generateNostrSK() {
    console.log(generatePrivateKey());
}

function main() {
    const command = process.argv[2];
    switch(command) {
        case 'sk':
        case 'newsk':
            generateNostrSK();
            break;
        default:
            const usage = "Usage: bun utils <command>\n"
                        + "\nCommands:"
                        + "\n  newsk   Generate a Nostr private key.";
        
            console.log(usage);
            break;
            
    }
}

main();