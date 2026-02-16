import { createSignal, createEffect, Show, For } from "solid-js";
import { authService, isAuthenticated } from "../services/auth";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function UserProfile() {
    const [user, setUser] = createSignal(null);
    const [myEvents, setMyEvents] = createSignal([]);
    const [favorites, setFavorites] = createSignal([]);
    const [loading, setLoading] = createSignal(true);

    createEffect(async () => {
        if (!isAuthenticated()) return;
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);

        const myEventsSnap = await getDocs(
            query(
                collection(db, "events"),
                where("userId", "==", currentUser.uid)
            )
        );
        setMyEvents(myEventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const favSnap = await getDocs(
            query(
                collection(db, "events"),
                where("favorites", "array-contains", currentUser.uid)
            )
        );
        setFavorites(favSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        setLoading(false);
    });

    const formatDate = (dt) => dt?.toDate?.().toLocaleString() || '-';

    return (
        <div class="max-w-4xl mx-auto p-4">
            <h1 class="text-3xl font-bold mb-6">Moj Profil</h1>

            <Show when={loading()}>
                <span class="loading loading-infinity loading-lg"></span>
            </Show>

            <Show when={!loading() && user()}>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {/* Podaci o korisniku */}
                    <div class="card bg-base-200">
                        <div class="card-body">
                            <h2 class="card-title text-lg">👤 Profil</h2>
                            <p>Ime: {user().displayName || "Nije postavljeno"}</p>
                            <p>E-mail: {user().email}</p>
                        </div>
                    </div>

                    {/* Statistika */}
                    <div class="card bg-base-200">
                        <div class="card-body">
                            <h2 class="card-title text-lg">📊 Statistika</h2>
                            <p>Moji događaji: {myEvents().length}</p>
                            <p>Omiljeni događaji: {favorites().length}</p>
                        </div>
                    </div>

                    {/* Mogućnosti */}
                    <div class="card bg-base-200">
                        <div class="card-body">
                            <h2 class="card-title text-lg">⚙️ Mogućnosti</h2>
                            <a href="/event/management" class="btn btn-sm btn-primary">Upravljanje događajima</a>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}