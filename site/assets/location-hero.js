(() => {
  const hero = document.querySelector('.hp-hero');
  if (!hero) return;

  const stage = hero.querySelector('.film-stage');
  const background = stage.querySelector('video');
  const poster = stage.querySelector('picture img');
  const posterSource = stage.querySelector('picture source');
  const openingWide = poster.getAttribute('src');
  const openingTall = posterSource.getAttribute('srcset');
  const toggle = stage.querySelector('[data-background-toggle]');
  const portrait = matchMedia(posterSource.media);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reducedData = matchMedia('(prefers-reduced-data: reduce)');
  const connection = navigator.connection;
  const signatureStart = Number(background.dataset.signatureStart);
  const outroStart = Number(background.dataset.outroStart);

  let userChoice = null;
  let finished = false;
  let savingData = Boolean(connection?.saveData);
  let inView = stage.getBoundingClientRect().bottom > 0;
  let request = 0;
  let starting = false;
  let resumeAt = 0;

  function wantsPlayback() {
    return !finished && (userChoice ?? !(reducedMotion.matches || reducedData.matches || connection?.saveData));
  }

  function updateToggle() {
    const playing = wantsPlayback();
    const label = finished ? '背景動画をもう一度再生' : playing ? '背景動画を一時停止' : '背景動画を再生';
    toggle.toggleAttribute('data-running', playing);
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }

  function updateFrame() {
    const time = background.currentTime;
    const showingSignature = background.classList.contains('has-frame') && time >= signatureStart;
    stage.classList.toggle('has-signature', finished || showingSignature);
    stage.classList.toggle('has-outro', finished || (background.classList.contains('has-frame') && time >= outroStart));
    if (background.duration > 0) {
      toggle.style.setProperty('--film-remaining', String(finished ? 0 : 100 * (1 - time / background.duration)));
    }
  }

  function pauseBackground() {
    request += 1;
    starting = false;
    background.pause();
  }

  function resetBackground() {
    pauseBackground();
    stage.classList.remove('has-signature', 'has-outro');
    background.classList.remove('has-frame');
    toggle.style.removeProperty('--film-remaining');
    if (background.hasAttribute('src')) {
      background.removeAttribute('src');
      background.load();
    }
  }

  function showEnding() {
    if (finished) return;
    finished = true;
    // Keep the decoded last video frame on top until its responsive still is ready.
    posterSource.srcset = posterSource.dataset.endSrcset;
    poster.src = poster.dataset.endSrc;
    updateFrame();
    updateToggle();
  }

  poster.addEventListener('load', async () => {
    if (!finished) return;
    const source = poster.currentSrc;
    try {
      if (poster.decode) await poster.decode();
    } catch {
      return;
    }
    if (finished && poster.currentSrc === source) background.classList.remove('has-frame');
  });

  function syncBackground() {
    if (background.ended && !finished) showEnding();
    updateToggle();
    if (finished) return;
    if (document.hidden || !inView || !wantsPlayback()) {
      pauseBackground();
      return;
    }
    const source = portrait.matches ? background.dataset.tallSrc : background.dataset.wideSrc;
    if (background.getAttribute('src') !== source) {
      resumeAt = background.currentTime || resumeAt;
      resetBackground();
      background.muted = true;
      background.src = source;
    }
    if (starting || !background.paused) return;
    const currentRequest = ++request;
    starting = true;
    background.play().catch(() => {
      if (request === currentRequest) {
        userChoice = false;
        updateToggle();
      }
    }).finally(() => {
      if (request === currentRequest) starting = false;
    });
  }

  function applyPreferences() {
    if (finished) return;
    userChoice = null;
    if (!wantsPlayback()) {
      resumeAt = 0;
      resetBackground();
    }
    syncBackground();
  }

  background.addEventListener('loadedmetadata', () => {
    if (resumeAt > 0) {
      background.currentTime = Math.min(resumeAt, background.duration);
      resumeAt = 0;
    }
  });
  background.addEventListener('playing', () => {
    const source = background.currentSrc;
    const show = () => {
      if (finished || source !== background.currentSrc || !background.hasAttribute('src')) return;
      background.classList.add('has-frame');
      updateFrame();
    };
    if (background.requestVideoFrameCallback) background.requestVideoFrameCallback(show);
    else show();
  });
  background.addEventListener('timeupdate', updateFrame);
  background.addEventListener('seeked', updateFrame);
  background.addEventListener('ended', () => {
    if (background.ended) showEnding();
  });
  background.addEventListener('error', () => {
    if (finished || !background.error || !background.hasAttribute('src')) return;
    userChoice = false;
    resumeAt = 0;
    resetBackground();
    updateToggle();
  });
  toggle.addEventListener('click', () => {
    if (finished) {
      finished = false;
      resumeAt = 0;
      resetBackground();
      posterSource.srcset = openingTall;
      poster.src = openingWide;
      userChoice = true;
    } else {
      userChoice = !wantsPlayback();
    }
    syncBackground();
  });
  portrait.addEventListener('change', syncBackground);
  reducedMotion.addEventListener('change', applyPreferences);
  reducedData.addEventListener('change', applyPreferences);
  connection?.addEventListener('change', () => {
    if (Boolean(connection.saveData) === savingData) return;
    savingData = Boolean(connection.saveData);
    applyPreferences();
  });
  document.addEventListener('visibilitychange', syncBackground);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncBackground();
    }).observe(stage);
  }
  toggle.hidden = false;
  syncBackground();
})();
