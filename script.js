// Bandar Seri Impian II — static rebuild.
//
// Hero background video: only fetch/decode whichever of the two ~35MB hero
// MP4s (desktop / mobile) actually matches the visitor's screen. Both
// <video autoplay> elements are always present in the DOM (CSS just
// toggles which one is display:none at the 768px breakpoint), and a
// hidden autoplay video still gets fetched and decoded by the browser — so
// without this, every visit loads and decodes ~70MB of video instead of the
// ~35MB actually shown. index.html carries the real path in data-src instead
// of src; this picks the matching one, assigns its real src, and starts it.
// If the visitor resizes across the 768px breakpoint, the now-relevant video
// (if it hasn't loaded yet) is activated at that point too.
(function () {
  var mql = window.matchMedia('(max-width: 767px)');
  var desktopVideo = document.querySelector('.hero .bg-video-container video');
  var mobileVideo = document.querySelector('.hero-mobile .bg-video-container video');
  var initialActivationDone = false;

  function activateHeroVideo(video) {
    if (!video || video.src) return; // missing, or already activated
    var source = video.getAttribute('data-src');
    if (!source) return;
    video.removeAttribute('data-src');
    // Tell the browser this fetch can take a back seat to anything else
    // still loading (logo, poster, fonts, CSS) — supported in Chromium,
    // ignored harmlessly elsewhere.
    try { video.fetchPriority = 'low'; } catch (e) {}
    video.src = source;
    video.load();
    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        // Autoplay can be blocked (e.g. low-power mode); the poster stays
        // visible in that case, same as a real autoplay video would.
      });
    }
  }

  function syncHeroVideo(isMobile) {
    activateHeroVideo(isMobile ? mobileVideo : desktopVideo);
  }

  // The hero video (several MB even compressed) must never compete for
  // bandwidth with the page's actual first paint. Starting that fetch the
  // instant script.js runs (right after the DOM is parsed, well before
  // images/fonts have finished) throttles everything else sharing the
  // connection — on a slow mobile link this was pushing the real Largest
  // Contentful Paint element (the hero logo image) out to 20+ seconds,
  // because it was queued behind an in-flight multi-megabyte video
  // download. So the first activation waits for the window's 'load' event
  // (everything else has already been fetched by then), with a short
  // fallback timer in case 'load' itself is unusually slow.
  function startInitialHeroVideo() {
    if (initialActivationDone) return;
    initialActivationDone = true;
    syncHeroVideo(mql.matches);
  }

  if (document.readyState === 'complete') {
    startInitialHeroVideo();
  } else {
    window.addEventListener('load', startInitialHeroVideo);
    setTimeout(startInitialHeroVideo, 4000);
  }

  // A later breakpoint crossing (the visitor resizes after the page has
  // already loaded) can activate the newly-relevant video immediately —
  // there's no more first-paint bandwidth to protect at that point.
  if (mql.addEventListener) {
    mql.addEventListener('change', function (e) {
      if (!initialActivationDone) return;
      syncHeroVideo(e.matches);
    });
  } else if (mql.addListener) {
    mql.addListener(function (e) {
      if (!initialActivationDone) return;
      syncHeroVideo(e.matches);
    }); // older Safari
  }
})();
//
// The 5 feature-section blocks below (Ecology / Connectivity / Home /
// Amenities / Positive Energy) are copied verbatim from the live site's own
// custom <script> tags (not Elementor-generated, not something we wrote) —
// this is the real mechanism: the section's background div starts at
// opacity:0 with the animated WebP already set as its CSS background, and
// once the section is ~20% into view it fades in (".flyin"), waits 7s, then
// reveals the heading/paragraph (".show"). The background image is reset
// with a cache-busting query string so it decodes fresh next time — that
// reset is the live site's own workaround for the browser freezing a
// CSS-background animated WebP on an inconsistent frame, which is exactly
// the "wrong frame / overlapping text" symptom that was reported.
// Only the hardcoded bsi2.com.my URLs have been repointed to the local
// images/ folder.
//
// Each section plays its reveal once per visit and then STAYS revealed — it
// never resets or replays, whether it scrolled out of view or the visitor
// returns to the top of the page. (Resetting meant re-downloading the 6-15MB
// animated file with a cache-busting URL every time, for no real benefit.)
//
// A section is also force-finished the moment it scrolls fully above the
// viewport (its bottom edge passes the top of the screen) — not just when
// its own IntersectionObserver happens to fire a "leaving" event. A fast
// scroll/fling straight to the bottom of the page can carry a section
// past the viewport without ever crossing the observer's visibility
// threshold at all, which used to leave it never-triggered — so scrolling
// back up into it played the full reveal from scratch. The shared listener
// at the bottom of this file walks sectionForceCompleters on every scroll
// and settles anything that's been scrolled past but never finished, so
// every section you've already been below is already in its final state
// by the time you scroll back up to look at it, animation never required.
const sectionForceCompleters = [];

