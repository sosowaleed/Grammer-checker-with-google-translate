import {
  UserSettings,
  DEFAULT_SETTINGS,
  CheckTextResponse,
  SynonymsResponse,
  GrammarCorrection
} from '../shared/types';
import { SUPPORTED_LANGUAGES, POPULAR_LANGUAGES } from '../shared/languages';
import { KeepAliveManager } from '../shared/messaging';
import { getAvailableUiLanguages, applyTranslations, t } from '../shared/l10n';

function sendPopupMessage<T = any>(message: any): Promise<T> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message } as any);
          } else {
            resolve(response);
          }
        });
        return;
      }
      if (typeof (window as any).browser !== 'undefined' && (window as any).browser?.runtime?.sendMessage) {
        (window as any).browser.runtime.sendMessage(message).then(resolve).catch((err: any) => {
          resolve({ error: err?.message } as any);
        });
        return;
      }
      resolve({ error: 'Runtime unavailable' } as any);
    } catch (err: any) {
      resolve({ error: err?.message } as any);
    }
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setElementHtml(target: HTMLElement, html: string): void {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  target.replaceChildren(...Array.from(doc.body.childNodes));
}

function buildCorrectedSentence(
  originalText: string,
  corrections: GrammarCorrection[]
): { correctedText: string; htmlHighlighted: string } {
  if (!corrections || corrections.length === 0) {
    return {
      correctedText: originalText,
      htmlHighlighted: escapeHtml(originalText)
    };
  }

  const sorted = [...corrections].sort((a, b) => a.offset - b.offset);
  let correctedText = '';
  let htmlHighlighted = '';
  let lastIndex = 0;

  for (const corr of sorted) {
    if (corr.offset < lastIndex) continue;
    const before = originalText.substring(lastIndex, corr.offset);
    correctedText += before + corr.corrected;
    htmlHighlighted +=
      escapeHtml(before) +
      `<span class="polyglot-diff-highlight">${escapeHtml(corr.corrected)}</span>`;
    lastIndex = corr.offset + corr.length;
  }

  if (lastIndex < originalText.length) {
    const after = originalText.substring(lastIndex);
    correctedText += after;
    htmlHighlighted += escapeHtml(after);
  }

  return { correctedText, htmlHighlighted };
}

