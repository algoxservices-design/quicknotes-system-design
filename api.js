const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadButton = document.getElementById("load-btn");
const statusElement = document.getElementById("status");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitButton = document.getElementById("submit-btn");
const notesList = document.getElementById("notes-list");

let notesById = new Map();
let activeRequests = 0;

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = "status";
  if (type === "success" || type === "error") {
    statusElement.classList.add(type);
  }
}

function syncButtons() {
  const busy = activeRequests > 0;
  loadButton.disabled = busy;
  submitButton.disabled = busy;
  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.disabled = busy;
  });
}

function showRequestStarted(message) {
  activeRequests += 1;
  syncButtons();
  setStatus(message);
}

function showRequestFinished() {
  activeRequests = Math.max(0, activeRequests - 1);
  syncButtons();
}

/*
 * Reusable request helper: returns both parsed response data and HTTP status.
 * JSONPlaceholder simulates POST/DELETE responses; these changes are not
 * persisted by the remote service after the request finishes or the page reloads.
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`The server returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  let data = null;
  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    }
  }

  return { data, status: response.status };
}

function createNoteElement(note) {
  const item = document.createElement("li");
  item.className = "note-item";
  item.dataset.noteId = String(note.id);

  const topLine = document.createElement("div");
  topLine.className = "note-topline";

  const textContainer = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = note.title || "(Untitled note)";

  const body = document.createElement("p");
  body.textContent = note.body || "No body provided.";

  const noteId = document.createElement("span");
  noteId.className = "note-id";
  noteId.textContent = `Note ID: ${note.id}`;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-btn";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete note ${note.id}`);
  deleteButton.addEventListener("click", () => deleteNote(note.id, item));

  textContainer.append(title, body, noteId);
  topLine.append(textContainer, deleteButton);
  item.append(topLine);
  return item;
}

function renderNotes() {
  notesList.replaceChildren();

  if (notesById.size === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "note-item";
    emptyItem.textContent = "No notes to show. Load notes or create your first note.";
    notesList.append(emptyItem);
    return;
  }

  for (const note of notesById.values()) {
    notesList.append(createNoteElement(note));
  }
  // Newly rendered delete buttons must also be disabled while a request is active.
  syncButtons();
}

async function loadNotes() {
  showRequestStarted("Loading notes...");
  try {
    const result = await request(`${API_URL}?_limit=10`);
    const notes = Array.isArray(result.data) ? result.data : [];
    notesById = new Map(notes.map((note) => [String(note.id), note]));
    renderNotes();

    if (notes.length === 0) {
      setStatus("The server returned no notes.", "success");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus(`Could not load notes. ${error.message} Please try again.`, "error");
    if (notesById.size === 0) {
      notesList.replaceChildren();
      const emptyItem = document.createElement("li");
      emptyItem.className = "note-item";
      emptyItem.textContent = "Notes could not be loaded. Check your connection and try again.";
      notesList.append(emptyItem);
    }
  } finally {
    showRequestFinished();
  }
}

async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    setStatus("Please enter a title before creating a note.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("The title must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  showRequestStarted("Creating note...");
  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title, body, userId: 1 })
    });

    const created = result.data;
    if (!created || created.id === undefined) {
      throw new Error("The server response did not include a note ID.");
    }

    notesById = new Map([[String(created.id), created], ...notesById]);
    renderNotes();
    noteForm.reset();
    setStatus(`Note created (status ${result.status}, id ${created.id}).`, "success");
  } catch (error) {
    setStatus(`Could not create the note. ${error.message} Please try again.`, "error");
  } finally {
    showRequestFinished();
  }
}

async function deleteNote(noteId, item) {
  showRequestStarted(`Deleting note ${noteId}...`);
  try {
    const result = await request(`${API_URL}/${encodeURIComponent(noteId)}`, {
      method: "DELETE"
    });

    // JSONPlaceholder returns a simulated success; it does not persist deletions.
    // Remove the note from this page's local view, but explain that it may return on reload.
    notesById.delete(String(noteId));
    item.remove();
    if (notesById.size === 0) {
      renderNotes();
    }
    setStatus(`Note ${noteId} removed from this page (status ${result.status}). JSONPlaceholder does not permanently save deletions.`, "success");
  } catch (error) {
    setStatus(`Could not delete note ${noteId}. ${error.message} Please try again.`, "error");
  } finally {
    showRequestFinished();
  }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
syncButtons();