// Lazy loading for the 5 desktop section animations. Each is a 6-15MB
// animated WebP (~47MB together). They used to be plain CSS backgrounds, so
// the browser downloaded all of them the moment the page loaded — even
// though they're far below the fold and invisible (opacity 0) until
// revealed — and that traffic starved the hero poster and logo, pushing
// Largest Contentful Paint out to many seconds on a normal connection. Now
// the CSS only uses `var(--reveal-bg)`; this fills it in:
//   * loadSectionBg() downloads the file, then sets the variable. Each
//     section's reveal waits on it, so the animation never starts on a
//     half-downloaded image.
//   * prefetchSectionBg() starts that download about a screen before the
//     section is reached, but only once the rest of the page has finished
//     loading, so it can never compete with first paint.
// A section that is skipped past entirely never downloads its big file at
// all: it goes straight to its small static final frame.
const sectionBgLoads = new Map();
function loadSectionBg(el, url) {
  if (!sectionBgLoads.has(el)) {
    sectionBgLoads.set(el, new Promise(function (resolve) {
      const img = new Image();
      const done = function () {
        el.style.setProperty('--reveal-bg', 'url("' + url + '")');
        resolve();
      };
      img.onload = done;
      img.onerror = done;
      try { img.fetchPriority = 'low'; } catch (e) {}
      img.src = url;
    }));
  }
  return sectionBgLoads.get(el);
}
function whenStillVisible(el, ms) {
  // Resolves true only if `el` is still on screen after `ms`, so a fast
  // fling past a section doesn't kick off its big download or reveal.
  return new Promise(function (resolve) {
    setTimeout(function () {
      const r = el.getBoundingClientRect();
      resolve(r.bottom > 0 && r.top < window.innerHeight * 0.8);
    }, ms);
  });
}
function prefetchSectionBg(section, el, url) {
  function start() {
    let timer = null;
    const observer = new IntersectionObserver(function (entries) {
      const near = entries.some(function (e) { return e.isIntersecting; });
      clearTimeout(timer);
      if (!near) return;
      // Wait a moment and check the section is still within reach, so a fast
      // fling past it doesn't trigger a 6-15MB download nobody will see.
      timer = setTimeout(function () {
        const rect = section.getBoundingClientRect();
        if (rect.bottom <= 0) { observer.disconnect(); return; } // already passed
        if (rect.top < window.innerHeight * 2) {
          observer.disconnect();
          loadSectionBg(el, url);
        }
      }, 500);
    }, { rootMargin: '0px 0px 100% 0px' });
    observer.observe(section);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
}
document.addEventListener('DOMContentLoaded', function() {

    const f_section = document.querySelector('#id-fengsui');
    const f_left = document.querySelector('.container-left-fengsui');
    const f_description = document.querySelector('.fengsui-description');

    if (!f_section || !f_left) {
        console.log('Heritage elements not found');
        return;
    }

    let animationDone = false;
    let animationRunning = false;
    let timers = [];

    function addTimer(callback, delay){
        const timer = setTimeout(callback, delay);
        timers.push(timer);
    }

    function clearTimers(){
        timers.forEach(timer => clearTimeout(timer));
        timers = [];
    }

    const f_finalBg = 'images/FENGSHUI_final.webp';

    function fengsuiAnimation(){

        f_section.scrollIntoView({
            behavior:'smooth',
            block:'center'
        });

        f_left.classList.add('flyin');

        addTimer(() => {
            f_description?.classList.add('show');
        }, 7000);

        addTimer(() => {
            f_left.style.backgroundImage = `url(${f_finalBg})`;
            animationDone = true;
            animationRunning = false;
        }, 8000);
    }

    // Skip straight to the finished state: used when the section gets
    // scrolled away from before its own 7-9s reveal has finished playing.
    // Rather than leaving the timers to fire later in the background (which
    // is what caused the description text / final frame to visibly "blip"
    // in whenever you happened to scroll back past mid-flight), we settle
    // everything immediately so a returning visitor always sees the fully
    // revealed, static end state — never a half-finished one.
    function completeFengsuiNow(){

        clearTimers();

        f_left.classList.add('flyin');
        f_description?.classList.add('show');
        f_left.style.backgroundImage = `url(${f_finalBg})`;

        animationDone = true;
        animationRunning = false;
    }


    sectionForceCompleters.push({
        section: f_section,
        isDone: () => animationDone,
        complete: completeFengsuiNow
    });

    prefetchSectionBg(f_section, f_left, 'images/FENGSHUI.webp');

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if(entry.isIntersecting && !animationRunning && !animationDone){
            animationRunning = true;
            whenStillVisible(f_section, 350).then(function (ok) {
                if (animationDone) return;
                if (!ok) { animationRunning = false; return; }
                loadSectionBg(f_left, 'images/FENGSHUI.webp').then(() => { if (animationRunning && !animationDone) fengsuiAnimation(); });
            });
        }

        if(!entry.isIntersecting && animationRunning && !animationDone){
            completeFengsuiNow();
        }

    }, {
        threshold:0.2
    });

    observer.observe(f_section);

});