document.addEventListener('DOMContentLoaded', async () => {
  const masterToggle = document.getElementById('masterToggle') as HTMLInputElement;
  const grammarToggle = document.getElementById('grammarToggle') as HTMLInputElement;
  const autoPopupHighlightToggle = document.getElementById('autoPopupHighlightToggle') as HTMLInputElement;
  const autoPopupHoverToggle = document.getElementById('autoPopupHoverToggle') as HTMLInputElement;
  const uiLanguageSelect = document.getElementById('uiLanguageSelect') as HTMLSelectElement;
  const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
  const statusPill = document.getElementById('statusPill') as HTMLElement;
  const statusText = document.getElementById('statusText') as HTMLElement;
  const statWords = document.getElementById('statWords') as HTMLElement;
  const statCorrections = document.getElementById('statCorrections') as HTMLElement;
  const statTranslations = document.getElementById('statTranslations') as HTMLElement;
  const domainsList = document.getElementById('domainsList') as HTMLElement;
  const domainInput = document.getElementById('domainInput') as HTMLInputElement;
  const addDomainBtn = document.getElementById('addDomainBtn') as HTMLButtonElement;
  const wordsList = document.getElementById('wordsList') as HTMLElement;
  const wordInput = document.getElementById('wordInput') as HTMLInputElement;
  const addWordBtn = document.getElementById('addWordBtn') as HTMLButtonElement;
  const playgroundText = document.getElementById('playgroundText') as HTMLTextAreaElement;
  const playgroundPill = document.getElementById('playgroundPill') as HTMLElement;
  const playgroundPillDot = document.getElementById('playgroundPillDot') as HTMLElement;
  const playgroundPillText = document.getElementById('playgroundPillText') as HTMLElement;
  const playgroundPopover = document.getElementById('playgroundPopover') as HTMLElement;
  const playgroundPopoverBody = document.getElementById('playgroundPopoverBody') as HTMLElement;
  const playgroundPopoverClose = document.getElementById('playgroundPopoverClose') as HTMLButtonElement;
  const playgroundIssues = document.getElementById('playgroundIssues') as HTMLElement;
  const loadSample = document.getElementById('loadSample') as HTMLElement;

  // Populate UI Languages
  const uiLanguages = getAvailableUiLanguages();
  uiLanguageSelect.replaceChildren(
    ...uiLanguages.map((l) => {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = `${l.nativeName} (${l.name})`;
      return opt;
    })
  );

  // Populate Target Languages
  const popularGroup = document.createElement('optgroup');
  popularGroup.label = 'Popular Languages';
  for (const code of POPULAR_LANGUAGES) {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    if (lang) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = `${lang.name} (${lang.nativeName})`;
      popularGroup.appendChild(opt);
    }
  }
  const allGroup = document.createElement('optgroup');
  allGroup.label = 'All Supported Languages';
  for (const lang of SUPPORTED_LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = lang.name;
    allGroup.appendChild(opt);
  }
  languageSelect.replaceChildren(popularGroup, allGroup);

  // Fetch current settings
  let settings: UserSettings;
  try {
    const fetched = await sendPopupMessage<UserSettings>({ type: 'GET_SETTINGS' });
    settings = fetched && fetched.enabled !== undefined ? { ...DEFAULT_SETTINGS, ...fetched } : { ...DEFAULT_SETTINGS };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  // Apply UI translations based on saved language
  function applyCurrentTranslations() {
    const lang = settings.uiLanguage || 'en';
    applyTranslations(lang);
  }

  // Update UI elements with settings
  function updateUI() {
    masterToggle.checked = settings.enabled;
    grammarToggle.checked = settings.autoCheckGrammar;
    autoPopupHighlightToggle.checked = Boolean(settings.autoPopupOnHighlight);
    autoPopupHoverToggle.checked = settings.autoPopupOnHover !== false;
    uiLanguageSelect.value = settings.uiLanguage || 'en';
    languageSelect.value = settings.preferredLanguage || 'en';

    applyCurrentTranslations();

    if (settings.enabled) {
      statusPill.classList.remove('disabled');
      statusText.textContent = t('status_active', settings.uiLanguage);
    } else {
      statusPill.classList.add('disabled');
      statusText.textContent = t('status_disabled', settings.uiLanguage);
    }

    statWords.textContent = (settings.stats?.wordsChecked || 0).toLocaleString();
    statCorrections.textContent = (settings.stats?.correctionsAccepted || 0).toLocaleString();
    statTranslations.textContent = (settings.stats?.translationsPerformed || 0).toLocaleString();

    renderDomains();
    renderWords();
  }

  function renderDomains() {
    domainsList.replaceChildren();
    if (!settings.ignoredDomains || settings.ignoredDomains.length === 0) {
      const emptySpan = document.createElement('span');
      emptySpan.style.color = '#64748b';
      emptySpan.style.fontSize = '11px';
      emptySpan.textContent = t('ignored_domains_none', settings.uiLanguage);
      domainsList.appendChild(emptySpan);
      return;
    }

    settings.ignoredDomains.forEach((domain) => {
      const tag = document.createElement('div');
      tag.className = 'domain-tag';

      const label = document.createElement('span');
      label.textContent = domain;

      const delBtn = document.createElement('span');
      delBtn.className = 'del-btn';
      delBtn.textContent = '×';
      delBtn.setAttribute('data-domain', domain);

      delBtn.addEventListener('click', async () => {
        settings.ignoredDomains = settings.ignoredDomains.filter((d) => d !== domain);
        await saveSettings();
        renderDomains();
      });

      tag.append(label, delBtn);
      domainsList.appendChild(tag);
    });
  }

  function renderWords() {
    if (!wordsList) return;
    wordsList.replaceChildren();
    if (!settings.ignoredWords || settings.ignoredWords.length === 0) {
      const emptySpan = document.createElement('span');
      emptySpan.style.color = '#64748b';
      emptySpan.style.fontSize = '11px';
      emptySpan.textContent = t('ignored_words_none', settings.uiLanguage);
      wordsList.appendChild(emptySpan);
      return;
    }

    settings.ignoredWords.forEach((word) => {
      const tag = document.createElement('div');
      tag.className = 'domain-tag';

      const label = document.createElement('span');
      label.textContent = word;

      const delBtn = document.createElement('span');
      delBtn.className = 'del-btn';
      delBtn.textContent = '×';
      delBtn.setAttribute('data-word', word);

      delBtn.addEventListener('click', async () => {
        settings.ignoredWords = settings.ignoredWords.filter((w) => w.toLowerCase() !== word.toLowerCase());
        await sendPopupMessage({ type: 'UNIGNORE_WORD', word });
        await saveSettings();
        renderWords();
      });

      tag.append(label, delBtn);
      wordsList.appendChild(tag);
    });
  }

  async function saveSettings() {
    try {
      const updated = await sendPopupMessage<UserSettings>({
        type: 'UPDATE_SETTINGS',
        settings
      });
      if (updated && updated.enabled !== undefined) {
        settings = { ...settings, ...updated };
      }
      updateUI();
    } catch {
      // ignore
    }
  }

  // Switch Event Listeners
  masterToggle.addEventListener('change', async () => {
    settings.enabled = masterToggle.checked;
    await saveSettings();
  });

  grammarToggle.addEventListener('change', async () => {
    settings.autoCheckGrammar = grammarToggle.checked;
    await saveSettings();
  });

  autoPopupHighlightToggle.addEventListener('change', async () => {
    settings.autoPopupOnHighlight = autoPopupHighlightToggle.checked;
    await saveSettings();
  });

  autoPopupHoverToggle.addEventListener('change', async () => {
    settings.autoPopupOnHover = autoPopupHoverToggle.checked;
    await saveSettings();
  });

  // UI Language Switcher (dynamic runtime standard)
  uiLanguageSelect.addEventListener('change', async () => {
    settings.uiLanguage = uiLanguageSelect.value;
    await saveSettings();
    applyCurrentTranslations();
    checkPlaygroundLive();
  });

  languageSelect.addEventListener('change', async () => {
    settings.preferredLanguage = languageSelect.value;
    await saveSettings();
    checkPlaygroundLive();
  });

  addDomainBtn.addEventListener('click', async () => {
    const val = domainInput.value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (val && !settings.ignoredDomains.includes(val)) {
      settings.ignoredDomains.push(val);
      domainInput.value = '';
      await saveSettings();
    }
  });

  domainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addDomainBtn.click();
    }
  });

  addWordBtn?.addEventListener('click', async () => {
    const val = wordInput.value.trim().toLowerCase();
    if (val && !settings.ignoredWords.map((w) => w.toLowerCase()).includes(val)) {
      settings.ignoredWords.push(val);
      wordInput.value = '';
      await sendPopupMessage({ type: 'IGNORE_WORD', word: val });
      await saveSettings();
      renderWords();
    }
  });

  wordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addWordBtn.click();
    }
  });

  // Playground sample cycling
  let sampleIndex = 0;
  const samples = [
    {
      text: 'This is a exampel of speling eror and bad grammer.',
      labelKey: 'load_sample_es' as const
    },
    {
      text: 'yo tengo un perro amariyo y quiero comer una pome.',
      labelKey: 'load_sample_de' as const
    },
    {
      text: 'Ich habe ein feler gemacht und bin muede.',
      labelKey: 'load_sample_fr' as const
    },
    {
      text: 'Je suis alle au cinema et je mange une pome.',
      labelKey: 'load_sample_en' as const
    }
  ];

  loadSample.addEventListener('click', () => {
    sampleIndex = (sampleIndex + 1) % samples.length;
    const sample = samples[sampleIndex];
    playgroundText.value = sample.text;
    playgroundText.dispatchEvent(new Event('input', { bubbles: true }));
    const nextIdx = (sampleIndex + 1) % samples.length;
    loadSample.textContent = t(samples[nextIdx].labelKey, settings.uiLanguage);
  });

  // ----------------------------------------------------
  // Interactive Playground Live Engine with Floating Pill
  // ----------------------------------------------------
  KeepAliveManager.activate();

  let playgroundDebounce: ReturnType<typeof setTimeout> | null = null;
  let activeCorrections: GrammarCorrection[] = [];

  function renderPlaygroundFixChips(corrections: GrammarCorrection[]): void {
    if (!playgroundIssues) return;
    playgroundIssues.replaceChildren();

    corrections.forEach((c) => {
      const chip = document.createElement('div');
      chip.className = 'fix-chip';
      chip.title = `Click to replace "${c.original}" with "${c.corrected}"`;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'fix-icon');
      svg.setAttribute('viewBox', '0 0 20 20');
      svg.setAttribute('fill', 'currentColor');
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '12');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('clip-rule', 'evenodd');
      path.setAttribute('d', 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z');
      svg.appendChild(path);

      const origSpan = document.createElement('span');
      origSpan.textContent = c.original;

      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'fix-arrow';
      arrowSpan.textContent = '→';

      const targetSpan = document.createElement('span');
      targetSpan.className = 'fix-target';
      targetSpan.textContent = c.corrected;

      chip.append(svg, origSpan, arrowSpan, targetSpan);

      chip.addEventListener('click', async () => {
        applySingleCorrection(c);
      });

      playgroundIssues.appendChild(chip);
    });
  }

  async function applySingleCorrection(c: GrammarCorrection): Promise<void> {
    const val = playgroundText.value;
    const regex = new RegExp(`\\b${escapeRegExp(c.original)}\\b`, 'i');
    if (regex.test(val)) {
      playgroundText.value = val.replace(regex, c.corrected);
    } else {
      playgroundText.value = val.replace(c.original, c.corrected);
    }

    // Record stat
    await sendPopupMessage({ type: 'RECORD_STAT', stat: 'correctionsAccepted', count: 1 });
    const currentCount = parseInt(statCorrections?.textContent?.replace(/,/g, '') || '0') + 1;
    if (statCorrections) {
      statCorrections.textContent = currentCount.toLocaleString();
    }

    checkPlaygroundLive();
  }

  function renderPlaygroundPopover(): void {
    if (!playgroundPopoverBody) return;

    if (activeCorrections.length === 0) {
      setElementHtml(
        playgroundPopoverBody,
        `
        <div style="text-align: center; padding: 14px 10px; color: #94a3b8; font-size: 12px;">
          <div style="font-size: 18px; margin-bottom: 4px;">✨</div>
          <div style="color: #6ee7b7; font-weight: 600;">${t('playground_clean', settings.uiLanguage)}</div>
          <div style="font-size: 11px; margin-top: 2px;">The text looks grammatically correct!</div>
        </div>
      `
      );
      return;
    }

    const { correctedText, htmlHighlighted } = buildCorrectedSentence(
      playgroundText.value,
      activeCorrections
    );

    setElementHtml(
      playgroundPopoverBody,
      `
      <div class="playground-sentence-box">
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">${t('showing_correction_for', settings.uiLanguage)}</div>
        <div style="color: #f8fafc; font-size: 12px; margin-bottom: 8px;">${htmlHighlighted}</div>
        <div class="popover-actions">
          <button class="btn-apply-all" id="btnApplyAllPlayground">
            ✓ ${t('btn_apply_correction', settings.uiLanguage)}
          </button>
        </div>
      </div>
      <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">
        ${activeCorrections.length} ${t('playground_issues', settings.uiLanguage)}
      </div>
      <div style="display: flex; flex-direction: column; gap: 5px; max-height: 120px; overflow-y: auto;">
        ${activeCorrections
          .map(
            (c, idx) => `
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); padding: 4px 8px; border-radius: 6px;">
            <span style="color: #fda4af; text-decoration: line-through; font-size: 11.5px;">${escapeHtml(c.original)}</span>
            <span style="color: #64748b; font-size: 10px;">→</span>
            <button class="btn-apply-all" style="padding: 2px 8px; font-size: 10.5px;" data-fix-index="${idx}">
              ${escapeHtml(c.corrected)}
            </button>
          </div>
        `
          )
          .join('')}
      </div>
    `
    );

    // Apply full sentence button
    const applyAllBtn = playgroundPopoverBody.querySelector('#btnApplyAllPlayground');
    applyAllBtn?.addEventListener('click', async () => {
      playgroundText.value = correctedText;
      await sendPopupMessage({
        type: 'RECORD_STAT',
        stat: 'correctionsAccepted',
        count: activeCorrections.length
      });
      playgroundPopover.style.display = 'none';
      checkPlaygroundLive();
    });

    // Individual fix buttons
    const itemFixBtns = playgroundPopoverBody.querySelectorAll('[data-fix-index]');
    itemFixBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-fix-index') || '0', 10);
        const c = activeCorrections[idx];
        if (c) {
          applySingleCorrection(c);
        }
      });
    });
  }

  async function checkPlaygroundLive(): Promise<void> {
    const text = (playgroundText.value || '').trim();
    if (!text || text.length < 2) {
      if (playgroundIssues) playgroundIssues.replaceChildren();
      if (playgroundPill && playgroundPillText) {
        playgroundPill.className = 'playground-floating-pill';
        playgroundPillText.textContent = t('playground_ready', settings.uiLanguage);
      }
      return;
    }

    if (playgroundPill && playgroundPillText) {
      playgroundPill.className = 'playground-floating-pill checking';
      playgroundPillText.textContent = t('playground_checking', settings.uiLanguage);
    }

    try {
      const resp = await sendPopupMessage<CheckTextResponse>({
        type: 'CHECK_TEXT',
        text: playgroundText.value,
        language: settings.preferredLanguage || 'en'
      });

      if (!resp || resp.error) {
        if (playgroundPill && playgroundPillText) {
          playgroundPill.className = 'playground-floating-pill';
          playgroundPillText.textContent = t('playground_ready', settings.uiLanguage);
        }
        return;
      }

      activeCorrections = resp.corrections || [];
      const lang = (resp.detectedLanguage || settings.preferredLanguage || 'en').toUpperCase();

      if (activeCorrections.length > 0) {
        if (playgroundPill && playgroundPillText) {
          playgroundPill.className = 'playground-floating-pill has-errors';
          playgroundPillText.textContent = `✨ ${activeCorrections.length} ${t('playground_issues', settings.uiLanguage)} (${lang})`;
        }
        renderPlaygroundFixChips(activeCorrections);
        if (playgroundPopover.style.display !== 'none') {
          renderPlaygroundPopover();
        }
      } else {
        if (playgroundPill && playgroundPillText) {
          playgroundPill.className = 'playground-floating-pill clean';
          playgroundPillText.textContent = `✓ ${t('playground_clean', settings.uiLanguage)} (${lang})`;
        }
        if (playgroundIssues) {
          const cleanSpan = document.createElement('span');
          cleanSpan.style.color = '#6ee7b7';
          cleanSpan.style.fontSize = '11px';
          cleanSpan.style.padding = '2px 0';
          cleanSpan.textContent = `✓ ${t('playground_clean', settings.uiLanguage)}`;
          playgroundIssues.replaceChildren(cleanSpan);
        }
        if (playgroundPopover.style.display !== 'none') {
          renderPlaygroundPopover();
        }
      }
    } catch {
      if (playgroundPill && playgroundPillText) {
        playgroundPill.className = 'playground-floating-pill';
        playgroundPillText.textContent = t('playground_ready', settings.uiLanguage);
      }
    }
  }

  // Pill click toggles in-place popover list
  playgroundPill.addEventListener('click', (e) => {
    e.stopPropagation();
    if (playgroundPopover.style.display === 'none') {
      renderPlaygroundPopover();
      playgroundPopover.style.display = 'block';
    } else {
      playgroundPopover.style.display = 'none';
    }
  });

  playgroundPopoverClose.addEventListener('click', () => {
    playgroundPopover.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!playgroundPopover.contains(e.target as Node) && e.target !== playgroundPill && !playgroundPill.contains(e.target as Node)) {
      playgroundPopover.style.display = 'none';
    }
  });

  // Textarea selection watcher for instant synonyms & definitions
  async function handlePlaygroundSelection(): Promise<void> {
    const start = playgroundText.selectionStart;
    const end = playgroundText.selectionEnd;
    if (start === null || end === null || end <= start) return;

    const selected = playgroundText.value.substring(start, end).trim();
    if (!selected || selected.split(/\s+/).length > 2) return;

    try {
      const resp = await sendPopupMessage<SynonymsResponse>({
        type: 'GET_SYNONYMS',
        word: selected,
        language: settings.preferredLanguage || 'en'
      });

      if (!resp || !playgroundIssues) return;

      // If synonyms found, display synonym chips
      if (resp.synonyms && resp.synonyms.length > 0) {
        playgroundIssues.replaceChildren();
        const title = document.createElement('div');
        title.style.width = '100%';
        title.style.fontSize = '11px';
        title.style.color = '#a5b4fc';
        title.style.marginBottom = '2px';
        title.textContent = `${t('tab_synonyms', settings.uiLanguage)}: "${selected}" (click to replace):`;
        playgroundIssues.appendChild(title);

        for (const group of resp.synonyms) {
          for (const term of group.terms.slice(0, 5)) {
            const synChip = document.createElement('div');
            synChip.className = 'synonym-chip';

            const termSpan = document.createElement('span');
            termSpan.textContent = term;
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'syn-badge';
            badgeSpan.textContent = group.pos;
            synChip.append(termSpan, badgeSpan);

            synChip.addEventListener('click', () => {
              playgroundText.setRangeText(term, start, end, 'end');
              checkPlaygroundLive();
            });
            playgroundIssues.appendChild(synChip);
          }
        }
        return;
      }

      // If no synonyms, but definitions found, display definition card!
      if (resp.definitions && resp.definitions.length > 0) {
        playgroundIssues.replaceChildren();
        const defWrap = document.createElement('div');
        defWrap.style.width = '100%';
        defWrap.style.background = 'rgba(15, 23, 42, 0.85)';
        defWrap.style.border = '1px solid rgba(56, 189, 248, 0.3)';
        defWrap.style.borderRadius = '6px';
        defWrap.style.padding = '6px 8px';
        defWrap.style.fontSize = '11px';

        const defTitle = document.createElement('div');
        defTitle.style.color = '#38bdf8';
        defTitle.style.fontWeight = '600';
        defTitle.style.marginBottom = '3px';
        defTitle.textContent = `${t('no_synonyms_show_def', settings.uiLanguage)} "${selected}"`;
        defWrap.appendChild(defTitle);

        for (const def of resp.definitions.slice(0, 2)) {
          const entry = document.createElement('div');
          entry.style.color = '#e2e8f0';
          entry.style.marginTop = '3px';

          const posB = document.createElement('b');
          posB.style.color = '#818cf8';
          posB.style.textTransform = 'uppercase';
          posB.style.fontSize = '9.5px';
          posB.textContent = `[${def.pos}]`;

          const glossText = document.createTextNode(` ${def.gloss}`);
          entry.append(posB, glossText);
          defWrap.appendChild(entry);
        }

        playgroundIssues.appendChild(defWrap);
      }
    } catch {}
  }

  playgroundText.addEventListener('input', () => {
    if (playgroundDebounce) clearTimeout(playgroundDebounce);
    playgroundDebounce = setTimeout(() => checkPlaygroundLive(), 350);
  });

  playgroundText.addEventListener('mouseup', () => {
    setTimeout(handlePlaygroundSelection, 60);
  });

  playgroundText.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
      setTimeout(handlePlaygroundSelection, 60);
    }
  });

  // Run initial check on popup open
  setTimeout(() => checkPlaygroundLive(), 100);

  updateUI();
});
