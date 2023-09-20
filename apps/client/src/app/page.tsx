"use client";

import {
  Relay,
  relayInit,
  Event as NostrEvent,
  VerifiedEvent,
  getPublicKey
} from "nostr-tools";
import { useEffect, useState } from "react";
import { WebLNProvider, requestProvider } from "webln";
import {
  AnnouncementNote,
  GatedNote,
  KeyNote,
  eventToAnnouncementNote,
  eventToGatedNote,
  eventToKeyNote,
  unlockGatedNote,
} from "server";
import { PREntry } from "database";

export default function Home() {

  // ------------------- STATES -------------------------

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [relay, setRelay] = useState<Relay | null>(null);
  const [nostr, setNostr] = useState<any | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [webln, setWebln] = useState<null | WebLNProvider>(null);
  const [events, setEvents] = useState<AnnouncementNote[]>([]);
  const [gatedNotes, setGatedNotes] = useState<GatedNote[]>([]);
  const [keyNotes, setKeyNotes] = useState<KeyNote[]>([]);

  // ------------------- EFFECTS -------------------------

  useEffect(() => {
    requestProvider()
      .then(setWebln)
      .catch((e) => {
        alert("Please download Alby or ZBD to use this app.")
      });
  }, []);

  useEffect(() => {
    if ((window as any).nostr) {
      setNostr((window as any).nostr);
      (window as any).nostr.getPublicKey().then(setPublicKey);
    } else {
      alert("Nostr not found");
    }

  }, []);

  useEffect(() => {
    const newRelay = relayInit(process.env.NEXT_PUBLIC_NOSTR_RELAY as string);
    newRelay.on("connect", () => {
      setRelay(newRelay);
    });
    newRelay.connect();

    return () => {
      newRelay.close();
    };
  }, []);

  useEffect(() => {
    if (relay) {
      const gatedSub = relay.sub([
        {
          kinds: [1],
          limit: 3,
        },
      ]);

      gatedSub.on("event", (note) => {
        if (note.tags.find((tag) => tag[0] === "g")) {
          const announcement = eventToAnnouncementNote(note as VerifiedEvent);

          relay
            .get({
              ids: [announcement.gate],
            })
            .then((gatedNote) => {
              if (gatedNote)
                setGatedNotes([
                  ...gatedNotes,
                  eventToGatedNote(gatedNote as VerifiedEvent),
                ]);
            });

          setEvents([...events, announcement]);
        }
      });

      return () => {
        gatedSub.unsub();
      };
    }
  }, [relay]);

  useEffect(() => {
    if (relay && nostr && publicKey) {
      const keySub = relay.sub([
        {
          kinds: [43],
          authors: [publicKey],
        },
      ]);

      keySub.on("event", (keyNote) => {

        const keyNoteVerified = eventToKeyNote(keyNote as VerifiedEvent);
        const gatedNote = gatedNotes.find((gatedNote) => gatedNote.note.id === keyNoteVerified.gate);

        if(!gatedNote) return;

        nostr.nip04.decrypt(gatedNote.note.pubkey, keyNote.content).then((unlockedSecret: string) => {

          console.log(unlockedSecret);

          const keyNoteUnlocked = {
            ...keyNoteVerified,
            unlockedSecret,
          } as KeyNote;
          setKeyNotes([...keyNotes, keyNoteUnlocked]);
        })

      });

      return () => {
        keySub.unsub();
      };
    }
  }, [relay, nostr, publicKey]);

  // ------------------- FUNCTIONS -------------------------


  const handleBuy = async (gatedNote: GatedNote) => {

    if(isLoading) return;

    setIsLoading(true);

    try {

      if(!webln) throw new Error('No webln provider');
      if(!nostr) throw new Error('No nostr provider');
      if(!publicKey) throw new Error('No Public Key');
      if(!relay) throw new Error('No relay');

      const uri = `${gatedNote.endpoint}/${gatedNote.note.id}`;
      const invoiceResponse = await fetch(uri);
      const invoiceResponseJson = await invoiceResponse.json() as PREntry;

      await webln.sendPayment(invoiceResponseJson.pr);

      const resultResponse = await fetch(invoiceResponseJson.successAction.url);
      const resultResponseJson = await resultResponse.json();
      console.log(resultResponseJson)
      
      const content = await nostr.nip04.encrypt(gatedNote.note.pubkey, resultResponseJson.secret);

      const keyEvent = {
        kind: 43,
        pubkey: publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["g", gatedNote.note.id],
        ],
        content: content,
      };

      const keyEventVerified = await nostr.signEvent(keyEvent);

      await relay.publish(keyEventVerified);

      setKeyNotes([...keyNotes, eventToKeyNote(keyEventVerified as VerifiedEvent)]);

    } catch(e){
      alert(e)
    }

    setIsLoading(false);
  };

  const formatGatedContent = (content: string) => {
    return content.substring(0, 500) + "...";
  };

  // ------------------- RENDERERS -------------------------

  const renderUnlockedContent = (gatedNote: GatedNote, keyNote: KeyNote) => {

    const unlockedNote = unlockGatedNote(gatedNote.note, keyNote.unlockedSecret);

    return (
      <div className="mt-5">
        <p>{unlockedNote.content}</p>
      </div>
    );
  }

  const renderLockedContent = (gatedNote: GatedNote) => {
    return (
      <div className="mt-5">
        <p className="blur-sm break-words select-none">
          {formatGatedContent(gatedNote.note.content)}
        </p>
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => {
              handleBuy(gatedNote);
            }}
            className="px-3 py-2 border border-r-4 border-white rounded-full text-white hover:bg-white hover:text-black hover:border-black"
          >
            {(gatedNote.cost / 1000).toFixed(0)} ⚡🔓
          </button>
        </div>
      </div>
    );
  }

  const renderGatedContent = (event: AnnouncementNote) => {
    const gatedNote = gatedNotes.find(
      (gatedNote) => gatedNote.note.id === event.gate
    );
    const keyNote = keyNotes.find(
      (keyNote) => keyNote.gate === event.gate
    );

    if (!gatedNote) return null;

    if(keyNote) return renderUnlockedContent(gatedNote, keyNote);
    
    return renderLockedContent(gatedNote);
  };

  const renderEvents = () => {
    return (
      <div className="w-full mt-4">
        {events.map((event, index) => {
          return (
            <div
              key={index}
              className="flex flex-col mb-6 p-5 border rounded shadow"
            >
              {/* This container ensures content wrapping */}
              <div className="flex-grow overflow-hidden">
                <p className="text-xs mb-5">ID: {event.note.id}</p>
                <h3 className="break-words">{event.note.content}</h3>
              </div>
              {/* Button with a thin white outline */}
              {renderGatedContent(event)}
            </div>
          );
        })}
      </div>
    );
  };

  // ------------------- MAIN -------------------------

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h3 className="mb-2">
        RELAY: {process.env.NEXT_PUBLIC_NOSTR_RELAY as string}
      </h3>
      {renderEvents()}
    </main>
  );
}
