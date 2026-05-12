import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { getFirestore, collection, setDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

let app, db, auth, provider;

try {
  const configResponse = await fetch('./firebase-applet-config.json');
  const firebaseConfig = await configResponse.json();

  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
} catch (err) {
  console.error("Failed to load Firebase config:", err);
  alert("Could not load database configuration. Are you missing firebase-applet-config.json?");
}

// Error Handling
const handleFirestoreError = (error, operationType, path) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// Utilities for Time Parsing
const timeToSeconds = (timeStr) => {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};

const secondsToTime = (totalSeconds) => {
  if (!totalSeconds) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// App State
let appData = { books: [] };
let unsubscribeBooks = null;

// DOM Elements
const els = {
  modal: document.getElementById('login-modal'),
  appContent: document.getElementById('app-content'),
  loginBtn: document.getElementById('login-btn'),
  greeting: document.getElementById('greeting'),
  logoutBtn: document.getElementById('logout-btn'),
  exportBtn: document.getElementById('export-btn'),
  importBtnUi: document.getElementById('import-btn-ui'),
  importFile: document.getElementById('import-file'),
  bookList: document.getElementById('book-list'),
  newType: document.getElementById('new-type'),
  dynamicInputs: document.getElementById('dynamic-inputs'),
  addBookBtn: document.getElementById('add-book-btn')
};

// Auth State Listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    els.modal.style.display = 'none';
    els.appContent.style.display = 'block';
    els.greeting.innerText = `${user.email.split('@')[0]}'s books`;
    loadFirebaseData(user.uid);
  } else {
    els.modal.style.display = 'flex';
    els.appContent.style.display = 'none';
    if (unsubscribeBooks) unsubscribeBooks();
    appData.books = [];
  }
});

els.loginBtn.onclick = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login failed", error);
  }
};

els.logoutBtn.onclick = async () => {
  await signOut(auth);
};

