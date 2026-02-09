import { doc, getDoc } from "firebase/firestore";
import { createEffect, createSignal } from "solid-js";
import { db } from "../lib/firebase";
import { useParams } from "@solidjs/router";

export default function EventDetail() {
    const [event, setEvent] = createSignal(null);

    createEffect(async () => {
        const snap = await getDoc(doc(db, "events", useParams().id));
        if (snap.exists() && !snap.data().isPrivate) setEvent(snap.data());
    });

    return (
        <>
            {event()?.name}
        </>);
}