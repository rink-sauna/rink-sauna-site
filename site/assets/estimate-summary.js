(() => {
  const layout = document.querySelector('[data-estimator]');
  if (!layout) return;
  const controls = layout.querySelector('.estimate-controls');
  const summary = layout.querySelector('.estimate-summary');
  const pathway = document.querySelector('.pathway');
  const columns = matchMedia('(min-width: 801px)');
  let frame = 0;
  let isVisible = true;

  // As the last choices approach the header, use the remaining form height
  // for the right column so its total stays in sight until the form ends.
  function fitSummary() {
    frame = 0;
    if (pathway) {
      const height = pathway.offsetHeight + 'px';
      if (layout.style.getPropertyValue('--estimate-pathway-height') !== height) {
        layout.style.setProperty('--estimate-pathway-height', height);
      }
    }
    const bottom = Math.floor(controls.getBoundingClientRect().bottom);
    const value = bottom > 0 && bottom < innerHeight ? bottom + 'px' : '';
    if (summary.style.getPropertyValue('--estimate-controls-bottom') !== value) {
      summary.style.setProperty('--estimate-controls-bottom', value);
    }
  }

  function schedule() {
    if (columns.matches && isVisible && !frame) frame = requestAnimationFrame(fitSummary);
  }

  function switchLayout() {
    if (columns.matches) {
      summary.tabIndex = 0;
      fitSummary();
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      summary.removeAttribute('tabindex');
      summary.style.removeProperty('--estimate-controls-bottom');
      layout.style.removeProperty('--estimate-pathway-height');
    }
  }

  // Keep page-navigation keys inside the focused summary. A focused checkbox,
  // link or text field keeps its own keyboard behavior.
  summary.addEventListener('keydown', event => {
    if (!columns.matches || event.target !== summary || event.altKey || event.ctrlKey || event.metaKey) return;
    const offset = {
      Home: -summary.scrollHeight, End: summary.scrollHeight,
      PageUp: -summary.clientHeight * .8, PageDown: summary.clientHeight * .8
    }[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    summary.scrollTop += offset;
  });

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  columns.addEventListener('change', switchLayout);
  if (window.ResizeObserver) {
    const size = new ResizeObserver(schedule);
    size.observe(controls);
    if (pathway) size.observe(pathway);
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) schedule();
    }).observe(layout);
  }
  switchLayout();
})();

(() => {
  const estimator = document.querySelector('[data-estimator]');
  if (!estimator || typeof HTMLDialogElement === 'undefined' ||
      typeof HTMLDialogElement.prototype.showModal !== 'function') return;

  const narrow = matchMedia('(max-width: 800px)');
  const controls = estimator.querySelector('.estimate-controls');
  const summary = estimator.querySelector('.estimate-summary');
  const amount = summary.querySelector('[data-estimate-range-total]');
  const label = summary.querySelector('[data-estimate-total-label]');
  const pathway = document.querySelector('main > .pathway');
  if (pathway) {
    const fitBelowBreadcrumb = () => controls.style.setProperty('--estimate-trail-height', pathway.offsetHeight + 'px');
    fitBelowBreadcrumb();
    if ('ResizeObserver' in window) new ResizeObserver(fitBelowBreadcrumb).observe(pathway);
  }
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'estimate-mobile-balance';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.innerHTML = '<span><small></small><strong></strong></span><span class="estimate-mobile-link">内訳を見る <span aria-hidden="true">›</span></span>';
  controls.prepend(trigger);

  const panel = document.createElement('dialog');
  panel.className = 'estimate-mobile-sheet';
  panel.id = 'estimate-mobile-breakdown';
  panel.setAttribute('aria-labelledby', 'estimate-mobile-breakdown-title');
  trigger.setAttribute('aria-controls', panel.id);
  panel.innerHTML = '<header><h2 id="estimate-mobile-breakdown-title">見積もりの内訳</h2>' +
    '<button type="button" autofocus>閉じる</button></header><div class="estimate-mobile-sheet-body">' +
    '<p class="estimate-mobile-sheet-total"><span></span><strong></strong></p>' +
    '<dl class="estimate-breakdown"></dl><p class="estimate-mobile-missing"></p>' +
    '<p class="estimate-mobile-terms"></p></div>';
  estimator.append(panel);

  function renderBreakdown() {
    const rows = Array.from(summary.querySelector('[data-estimate-lines]').children, row => row.cloneNode(true));
    for (const item of summary.querySelectorAll('.estimate-tax-row')) {
      const row = document.createElement('div');
      const key = document.createElement('dt');
      const value = document.createElement('dd');
      key.textContent = item.firstElementChild.textContent;
      value.textContent = item.lastElementChild.textContent;
      row.append(key, value);
      rows.push(row);
    }
    panel.querySelector('dl').replaceChildren(...rows);
    panel.querySelector('.estimate-mobile-sheet-total span').textContent = label.textContent;
    panel.querySelector('.estimate-mobile-sheet-total strong').textContent = amount.textContent;
    panel.querySelector('.estimate-mobile-missing').textContent = summary.querySelector('[data-estimate-missing]').textContent;
    panel.querySelector('.estimate-mobile-terms').textContent = summary.querySelector('.estimate-conditions-note').textContent;
  }

  function refreshAmount() {
    trigger.querySelector('small').textContent = label.textContent;
    trigger.querySelector('strong').textContent = amount.textContent;
    if (panel.open) renderBreakdown();
  }
  const observer = new MutationObserver(refreshAmount);
  observer.observe(amount, { childList: true, subtree: true, characterData: true });
  observer.observe(label, { childList: true, subtree: true, characterData: true });
  refreshAmount();

  let openingScroll;
  trigger.addEventListener('click', () => {
    openingScroll = { left: window.scrollX, top: window.scrollY };
    renderBreakdown();
    panel.showModal();
    panel.querySelector('.estimate-mobile-sheet-body').scrollTop = 0;
  });
  panel.querySelector('button').addEventListener('click', () => panel.close());
  panel.addEventListener('close', () => {
    if (narrow.matches) {
      trigger.focus({ preventScroll: true });
      if (openingScroll) window.scrollTo({ ...openingScroll, behavior: 'instant' });
    }
  });
  narrow.addEventListener('change', () => {
    if (!narrow.matches && panel.open) panel.close();
  });
})();
