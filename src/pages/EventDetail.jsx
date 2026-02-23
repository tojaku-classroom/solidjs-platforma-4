import { doc, getDoc } from "firebase/firestore";
import { createEffect, createSignal, Show } from "solid-js";
import { db } from "../lib/firebase";
import { useParams } from "@solidjs/router";

export default function EventDetail() {
    const [event, setEvent] = createSignal(null);
    const [loading, setLoading] = createSignal(true);

    createEffect(async () => {
        const snap = await getDoc(doc(db, "events", useParams().id));
        if (snap.exists() && !snap.data().isPrivate) setEvent(snap.data());
        setLoading(false);
    });

    const formatDate = (dt) => dt?.toDate?.().toLocaleString() || "-";

    return (
        <div class="min-h-screen bg-base-100">
            <div class="max-w-2xl mx-auto p-4">
                <a href="/" class="btn btn-ghost btn-sm mb-4">Naslovnica</a>

                <Show when={loading()}>
                    <div class="flex justify-center py-12">
                        <span class="loading loading-spinner loading-lg"></span>
                    </div>
                </Show>

                <Show when={!loading() && event()}>
                    <div class="card bg-base-200 shadow-lg">
                        <Show when={event().imageBase64}>
                            <figure class="max-h-96 overflow-hidden">
                                <img src={event().imageBase64} alt={event().name} class="w-full h-full object-cover" />
                            </figure>
                        </Show>
                        <div class="card-body">
                            <h1 class="card-title text-3xl mb-4">{event().name}</h1>
                            <p class="text-base opacity-90 mb-4">{event().description}</p>
                            <p class="divider my-2"></p>
                            <p class="text-sm font-semibold">📅 {formatDate(event().datetime)}</p>
                        </div>
                    </div>
                </Show>

                <Show when={!loading() && !event()}>
                    <div class="alert alert-info">
                        Događaj ne postoji
                    </div>
                </Show>
            </div>
        </div>
    );
}