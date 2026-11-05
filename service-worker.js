// ═══════════════════════════════════════════════════════════════════
//  Cafelax Stars — Service Worker (v231 · 2026-11-05)
//  ───────────────────────────────────────────────────────────────────
//  اللي كان غلط في النسخة القديمة:
//   ١) urlsToCache فيه '/CafelaxStars.html' وهو مش موجود في الريبو
//      (الملف اسمه index.html). و cache.addAll بترفض الكل لو ملف
//      واحد مش لاقيه — يعني التنصيب كان بيفشل من أساسه.
//   ٢) الـ fetch كان cache-first لكل حاجة من غير أي مراجعة للشبكة:
//      أول ما index.html يتكاش، الموبايل بيفضل على نفس النسخة للأبد.
//      ده معناه إن أي تحديث لـ Stars مش بيوصل لمديري المحلات اللي
//      فتحوا التطبيق قبل كده، إلا لو مسحوا بيانات الموقع بإيدهم.
//   ٣) CACHE_NAME ثابت 'v1' وماتغيّرش، فتنضيف الكاش القديم عمره
//      ما اشتغل.
//
//  اللي اتعمل: الصفحة نفسها بقت network-first — أي نسخة جديدة توصل
//  على طول، والكاش بيشتغل وقت قطع النت بس. باقي الملفات cache-first
//  مع تحديث في الخلفية. يعني مش هتحتاج تزوّد رقم نسخة مع كل رفعة.
// ═══════════════════════════════════════════════════════════════════
const CACHE = 'cafelax-stars-v231';

// الثابت بس — index.html متعمّد مش هنا عشان ييجي من الشبكة دايماً
const STATIC = [
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // كل ملف لوحده — ملف ناقص مايوقّفش التنصيب كله زي ما كان بيحصل
    await Promise.all(STATIC.map(u =>
      cache.add(u).catch(e => console.warn('[SW] اتعدّى', u, e.message))
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => {
      console.log('[SW] بيمسح كاش قديم:', n);
      return caches.delete(n);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  if(req.url.includes('/api/')) return;        // الـ API من الشبكة دايماً

  let url;
  try{ url = new URL(req.url); }catch(e){ return; }

  const isPage = req.mode === 'navigate'
              || req.destination === 'document'
              || url.pathname === '/'
              || url.pathname.endsWith('.html');

  // ── الصفحة: الشبكة الأول ──
  if(isPage){
    event.respondWith((async () => {
      try{
        const net = await fetch(req, { cache: 'no-store' });
        if(net && net.ok){
          const cache = await caches.open(CACHE);
          cache.put(req, net.clone()).catch(()=>{});
        }
        return net;
      }catch(e){
        // مفيش نت — هات آخر نسخة متكاشة
        return (await caches.match(req))
            || (await caches.match('/'))
            || new Response('مفيش اتصال بالنت، ومفيش نسخة محفوظة.',
                 { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // ── باقي الملفات: الكاش الأول مع تحديث في الخلفية ──
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetching = fetch(req).then(res => {
      if(res && res.status === 200 && res.type === 'basic'){
        caches.open(CACHE).then(c => c.put(req, res.clone()).catch(()=>{}));
      }
      return res;
    }).catch(() => cached);
    return cached || fetching;
  })());
});
