import { createSignal, Show } from "solid-js";
import { authService } from "../services/auth.js";
import Message from "../components/Message.jsx";
import { db } from "../lib/firebase.js";
import { addDoc, collection } from "firebase/firestore";

export default function EventManagement() {
    const [error, setError] = createSignal(null);
    const [success, setSuccess] = createSignal(false);

    const handleSubmit = async (e) => {
        setError(null);
        e.preventDefault();
        const data = new FormData(e.target);
        const name = data.get("name");
        const description = data.get("description");
        const datetime = new Date(data.get("datetime"));
        const isPrivate = data.get("isPrivate") ? true : false;
        const userId = authService.getCurrentUser().uid;
        console.log("Data", name, description, datetime, isPrivate, userId);

        try {
            const eventsRef = collection(db, "events");
            const eventRef = await addDoc(eventsRef, {
                name, description, datetime, isPrivate, userId, created: new Date()
            });
            console.log("Event added", eventRef.id);
            setSuccess(true);
        } catch (error) {
            console.log("Event not added", error);
            setError("Dodavanje događaja nije uspjelo")
        }
    };

    return (
        <>
            <h1 class="text-2xl uppercase tracking-wider mb-4 w-full text-center">Dodavanje događaja</h1>

            <Message message={error()} type="error" />

            <Show when={!success()}>
                <form class="max-w-2xl m-auto" onSubmit={handleSubmit}>
                    <label class="floating-label mb-1 w-full">
                        <input class="input input-md w-full" type="text" name="name" placeholder="Ime" required="true" />
                        <span>Naziv</span>
                    </label>

                    <fieldset class="fieldset">
                        <textarea class="textarea h-24 w-full" placeholder="Opis" name="description" required="true"></textarea>
                    </fieldset>

                    <label class="floating-label mb-1 w-full">
                        <input class="input input-md w-full" type="datetime-local" name="datetime" placeholder="Datum i vrijeme" required="true" />
                        <span>Datum i vrijeme</span>
                    </label>

                    <fieldset class="fieldset py-2">
                        <label class="label">
                            <input type="checkbox" class="toggle" name="isPrivate" />
                            Privatan događaj
                        </label>
                    </fieldset>

                    <button type="submit" class="btn btn-primary">Potvrdi</button>
                </form>
            </Show>

            <Show when={success()}>
                <Message message="Događaj je uspješno pohranjen" />
            </Show>
        </>
    );
}