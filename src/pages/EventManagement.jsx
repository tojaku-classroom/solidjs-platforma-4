import { createSignal, Show, For, createEffect } from "solid-js";
import { authService } from "../services/auth.js";
import { db } from "../lib/firebase.js";
import { collection, addDoc, query, where, updateDoc, deleteDoc, getDocs, doc, limit, orderBy, startAfter } from "firebase/firestore";
import { addToast } from "../components/Toast.jsx";

export default function EventManagement() {
    const EVENTS_PER_PAGE = 2;

    let formRef;

    const [searchTerm, setSearchTerm] = createSignal("");
    const [events, setEvents] = createSignal([]);
    const [selectedEvent, setSelectedEvent] = createSignal(null);
    const [loading, setLoading] = createSignal(false);
    const [lastDoc, setLastDoc] = createSignal(null);
    const [sortBy, setSortBy] = createSignal("created-desc");
    const [imageBase64, setImageBase64] = createSignal("");

    const getSortParams = () => {
        const sort = sortBy();
        switch (sort) {
            case "created-desc":
                return { field: "created", direction: "desc" };
            case "created-asc":
                return { field: "created", direction: "asc" };
            case "datetime-desc":
                return { field: "datetime", direction: "desc" };
            case "datetime-asc":
                return { field: "datetime", direction: "asc" };
            case "name-asc":
                return { field: "name", direction: "asc" };
            case "name-desc":
                return { field: "name", direction: "desc" };
            default:
                return { field: "created", direction: "desc" };
        }
    }

    // učitavanje prvih 10 događaja
    const loadInitialEvents = async () => {
        setLoading(true);
        try {
            const userId = authService.getCurrentUser().uid;
            const eventsRef = collection(db, "events");
            const sortParams = getSortParams();
            const q = query(
                eventsRef,
                where("userId", "==", userId),
                orderBy(sortParams.field, sortParams.direction),
                limit(EVENTS_PER_PAGE)
            );
            const snapshot = await getDocs(q);
            setEvents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        } catch (error) {
            console.error(error.message);
            addToast("Greška učitavanja", "error");
        } finally {
            setLoading(false);
        }
    }
    loadInitialEvents(); // poziv pri pokretanju komponenta

    createEffect(() => {
        sortBy();
        loadInitialEvents();
    });

    // pretraživanje
    const searchEvents = async () => {
        const term = searchTerm().toLowerCase().trim();
        if (!term || term.length <= 3) return;

        setLoading(true);

        try {
            const userId = authService.getCurrentUser().uid;
            const eventsRef = collection(db, "events");
            const sortParams = getSortParams();
            const q = query(
                eventsRef,
                where("userId", "==", userId),
                orderBy(sortParams.field, sortParams.direction),
                limit(100)
            );
            const snapshot = await getDocs(q);
            const found = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((event) => event.name.toLowerCase().includes(term));
            setEvents(found);
            setLastDoc(null);
        } catch (error) {
            console.error(error.message);
            addToast("Greška pretraživanja", "error");
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        const userId = authService.getCurrentUser().uid;

        const data = new FormData(e.target);
        const eventData = {
            name: data.get("name"),
            description: data.get("description"),
            datetime: new Date(data.get("datetime")),
            isPrivate: !!data.get("isPrivate"),
            imageBase64: imageBase64() || selectedEvent().imageBase64 || "",
            userId: userId,
            created: new Date()
        };

        try {
            if (selectedEvent()) {
                // ažuriranje
                const docRef = doc(db, "events", selectedEvent().id);
                await updateDoc(docRef, eventData);
                setEvents(
                    events().map((event) => (event.id === selectedEvent().id ? { ...event, ...eventData } : event))
                );
                setSelectedEvent({ ...selectedEvent(), ...eventData });
            } else {
                // dodavanje
                const eventsRef = collection(db, "events");
                const docRef = await addDoc(eventsRef, eventData);
                setEvents([...events(), { id: docRef.id, ...eventData }]);
                e.target.reset();
                setImageBase64("");
            }
            addToast(selectedEvent() ? "Događaj je ažuriran" : "Događaj je dodan", "success");
        } catch (error) {
            console.error("Operation error", error.message);
            addToast(selectedEvent() ? "Ažuriranje nije uspjelo" : "Dodavanje nije uspjelo", "error");
        }
    };

    // brisanje
    const handleDelete = async () => {
        if (!confirm("Jeste li sigurni?")) return;

        try {
            const docRef = doc(db, "events", selectedEvent().id);
            await deleteDoc(docRef);
            setEvents(events().filter((event) => (event.id !== selectedEvent().id)));
            setSelectedEvent(null);
            formRef.reset();
            addToast("Događaj je obrisan", "success");
        } catch (error) {
            console.error("Delete error", error.message);
            addToast("Brisanje nije uspjelo", "error");
        }
    };

    createEffect(() => {
        if (selectedEvent() && formRef) {
            const event = selectedEvent();
            formRef.name.value = event.name;
            formRef.description.value = event.description;
            if (event.datetime) {
                const date = event.datetime.toDate ? event.datetime.toDate() : event.datetime;
                formRef.datetime.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            }
            formRef.isPrivate.checked = event.isPrivate;
            setImageBase64(event.imageBase64 || "");
        }
    });

    // pomoćna funkcija za oblikovanje datuma
    const formatEventDate = (datetime) => {
        if (!datetime) return "Nije zadan datum";
        if (datetime.toDate) return datetime.toDate().toLocaleString();
        if (datetime.toLocaleString) return datetime.toLocaleString();
        return "Nije zadan datum";
    }

    // pomoćna funkcija za konverziju slike
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 524288) {
            addToast("Slika mora biti manje od 512 KB", "error");
            e.target.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = () => setImageBase64(reader.result);
        reader.readAsDataURL(file);
    }

    // učitavanje sljedeće stranice
    const loadMore = async () => {
        if (!lastDoc()) return;
        setLoading(true);
        try {
            const userId = authService.getCurrentUser().uid;
            const eventsRef = collection(db, "events");
            const sortParams = getSortParams();
            const q = query(
                eventsRef,
                where("userId", "==", userId),
                orderBy(sortParams.field, sortParams.direction),
                startAfter(lastDoc()),
                limit(EVENTS_PER_PAGE + 1)
            );
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.slice(0, EVENTS_PER_PAGE);
            setEvents([...events(), ...docs.map((doc) => ({ id: doc.id, ...doc.data() }))]);
            if (snapshot.docs.length > EVENTS_PER_PAGE) {
                setLastDoc(snapshot.docs[EVENTS_PER_PAGE - 1]);
            } else {
                setLastDoc(null);
            }
        } catch (error) {
            console.error(error.message);
            addToast("Greška učitavanja", "error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <h1 class="text-2xl uppercase tracking-wider mb-4 w-full text-center">
                {selectedEvent() ? "Uređivanje događaja" : "Dodavanje događaja"}
            </h1>

            {/* Pretraživanje */}
            <div class="max-w-2xl m-auto mb-4">
                <div class="join w-full">
                    <input
                        class="input input-bordered join-item w-full"
                        type="text"
                        placeholder="Pretraživanje po nazivu"
                        value={searchTerm()}
                        onInput={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchEvents()}
                    />
                    <button class="btn join-item" onClick={searchEvents}>
                        Traži
                    </button>
                </div>
            </div>

            {/* Izbornik sortiranja */}
            <div class="max-w-2xl m-auto mb-4">
                <select class="select select-bordered w-full" value={sortBy()}
                    onChange={(e) => setSortBy(e.target.value)}>
                    <option value="created-desc">Dodani prije</option>
                    <option value="created-asc">Dodani kasnije</option>
                    <option value="datetime-asc">Najraniji prvo</option>
                    <option value="datetime-desc">Najstariji prvo</option>
                    <option value="name-asc">Naziv A-Z</option>
                    <option value="name-desc">Naziv Z-A</option>
                </select>
            </div>

            {/* Tijek učitavanja */}
            <Show when={loading()}>
                <div class="flex justify-center">
                    <span class="loading loading-spinner loading-lg"></span>
                </div>
            </Show>

            {/* Prikaz događaja */}
            <Show when={events().length > 0}>
                <div class="max-w-2xl m-auto mb-4 space-y-2">
                    <For each={events()}>
                        {(event) => (
                            <div
                                class={`card bg-base-200 cursor-pointer hover:bg-base-300 ${selectedEvent()?.id === event.id ? "ring-2 ring-primary" : ""}`}
                                onClick={() => setSelectedEvent(event)}
                            >
                                <div class="card-body p-4">
                                    <h3 class="font-bold">{event.name}</h3>
                                    <p class="text-sm text-gray-600">
                                        {formatEventDate(event.datetime)}
                                        {event.isPrivate && <span class="badge badge-sm ml-2">Privatan</span>}
                                    </p>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* Gumb za učitvanje sljedeće stranice */}
            <Show when={lastDoc()}>
                <div class="max-w-2xl m-auto mb-4 flex justify-center">
                    <button class="btn btn-sm" onClick={loadMore} disabled={loading()}>
                        <Show when={loading()} fallback="Učitaj više">
                            <span class="loading loading-spinner loading-sm"></span>
                        </Show>
                    </button>
                </div>
            </Show>

            <form class="max-w-2xl m-auto" onSubmit={handleSubmit} ref={formRef}>
                <label class="floating-label mb-1 w-full">
                    <input class="input input-md w-full" type="text" name="name" placeholder="Ime" required />
                    <span>Naziv</span>
                </label>

                <fieldset class="fieldset">
                    <textarea class="textarea h-24 w-full" placeholder="Opis" name="description" required></textarea>
                </fieldset>

                <label class="floating-label mb-1 w-full">
                    <input class="input input-md w-full" type="datetime-local" name="datetime" placeholder="Datum i vrijeme" required />
                    <span>Datum i vrijeme</span>
                </label>

                <fieldset class="fieldset py-2">
                    <label class="label cursor-pointer flex flex-col items-start gap-2">
                        Slika događaja (max. 512 KB)
                    </label>
                    <input type="file"
                        accept="image/*"
                        class="file-input file-input-bordered file-input-sm w-full"
                        onChange={handleImageChange} />
                    <Show when={imageBase64()}>
                        <img src={imageBase64()} class="w-32 h-32 object-cover rounded" alt="Preview" />
                    </Show>
                </fieldset>

                <fieldset class="fieldset py-2">
                    <label class="label">
                        <input type="checkbox" class="toggle" name="isPrivate" />
                        Privatan događaj
                    </label>
                </fieldset>

                <div class="flex gap-2 justify-between">
                    <Show when={selectedEvent()}>
                        <button type="button" class="btn btn-error" onClick={handleDelete}>
                            Izbriši
                        </button>
                        <button type="button" class="btn btn-ghost"
                            onClick={() => {
                                setSelectedEvent(null);
                                formRef.reset();
                            }}>
                            Odustani
                        </button>
                    </Show>
                    <button type="submit" class="btn btn-primary">
                        {selectedEvent() ? "Spremi" : "Dodaj"}
                    </button>
                </div>
            </form>
        </>
    );
}