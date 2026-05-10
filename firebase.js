/* ============================================================
   firebase.js — Menu App
   Read-only. Uses the SAME Firebase Realtime Database as the
   stock app so the menu always reflects live inventory.
   Firebase Compat SDK loaded via CDN in index.html.
   ============================================================ */

const _firebaseConfig = {
  apiKey:            "AIzaSyCW625XFVSBubJXeg7TOgjiiCNVg9ESipc",
  authDomain:        "budmemberapp.firebaseapp.com",
  databaseURL:       "https://budmemberapp-default-rtdb.firebaseio.com",
  projectId:         "budmemberapp",
  storageBucket:     "budmemberapp.firebasestorage.app",
  messagingSenderId: "269040218229",
  appId:             "1:269040218229:web:3ca449a0b0dd1801ce083c"
};

firebase.initializeApp(_firebaseConfig);
const db = firebase.database();

/* ============================================================
   STOCK — real-time read-only listener
   /stock/{itemId}

   Calls callback(items[]) immediately with the current data
   and again every time the stock changes in Firebase.
   Returns an unsubscribe function you can call to stop listening.
   ============================================================ */
function listenStock(callback) {
  const ref     = db.ref('stock').orderByChild('createdAt');
  const handler = snap => {
    const items = [];
    snap.forEach(child => {
      const d = child.val();
      items.push({
        id:          child.key,
        name:        d.name        || '',
        category:    d.category    || 'weed',
        quantity:    d.quantity    ?? 0,
        unit:        d.unit        || '',
        gramsInfo:   d.gramsInfo   || null,
        icon:        d.icon        || null,
        strain:      d.strain      || null,
        tags:        d.tags        || {},
        soldOut:         d.soldOut         || false,
        hiddenFromMenu:  d.hiddenFromMenu  || false,
        infoMessage:     d.infoMessage     || null
      });
    });
    callback(items.reverse()); /* newest first */
  };

  ref.on('value', handler);

  /* Return unsubscribe */
  return () => ref.off('value', handler);
}