document.addEventListener('DOMContentLoaded', function() {

    const a_section = document.querySelector('#id-amenities');
    const a_left = document.querySelector('.container-left-amenities');
    const a_description = document.querySelector('.amenities-description');

    if (!a_section || !a_left) {
        console.log('Amenities elements not found');
        return;
    }

    let animationDone = false;
    let animationRunning = false;
    let timers = [];

    function addTimer(callback, delay){
        const timer = setTimeout(callback, delay);
        timers.push(timer);
    }

    function clearTimers(){
        timers.forEach(timer => clearTimeout(timer));
        timers = [];
    }

    const a_finalBg = 'images/AMENITIES_final.webp';

    function amenitiesAnimation(){

        a_section.scrollIntoView({
            behavior:'smooth',
            block:'center'
        });

        a_left.classList.add('flyin');

        addTimer(() => {
            a_description?.classList.add('show');
        }, 7000);

        addTimer(() => {
            a_left.style.backgroundImage = `url(${a_finalBg})`;
            animationDone = true;
            animationRunning = false;
        }, 8000);
    }

    // See completeFengsuiNow() above for why this exists.
    function completeAmenitiesNow(){

        clearTimers();

        a_left.classList.add('flyin');
        a_description?.classList.add('show');
        a_left.style.backgroundImage = `url(${a_finalBg})`;

        animationDone = true;
        animationRunning = false;
    }


    sectionForceCompleters.push({
        section: a_section,
        isDone: () => animationDone,
        complete: completeAmenitiesNow
    });

    prefetchSectionBg(a_section, a_left, 'images/AMENITIES.webp');

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if(entry.isIntersecting && !animationRunning && !animationDone){
            animationRunning = true;
            whenStillVisible(a_section, 350).then(function (ok) {
                if (animationDone) return;
                if (!ok) { animationRunning = false; return; }
                loadSectionBg(a_left, 'images/AMENITIES.webp').then(() => { if (animationRunning && !animationDone) amenitiesAnimation(); });
            });
        }

        if(!entry.isIntersecting && animationRunning && !animationDone){
            completeAmenitiesNow();
        }

    }, {
        threshold:0.2
    });

    observer.observe(a_section);

});

