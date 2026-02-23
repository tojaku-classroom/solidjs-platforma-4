import { createSignal, createMemo, Show, For, createEffect, onCleanup } from "solid-js";
import { isAuthenticated, authService } from "../services/auth.js";
import { db } from "../lib/firebase.js";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { formatDistanceToNow, isPast } from "date-fns";
import { hr } from "date-fns/locale";
import { addToast } from "../components/Toast.jsx";

export default function Home() {
    const [events, setEvents] = createSignal([]);
    const [loading, setLoading] = createSignal(false);
    const [favorites, setFavorites] = createSignal([]);
    const [sortBy, setSortBy] = createSignal("datetime-asc");

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

    const toggleFavorite = async (eventId) => {
        if (!isAuthenticated()) return;

        const userId = authService.getCurrentUser().uid;
        const isFavorite = favorites().includes(eventId);

        try {
            const eventRef = doc(db, "events", eventId);
            await updateDoc(eventRef,
                { favorites: isFavorite ? arrayRemove(userId) : arrayUnion(userId) }
            );
            setFavorites(isFavorite
                ? favorites().filter(id => id !== eventId)
                : [...favorites(), eventId]
            );
            // ažuriramo stanje polja "favorites" - popis korisnika kojima je događaj označen
            setEvents(events().map(event =>
                event.id === eventId // u postojećem popisu događaj tražimo ciljani događaj
                    ? { // našli smo ciljani događaj, ažuriramo ga
                        ...event, favorites: isFavorite // uzimamo stare podatke događaja i ažuriramo polje "favorites"
                            ? (event.favorites || []).filter(id => id !== userId) // ako je događaj prije bio u "favorites" sada ga izbacujemo
                            : [...(event.favorites || []), userId] // ako događaj nije bio u "favorites" sada ga dodajemo
                    }
                    : event // događaj koji nije ciljani ne diramo, ostavljamo takvim kakav jest
            ));
        } catch (error) {
            console.error("Error toggling favorite", error.message);
        }
    }

    // pomoćna funkcija za oblikovanje datuma
    const formatEventDate = (datetime) => {
        if (!datetime) return "Nije zadan datum";
        if (datetime.toDate) return datetime.toDate().toLocaleString();
        if (datetime.toLocaleString) return datetime.toLocaleString();
        return "Nije zadan datum";
    }

    const sortedEvents = createMemo(() => {
        const sorted = [...events()];
        const sort = sortBy();

        switch (sort) {
            case "datetime-desc":
                return sorted.sort((a, b) => {
                    const dateA = a.datetime?.toDate?.() || a.datetime || new Date(0);
                    const dateB = b.datetime?.toDate?.() || b.datetime || new Date(0);
                    return dateB - dateA;
                });
            case "datetime-asc":
                return sorted.sort((a, b) => {
                    const dateA = a.datetime?.toDate?.() || a.datetime || new Date(0);
                    const dateB = b.datetime?.toDate?.() || b.datetime || new Date(0);
                    return dateA - dateB;
                });
            case "name-asc":
                return sorted.sort((a, b) => a.name.localeCompare(b.name));
            case "name-desc":
                return sorted.sort((a, b) => b.name.localeCompare(a.name));
            case "favorites-desc":
                return sorted.sort((a, b) => {
                    const favA = a.favorites?.length || 0;
                    const favB = b.favorites?.length || 0;
                    return favB - favA;
                });
            default:
                return sorted;
        }
    });

    // tajmeri događaja
    const [timeLeft, setTimeLeft] = createSignal({});
    const updateCountdown = () => {
        const counters = {};
        sortedEvents().forEach(event => {
            const date = event.datetime?.toDate?.() || event.datetime;
            if (date) {
                counters[event.id] = isPast(date) ? "Prošao" : formatDistanceToNow(date, { addSuffix: true, locale: hr, includeSeconds: true });
            }
        });
        setTimeLeft(counters);
    }

    createEffect(() => {
        if (sortedEvents().length > 0) {
            updateCountdown();
            const interval = setInterval(updateCountdown, 1000);
            onCleanup(() => clearInterval(interval));
        }
    });

    createEffect(async () => {
        if (isAuthenticated()) {
            await loadEvents();
        }
    });

    const shareEvent = async (eventId) => {
        const shareUrl = `${window.location.origin}/event/view/${eventId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            addToast("Link događaja kopiran u međuspremnik", "success")
        } catch (error) {
            addToast("Greška kopiranja u međuspremnik", "error");
        }
    }

    return (
        <>
            <h1 class="text-2xl uppercase tracking-wider mb-4 w-full text-center">Dobro došli na naslovnicu</h1>

            <Show when={!isAuthenticated()}>
                <p class="text-center text-gray-600">Prijavite se kako biste vidjeli događaje</p>
            </Show>

            <Show when={isAuthenticated()}>
                <Show when={loading()}>
                    <div class="flex justify-center">
                        <span class="loading loading-spinner loading-lg"></span>
                    </div>
                </Show>

                <Show when={!loading() && sortedEvents().length === 0}>
                    <p class="text-center text-gray-600">Nema dostupnih događaja</p>
                </Show>

                <Show when={!loading() && sortedEvents().length > 0}>
                    {/* Izbornik sortiranja */}
                    <div class="max-w-4xl m-auto mb-4">
                        <select class="select select-bordered w-full" value={sortBy()}
                            onChange={(e) => setSortBy(e.target.value)}>
                            <option value="datetime-asc">Najraniji prvo</option>
                            <option value="datetime-desc">Najstariji prvo</option>
                            <option value="name-asc">Naziv A-Z</option>
                            <option value="name-desc">Naziv Z-A</option>
                            <option value="favorites-desc">Najpopularniji</option>
                        </select>
                    </div>

                    <div class="max-w-4xl m-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                        <For each={sortedEvents()}>
                            {(event) =>
                            (
                                <div class="card bg-base-200 shadow-md">
                                    <Show when={event.imageBase64}>
                                        <figure class="h-48 overflow-hidden">
                                            <img src={event.imageBase64} alt={event.name} class="w-full h-full object-cover" />
                                        </figure>
                                    </Show>
                                    <div class="card-body">
                                        <div class="flex justify-between items-start">
                                            <h3 class="card-title">
                                                <a href={`/event/view/${event.id}`}>
                                                    {event.name}
                                                </a>
                                            </h3>
                                            <div class="flex gap-1">
                                                <button class="btn btn-ghost btn-circle btn-sm" onClick={() => shareEvent(event.id)}>
                                                    🔗
                                                </button>
                                                <button class="btn btn-ghost btn-circle btn-sm" onClick={() => toggleFavorite(event.id)}>
                                                    {favorites().includes(event.id) ? "💙" : "🤍"}
                                                </button>
                                            </div>
                                        </div>
                                        <p class="text-sm">{event.description}</p>
                                        <p class="text-xs text-gray-600">{formatEventDate(event.datetime)}</p>
                                        <p class="text-sm font-semibold text-orange-600">{timeLeft()[event.id]}</p>
                                        <Show when={event.favorites?.length > 0}>
                                            <p class="text-xs text-gray-500">💙 {event.favorites.length}</p>
                                        </Show>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </Show>
        </>
    );
}