'use client';

import { Relay, relayInit, Event as NostrEvent, VerifiedEvent } from "nostr-tools"
import { useEffect, useState } from "react"
import { AnnouncementNote, eventToAnnouncementNote } from "server";

export default function Home() {
  const [relay, setRelay] = useState<Relay | null>(null)
  const [events, setEvents] = useState<AnnouncementNote[]>([])

  useEffect(()=>{
    const newRelay = relayInit(process.env.NEXT_PUBLIC_NOSTR_RELAY as string)
    newRelay.on('connect', () => {
      setRelay(newRelay);
    })
    newRelay.connect();

    return () =>{
      newRelay.close()
    }
  }, []);

  useEffect(()=>{
    if(relay){
      const sub = relay.sub([
        {
          kinds: [1],
          limit: 3,
        }
      ])

      sub.on('event', (data)=>{ 
        
        if(data.tags.find(tag => tag[0] === "g")){
          const announcement = eventToAnnouncementNote(data as VerifiedEvent);
          setEvents([...events, announcement]);
          console.log(announcement);
        }
      })

      return () => {
        sub.unsub()
      }
    }
  }, [relay])

  const handleBuy = (id: string) => {

  }

  const renderEvents = () => {
    return (
      <div className="w-full mt-4">
          {events.map((event, index) => (
              <div key={index} className="flex flex-col mb-6 p-5 border rounded shadow">
                  {/* This container ensures content wrapping */}
                  <div className="flex-grow overflow-hidden">
                      <p className="text-xs mb-5">ID: {event.note.id}</p>
                      <h3 className="break-words">{event.note.content}</h3>
                  </div>
                  {/* Button with a thin white outline */}
                  <div className="mt-4 flex justify-center">
                      <button onClick={()=>{handleBuy(event.note.id)}} className="px-2 py-1 border border-r-4 border-white rounded-full text-white hover:bg-white hover:text-black hover:border-black">
                          Buy Content
                      </button>
                  </div>
              </div>
          ))}
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h3 className="mb-2">RELAY: {process.env.NEXT_PUBLIC_NOSTR_RELAY as string}</h3>
      {renderEvents()}
    </main>
  )
  
}