document.addEventListener('DOMContentLoaded', function() {

    const h_section = document.querySelector('#id-heritage');
    const h_left = document.querySelector('.container-left-heritage');
    const h_description = document.querySelector('.heritage-description');

    if (!h_section || !h_left ) {
        console.log('Heritage elements not found');
        return;
    }

    let animationDone = false;
    let animationRunning = false;
    let timers = [];

    function addTimer(callback, delay){
        const timer = setTimeout(callback, delay);
        timers.push(timer);
    }

    function clearTimers(){
        timers.forEach(timer => clearTimeout(timer));
        timers = [];
    }

    const h_finalBg = 'images/HOME_final.webp';

    function heritageAnimation(){



        h_section.scrollIntoView({
            behavior:'smooth',
            block:'center'
        });

        h_left.classList.add('flyin');

        addTimer(() => {
			console.log('show description', h_description);
			h_description?.classList.add('show');
		}, 7000);
        addTimer(() => {
            h_left.style.backgroundImage = `url(${h_finalBg})`;
            animationDone = true;
            animationRunning = false;
        }, 8000);
    }

    // See completeFengsuiNow() near the top of this file for why this exists.
    function completeHeritageNow(){

        clearTimers();

        h_left.classList.add('flyin');
        h_description?.classList.add('show');
        h_left.style.backgroundImage = `url(${h_finalBg})`;

        animationDone = true;
        animationRunning = false;
    }


    sectionForceCompleters.push({
        section: h_section,
        isDone: () => animationDone,
        complete: completeHeritageNow
    });

    prefetchSectionBg(h_section, h_left, 'images/HOME.webp');

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if(entry.isIntersecting && !animationRunning && !animationDone){
            animationRunning = true;
            whenStillVisible(h_section, 350).then(function (ok) {
                if (animationDone) return;
                if (!ok) { animationRunning = false; return; }
                loadSectionBg(h_left, 'images/HOME.webp').then(() => { if (animationRunning && !animationDone) heritageAnimation(); });
            });
        }

        if(!entry.isIntersecting && animationRunning && !animationDone){
            completeHeritageNow();
        }

    }, {
        threshold:0.2
    });

    observer.observe(h_section);

});

document.addEventListener('DOMContentLoaded', function() {

    const c_section = document.querySelector('#id-connectivity');
    const c_left = document.querySelector('.container-left-connectivity');
    const c_description = document.querySelector('.connectivity-description');

    if (!c_section || !c_left ) {
        console.log('Connectivity elements not found');
        return;
    }

    let animationDone = false;
    let animationRunning = false;
    let timers = [];

    function addTimer(callback, delay){
        const timer = setTimeout(callback, delay);
        timers.push(timer);
    }

    function clearTimers(){
        timers.forEach(timer => clearTimeout(timer));
        timers = [];
    }

    const c_finalBg = 'images/HUB_final.webp';

    function connectivityAnimation(){

        c_section.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // LEFT BACKGROUND FLY IN
        c_left.classList.add('flyin');


        // SHOW DESCRIPTION
        addTimer(() => {
            c_description?.classList.add('show');
        }, 7000);

        // ANIMATION DONE
        addTimer(() => {
            c_left.style.backgroundImage = `url(${c_finalBg})`;
            animationDone = true;
            animationRunning = false;
        }, 9000);
    }

    // See completeFengsuiNow() near the top of this file for why this exists.
    function completeConnectivityNow(){

        clearTimers();

        c_left.classList.add('flyin');
        c_description?.classList.add('show');
        c_left.style.backgroundImage = `url(${c_finalBg})`;

        animationDone = true;
        animationRunning = false;
    }


    sectionForceCompleters.push({
        section: c_section,
        isDone: () => animationDone,
        complete: completeConnectivityNow
    });

    prefetchSectionBg(c_section, c_left, 'images/HUB.webp');

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if (
            entry.isIntersecting &&
            !animationRunning &&
            !animationDone
        ) {
            animationRunning = true;
            whenStillVisible(c_section, 350).then(function (ok) {
                if (animationDone) return;
                if (!ok) { animationRunning = false; return; }
                loadSectionBg(c_left, 'images/HUB.webp').then(() => { if (animationRunning && !animationDone) connectivityAnimation(); });
            });
        }

        if (
            !entry.isIntersecting &&
            animationRunning &&
            !animationDone
        ) {
            completeConnectivityNow();
        }

    }, {
        threshold: 0.2
    });

    observer.observe(c_section);

});

