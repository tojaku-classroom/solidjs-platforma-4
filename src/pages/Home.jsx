import { createSignal, Show, For, onMount } from "solid-js";
import { isAuthenticated, authService } from "../services/auth.js";
import { db } from "../lib/firebase.js";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

export default function Home() {
    const [events, setEvents] = createSignal([]);
    const [loading, setLoading] = createSignal(false);
    const [favorites, setFavorites] = createSignal([]);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const eventsRef = collection(db, "events");
            const q = query(eventsRef, where("isPrivate", "==", false));
            const snapshot = await getDocs(q);
            setEvents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

            // učitavanje korisnikovih favorita
            if (isAuthenticated()) {
                const userId = authService.getCurrentUser().uid;
                const userFavs = snapshot.docs
                    .filter(doc => doc.data().favorites?.includes(userId))
                    .map(doc => doc.id);
                setFavorites(userFavs);
            }
        } catch (error) {
            console.error("Event load failed", error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <h1>Dobro došli na naslovnicu</h1>
        </>
    );
}