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

  function activateHeroVideo(video) {
    if (!video || video.src) return; // missing, or already activated
    var source = video.getAttribute('data-src');
    if (!source) return;
    video.removeAttribute('data-src');
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

  syncHeroVideo(mql.matches);
  if (mql.addEventListener) {
    mql.addEventListener('change', function (e) { syncHeroVideo(e.matches); });
  } else if (mql.addListener) {
    mql.addListener(function (e) { syncHeroVideo(e.matches); }); // older Safari
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
// Each section plays its reveal once and then STAYS revealed while you
// scroll around the page — it does not reset just because it scrolled out
// of view (that was the original behaviour here, and it's what caused
// sections to silently re-arm and replay every time you scrolled back up
// past them). The only thing that resets all 5 sections back to their
// pre-animation state is scrolling all the way back to the very top of the
// page, handled by the shared listener at the bottom of this file.
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
const sectionResetters = [];
const sectionForceCompleters = [];
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

    function resetFengsui(){

        clearTimers();

        f_left.classList.remove('flyin','flyout');

        const bg = 'images/FENGSHUI.webp';

        f_left.style.backgroundImage = 'none';

        setTimeout(() => {
            f_left.style.backgroundImage = `url(${bg}?t=${Date.now()})`;
        }, 50);

        if(f_description){
            f_description.classList.remove('show');
        }

        animationDone = false;
        animationRunning = false;
    }

    sectionResetters.push(function () {
        if (animationDone || animationRunning) {
            resetFengsui();
        }
    });

    sectionForceCompleters.push({
        section: f_section,
        isDone: () => animationDone,
        complete: completeFengsuiNow
    });

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if(entry.isIntersecting && !animationRunning && !animationDone){
            animationRunning = true;
            fengsuiAnimation();
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

    function resetAmenities(){

        clearTimers();

        a_left.classList.remove('flyin','flyout');

        const bg = 'images/AMENITIES.webp';

        a_left.style.backgroundImage = 'none';

        setTimeout(() => {
            a_left.style.backgroundImage = `url(${bg}?t=${Date.now()})`;
        }, 50);

        if(a_description){
            a_description.classList.remove('show');
        }

        animationDone = false;
        animationRunning = false;
    }

    sectionResetters.push(function () {
        if (animationDone || animationRunning) {
            resetAmenities();
        }
    });

    sectionForceCompleters.push({
        section: a_section,
        isDone: () => animationDone,
        complete: completeAmenitiesNow
    });

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if(entry.isIntersecting && !animationRunning && !animationDone){
            animationRunning = true;
            amenitiesAnimation();
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

    function resetHeritage(){

        clearTimers();
		h_left.classList.remove('flyin','flyout');

		const bg = 'images/HOME.webp';

		h_left.style.backgroundImage = 'none';

		setTimeout(() => {
			h_left.style.backgroundImage = `url(${bg}?t=${Date.now()})`;
		}, 50);

		if(h_description){
			h_description.classList.remove('show');
		}

		animationDone = false;
		animationRunning = false;
    }

    sectionResetters.push(function () {
        if (animationDone || animationRunning) {
            resetHeritage();
        }
    });

    sectionForceCompleters.push({
        section: h_section,
        isDone: () => animationDone,
        complete: completeHeritageNow
    });

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if(entry.isIntersecting && !animationRunning && !animationDone){
            animationRunning = true;
            heritageAnimation();
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

    function resetConnectivity(){

		clearTimers();

		c_left.classList.remove('flyin','flyout');

		const bg = 'images/HUB.webp';

		c_left.style.backgroundImage = 'none';

		setTimeout(() => {
			c_left.style.backgroundImage = `url(${bg}?t=${Date.now()})`;
		}, 50);

		if(c_description){
			c_description.classList.remove('show');
		}

		animationDone = false;
		animationRunning = false;
	}

    sectionResetters.push(function () {
        if (animationDone || animationRunning) {
            resetConnectivity();
        }
    });

    sectionForceCompleters.push({
        section: c_section,
        isDone: () => animationDone,
        complete: completeConnectivityNow
    });

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if (
            entry.isIntersecting &&
            !animationRunning &&
            !animationDone
        ) {
            animationRunning = true;
            connectivityAnimation();
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

    function resetEcology(){
		clearTimers();
		e_left.classList.remove('flyin','flyout');

		const bg = 'images/ECOLOGY.webp';

		e_left.style.backgroundImage = 'none';

		setTimeout(() => {
			e_left.style.backgroundImage = `url(${bg}?t=${Date.now()})`;
		}, 50);

		if(e_description){
			e_description.classList.remove('show');
		}

		animationDone = false;
		animationRunning = false;
	}

    sectionResetters.push(function () {
        if (animationDone || animationRunning) {
            resetEcology();
        }
    });

    sectionForceCompleters.push({
        section: e_section,
        isDone: () => animationDone,
        complete: completeEcologyNow
    });

    const observer = new IntersectionObserver((entries) => {

        const entry = entries[0];

        if(entry.isIntersecting && !animationRunning && !animationDone){
            animationRunning = true;
            ecologyAnimation();
        }

        if(!entry.isIntersecting && animationRunning && !animationDone){
            completeEcologyNow();
        }

    }, {
        threshold:0.2
    });

    observer.observe(e_section);

});

// Shared top-of-page scroll listener: the only thing that resets all 5
// scroll-reveal sections back to their pre-animation state is scrolling all
// the way back up to the very top of the page. We track the top/not-top
// state and only fire the resetters on the transition INTO "at top", so
// resetting doesn't repeatedly fire while the visitor lingers at the top.
(function () {
  let atTop = window.scrollY <= 10;
  window.addEventListener('scroll', function () {
    const isTop = window.scrollY <= 10;
    if (isTop && !atTop) {
      atTop = true;
      sectionResetters.forEach(function (fn) { fn(); });
    } else if (!isTop && atTop) {
      atTop = false;
    }
  }, { passive: true });
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