document.addEventListener('DOMContentLoaded', function() {

    const e_section = document.querySelector('#id-ecology');
    const e_left = document.querySelector('.container-left-ecology');
    const e_description = document.querySelector('.ecology-description');

    if (!e_section || !e_left ) {
        console.log('Ecology elements not found');
        return;
    }

    let animationDone = false;
    let animationRunning = false;
    let timers = [];

    function addTimer(callback, delay){
        const timer = setTimeout(callback, delay);
        timers.push(timer);
    }

    function clearTimers(){
        timers.forEach(timer => clearTimeout(timer));
        timers = [];
    }

    const e_finalBg = 'images/ECOLOGY_final.webp';

    function ecologyAnimation(){

        e_section.scrollIntoView({
            behavior:'smooth',
            block:'center'
        });

        e_left.classList.add('flyin');


        addTimer(() => {
            e_description?.classList.add('show');
        }, 7000);

        addTimer(() => {
            e_left.style.backgroundImage = `url(${e_finalBg})`;
            animationDone = true;
            animationRunning = false;
			console.log("animation done");
        }, 8000);
    }

    // See completeFengsuiNow() near the top of this file for why this exists.
    function completeEcologyNow(){

        clearTimers();

        e_left.classList.add('flyin');
        e_description?.classList.add('show');
        e_left.style.backgroundImage = `url(${e_finalBg})`;

        animationDone = true;
        animationRunning = false;
    }


    sectionForceCompleters.push({
        section: e_section,
        isDone: () => animationDone,
        complete: completeEcologyNow
    });

    prefetchSectionBg(e_section, e_left, 'images/ECOLOGY.webp');

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if(entry.isIntersecting && !animationRunning && !animationDone){
            animationRunning = true;
            whenStillVisible(e_section, 350).then(function (ok) {
                if (animationDone) return;
                if (!ok) { animationRunning = false; return; }
                loadSectionBg(e_left, 'images/ECOLOGY.webp').then(() => { if (animationRunning && !animationDone) ecologyAnimation(); });
            });
        }

        if(!entry.isIntersecting && animationRunning && !animationDone){
            completeEcologyNow();
        }

    }, {
        threshold:0.2
    });

    observer.observe(e_section);

});