// Data Loading
const loadFirebaseData = (userId) => {
  const q = query(collection(db, 'books'), where('userId', '==', userId));
  unsubscribeBooks = onSnapshot(q, (snapshot) => {
    const books = [];
    snapshot.forEach((docSnap) => {
      books.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort client-side to avoid needing a composite index
    books.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
    appData.books = books;
    renderBooks();
  }, (error) => {
    handleFirestoreError(error, 'list', 'books');
  });
};

// Dynamic Form Inputs
els.newType.onchange = (e) => {
  const type = e.target.value;
  let html = '';
  if (type === 'paperback') {
    html = `<input type="number" id="new-total-pages" placeholder="Total Pages" min="1" />`;
  } else if (type === 'audio-single') {
    html = `<input type="text" id="new-total-time" placeholder="Total Time (H:MM:SS or M:SS)" />`;
  } else if (type === 'audio-chapter') {
    html = `<p style="font-size:0.8rem; margin:auto 0; color:var(--fg-muted)">Import chapters.txt after creation</p>`;
  }
  els.dynamicInputs.innerHTML = html;
};

// Add Book
els.addBookBtn.onclick = async () => {
  if (!auth.currentUser) return;
  const title = document.getElementById('new-title').value.trim();
  const emoji = document.getElementById('new-emoji').value.trim() || '📚';
  const type = els.newType.value;

  if (!title) return alert("Title is required!");

  const newBook = {
    title,
    emoji,
    type,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (type === 'paperback') {
    const total = parseInt(document.getElementById('new-total-pages').value, 10);
    if (!total || total <= 0) return alert("Enter valid total pages!");
    newBook.progress = 0;
    newBook.total = total;
  } else if (type === 'audio-single') {
    const totalStr = document.getElementById('new-total-time').value.trim();
    const totalSecs = timeToSeconds(totalStr);
    if (totalSecs <= 0) return alert("Enter valid total time (e.g., 12:22:00)!");
    newBook.totalSecs = totalSecs;
    newBook.progressSecs = 0;
  } else if (type === 'audio-chapter') {
    newBook.chapters = [];
  }

  try {
    const docRef = doc(collection(db, 'books'));
    await setDoc(docRef, newBook);
    
    // reset form
    document.getElementById('new-title').value = '';
    document.getElementById('new-emoji').value = '';
    if(document.getElementById('new-total-pages')) document.getElementById('new-total-pages').value = '';
    if(document.getElementById('new-total-time')) document.getElementById('new-total-time').value = '';
  } catch (error) {
    handleFirestoreError(error, 'create', 'books');
  }
};

// Render List
const renderBooks = () => {
  els.bookList.innerHTML = '';
  if (appData.books.length === 0) {
    els.bookList.innerHTML = `<p style="color:var(--fg-muted); text-align:center;">No books yet. Add one above!</p>`;
    return;
  }

  appData.books.forEach(book => {
    const bookEl = document.createElement('div');
    bookEl.className = 'book-item';
    
    let perc = 0;
    let statsHtml = '';
    let controlsHtml = '';

    if (book.type === 'paperback') {
      perc = Math.min((book.progress / book.total) * 100, 100).toFixed(1);
      statsHtml = `<span>${book.progress} / ${book.total} pages</span><span>${perc}%</span>`;
      controlsHtml = `
        <div class="update-controls">
          <input type="number" id="prog-${book.id}" value="${book.progress}" min="0" max="${book.total}" />
          <button onclick="updatePaperback('${book.id}')">Update</button>
        </div>`;
    } else if (book.type === 'audio-single') {
      perc = book.totalSecs ? Math.min((book.progressSecs / book.totalSecs) * 100, 100).toFixed(1) : 0;
      statsHtml = `<span>${secondsToTime(book.progressSecs)} / ${secondsToTime(book.totalSecs)}</span><span>${perc}%</span>`;
      controlsHtml = `
        <div class="update-controls">
          <input type="text" id="prog-${book.id}" placeholder="H:MM:SS" value="${secondsToTime(book.progressSecs)}" />
          <button onclick="updateAudioSingle('${book.id}')">Update</button>
        </div>`;
    } else if (book.type === 'audio-chapter') {
      const completed = book.chapters ? book.chapters.filter(c => c.completed).length : 0;
      const total = book.chapters ? book.chapters.length : 0;
      perc = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
      statsHtml = `<span>${completed} / ${total} chapters</span><span>${perc}%</span>`;
      
      if (total === 0) {
        controlsHtml = `
          <div class="update-controls">
            <input type="file" id="chap-file-${book.id}" accept=".txt" style="display:none;" onchange="importChapters(event, '${book.id}')" />
            <button onclick="document.getElementById('chap-file-${book.id}').click()">Import chapters.txt</button>
          </div>`;
      } else {
        let chapterHtml = book.chapters.map((chap, idx) => `
          <div class="chapter-item ${chap.completed ? 'completed' : ''}">
            <span>${idx+1}. ${chap.title || 'Chap'} (${chap.duration})</span>
            ${chap.completed 
              ? `<button onclick="toggleChapter('${book.id}', ${idx}, false)">Undo</button>`
              : `<button onclick="toggleChapter('${book.id}', ${idx}, true)">Done</button>`
            }
          </div>
        `).join('');
        controlsHtml = `<div class="chapter-list">${chapterHtml}</div>`;
      }
    }

    bookEl.innerHTML = `
      <div class="book-header">
        <div class="book-title"><span class="book-emoji">${book.emoji}</span> ${book.title}</div>
        <button style="background:transparent; border:none; color:#cc4444;" onclick="deleteBook('${book.id}')">X</button>
      </div>
      <div class="progress-container">
        <div class="progress-bar" style="width: ${perc}%"></div>
      </div>
      <div class="progress-stats">${statsHtml}</div>
      ${controlsHtml}
    `;
    els.bookList.appendChild(bookEl);
  });
};

// Global Functions for Inline HTML Handlers
window.deleteBook = async (id) => {
  if(confirm("Delete this book?")) {
    try {
      await deleteDoc(doc(db, 'books', id));
    } catch (error) {
       handleFirestoreError(error, 'delete', `books/${id}`);
    }
  }
};

window.updatePaperback = async (id) => {
  const book = appData.books.find(b => b.id === id);
  const val = parseInt(document.getElementById(`prog-${id}`).value, 10);
  if (!isNaN(val) && val >= 0) {
    try {
      await updateDoc(doc(db, 'books', id), {
        progress: Math.min(val, book.total),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `books/${id}`);
    }
  }
};

window.updateAudioSingle = async (id) => {
  const book = appData.books.find(b => b.id === id);
  const val = document.getElementById(`prog-${id}`).value;
  const secs = timeToSeconds(val);
  if (secs >= 0) {
    try {
      await updateDoc(doc(db, 'books', id), {
        progressSecs: Math.min(secs, book.totalSecs || 0),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `books/${id}`);
    }
  }
};

window.importChapters = (event, id) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const chapters = lines.map(line => {
      const timeMatches = line.match(/\d+:\d+(:\d+)?/);
      const duration = timeMatches ? timeMatches[0] : '0:00';
      return { title: line.split(duration)[0].trim().replace(/:$/, ''), duration, completed: false };
    });
    
    if (chapters.length > 0) {
      try {
        await updateDoc(doc(db, 'books', id), {
          chapters: chapters,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, 'update', `books/${id}`);
      }
    } else {
      alert("Could not parse file. Ensure format is e.g. 'Chapter 1: 4:32'");
    }
  };
  reader.readAsText(file);
};

window.toggleChapter = async (id, idx, isDone) => {
  const book = appData.books.find(b => b.id === id);
  const newChapters = [...book.chapters];
  newChapters[idx].completed = isDone;
  
  try {
    await updateDoc(doc(db, 'books', id), {
      chapters: newChapters,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
     handleFirestoreError(error, 'update', `books/${id}`);
  }
};

// Export JSON
els.exportBtn.onclick = () => {
  // strip out firebase specific data if we want a clean backup
  const cleanData = {
    books: appData.books.map(b => ({
      ...b,
      createdAt: b.createdAt?.toDate().toISOString(),
      updatedAt: b.updatedAt?.toDate().toISOString()
    }))
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `bbbBookProg_${auth.currentUser?.email.split('@')[0]}_backup.json`);
  dlAnchorElem.click();
};

// Import JSON
els.importBtnUi.onclick = () => els.importFile.click();

els.importFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (imported && imported.books) {
        let count = 0;
        for (const book of imported.books) {
          // create new document in firebase
          const newRef = doc(collection(db, 'books'));
          await setDoc(newRef, {
            title: book.title || 'Unknown',
            emoji: book.emoji || '📚',
            type: book.type || 'paperback',
            userId: auth.currentUser.uid,
            progress: book.progress || 0,
            total: book.total || 0,
            progressSecs: book.progressSecs || 0,
            totalSecs: book.totalSecs || 0,
            chapters: book.chapters || [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          count++;
        }
        alert(`Backup restored! Imported ${count} books.`);
        els.importFile.value = '';
      } else {
        alert("Invalid JSON format.");
      }
    } catch(err) {
      alert("Failed to parse JSON.");
    }
  };
  reader.readAsText(file);
};

