import { generatePrivateKey } from 'nostr-tools';

function main() {
    const command = process.argv[2];
    switch(command) {
        case 'sk':
        case 'newsk':
            console.log(generatePrivateKey())
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