// Mobile section photos (ecology / connectivity / heritage / amenities /
// fengshui). On phones each section's photo is a plain <img> of a ~1.5MB
// animated WebP that plays its "Green Habitat, Close at Heart" style text
// reveal once. As a bare <img> the browser alone decides when that animation
// runs, so on a fast scroll it plays (or sits half-finished) while off
// screen, and scrolling back up showed a half-revealed or blank photo —
// the same complaint the desktop sections had. These get the same
// treatment as the desktop sections:
//   * pending  — shows a black frame (the animation's own first frame) and
//                downloads nothing heavy until the photo is nearly on screen
//   * playing  — the animated WebP is swapped in once the photo is properly
//                visible and plays its reveal
//   * done     — a static copy of the finished frame (pixel-identical to
//                the end of the animation, ~30-50KB instead of ~1.5MB)
// A photo that is scrolled past, or scrolled out of view mid-reveal, jumps
// straight to "done" so scrolling back up always shows the finished
// artwork, never a replay. Like the desktop sections, each photo plays
// once per visit and never resets.
(function () {
  const BLACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='700' height='393'>" +
    "<rect width='100%' height='100%' fill='black'/></svg>");
  // The animation runs ~3.5-4s once displayed; this is how long after the
  // animated file finishes loading we wait before locking in the static copy.
  const PLAY_MS = 5000;
  const items = [
    { sel: '.ecology-mobile-bg img',      anim: 'images/ECOLOGY_mobile-1.webp',      done: 'images/ECOLOGY_mobile_final.webp' },
    { sel: '.connectivity-mobile-bg img', anim: 'images/HUB-mobile-v2.webp',         done: 'images/HUB_mobile_final.webp' },
    { sel: '.heritage-mobile-bg img',     anim: 'images/HOME_mobile-1.webp',         done: 'images/HOME_mobile_final.webp' },
    { sel: '.amenities-mobile-bg img',    anim: 'images/AMENITIES_mobile-1.webp',    done: 'images/AMENITIES_mobile_final.webp' },
    { sel: '.fengshui-mobile-bg img',     anim: 'images/FENGSHUI-mobile-new.webp',   done: 'images/FENGSHUI_mobile_final.webp' }
  ];

  items.forEach(function (it) {
    const img = document.querySelector(it.sel);
    if (!img) return;

    let state = 'pending';   // 'pending' | 'playing' | 'done'
    let timer = null;
    let warmed = false;

    function isHidden() { return !img.getClientRects().length; }

    // Quietly pull the animated file into the HTTP cache shortly before the
    // photo is needed, so the reveal starts the moment it scrolls into view
    // instead of waiting on a 1.5MB download.
    function warm() {
      if (warmed) return;
      warmed = true;
      try { fetch(it.anim); } catch (e) {}
    }

    function showFinal() {
      clearTimeout(timer);
      state = 'done';
      // Assign the new src first: flipping to eager while the old (heavy)
      // animated file is still the src would start downloading it.
      img.src = it.done;
      img.loading = 'eager';
    }

    function play() {
      state = 'playing';
      img.loading = 'eager';
      // Pre-decode the static copy so the swap at the end has no flash.
      const finalImg = new Image();
      finalImg.src = it.done;
      img.addEventListener('load', function onLoad() {
        // Only react to the animated file's load, not the black/final swaps.
        if (state !== 'playing' || img.currentSrc.indexOf(it.anim) === -1) return;
        img.removeEventListener('load', onLoad);
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (state === 'playing') showFinal();
        }, PLAY_MS);
      });
      img.src = it.anim;
    }

    function reset() {
      clearTimeout(timer);
      state = 'pending';
      img.src = BLACK;
    }

    // Initial state: a photo that is already above the viewport (page was
    // reloaded part-way down) is simply done; anything else waits, black.
    if (!isHidden() && img.getBoundingClientRect().bottom <= 0) {
      showFinal();
    } else {
      reset();
    }

    new IntersectionObserver(function (entries) {
      const entry = entries[entries.length - 1];
      if (state === 'pending') {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) play();
      } else if (state === 'playing') {
        if (!entry.isIntersecting) showFinal();
      }
    }, { threshold: [0, 0.3] }).observe(img);

    // Approaching from below: start fetching a screen or so ahead.
    new IntersectionObserver(function (entries) {
      if (entries[entries.length - 1].isIntersecting) warm();
    }, { rootMargin: '0px 0px 100% 0px' }).observe(img);

    sectionForceCompleters.push({
      section: img,
      isDone: function () { return state === 'done'; },
      complete: function () { if (!isHidden()) showFinal(); }
    });
  });
})();

// Shared "already scrolled past it" listener: a section is force-finished
// the moment its bottom edge scrolls above the top of the viewport, even if
// its own IntersectionObserver never got a chance to fire (a fast scroll or
// fling straight to the bottom of the page can carry a section past the
// screen without ever rendering a frame where it crosses the observer's
// visibility threshold). Without this, a section skipped over that way was
// still "unstarted" as far as its own code knew, so scrolling back up into
// it later played the full reveal from scratch — exactly the "I have to
// watch the animation" complaint. Checking on every scroll, rather than
// only via IntersectionObserver, catches that case too.
(function () {
  window.addEventListener('scroll', function () {
    sectionForceCompleters.forEach(function (entry) {
      if (entry.isDone()) return;
      var rect = entry.section.getBoundingClientRect();
      if (rect.bottom <= 0) {
        entry.complete();
      }
    });
  }, { passive: true });
})();

// Registration form — the real site renders this client-side via WPForms,
// which isn't part of the static page markup we ported, so this is a
// hand-built replacement (same visual style) rather than a port. Cloudflare
// Pages Function + D1 + email notification are intentionally NOT wired up
// yet (deferred per plan) — this just gives local visual feedback.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registration-form");
  const feedback = document.getElementById("form-feedback");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const data = {
      full_name: form.full_name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      consent_marketing: form.consent_marketing.checked,
      consent_pdpa: form.consent_pdpa.checked,
      submitted_at: new Date().toISOString(),
    };

    // TEMP: no backend yet. Once Cloudflare Pages + D1 + email are set up,
    // this becomes: fetch('/api/register', { method: 'POST', body: JSON.stringify(data) })
    console.log("[registration-form] submission (local preview only):", data);

    feedback.textContent = "Thanks! (Local preview only — this isn't saved anywhere yet.)";
    form.reset();
  });
});
