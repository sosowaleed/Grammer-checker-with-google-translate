import { UserSettings, DEFAULT_SETTINGS } from '../shared/types';
import { SUPPORTED_LANGUAGES, POPULAR_LANGUAGES } from '../shared/languages';

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

document.addEventListener('DOMContentLoaded', async () => {
  const masterToggle = document.getElementById('masterToggle') as HTMLInputElement;
  const grammarToggle = document.getElementById('grammarToggle') as HTMLInputElement;
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
  const loadSample = document.getElementById('loadSample') as HTMLElement;

  // Populate languages
  let langHtml = '<optgroup label="Popular Languages">';
  for (const code of POPULAR_LANGUAGES) {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    if (lang) {
      langHtml += `<option value="${lang.code}">${lang.name} (${lang.nativeName})</option>`;
    }
  }
  langHtml += '</optgroup><optgroup label="All Supported Languages">';
  for (const lang of SUPPORTED_LANGUAGES) {
    langHtml += `<option value="${lang.code}">${lang.name}</option>`;
  }
  langHtml += '</optgroup>';
  languageSelect.innerHTML = langHtml;

  // Fetch current settings
  let settings: UserSettings;
  try {
    const fetched = await sendPopupMessage<UserSettings>({ type: 'GET_SETTINGS' });
    settings = fetched && fetched.enabled !== undefined ? { ...DEFAULT_SETTINGS, ...fetched } : { ...DEFAULT_SETTINGS };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  // Update UI with settings
  function updateUI() {
    masterToggle.checked = settings.enabled;
    grammarToggle.checked = settings.autoCheckGrammar;
    languageSelect.value = settings.preferredLanguage || 'en';

    if (settings.enabled) {
      statusPill.classList.remove('disabled');
      statusText.textContent = 'Active';
    } else {
      statusPill.classList.add('disabled');
      statusText.textContent = 'Disabled';
    }

    statWords.textContent = (settings.stats?.wordsChecked || 0).toLocaleString();
    statCorrections.textContent = (settings.stats?.correctionsAccepted || 0).toLocaleString();
    statTranslations.textContent = (settings.stats?.translationsPerformed || 0).toLocaleString();

    renderDomains();
    renderWords();
  }

  function renderDomains() {
    domainsList.innerHTML = '';
    if (!settings.ignoredDomains || settings.ignoredDomains.length === 0) {
      domainsList.innerHTML = '<span style="color: #64748b; font-size: 11px;">No domains ignored</span>';
      return;
    }

    settings.ignoredDomains.forEach((domain) => {
      const tag = document.createElement('div');
      tag.className = 'domain-tag';
      tag.innerHTML = `
        <span>${domain}</span>
        <span class="del-btn" data-domain="${domain}">&times;</span>
      `;

      tag.querySelector('.del-btn')?.addEventListener('click', async () => {
        settings.ignoredDomains = settings.ignoredDomains.filter((d) => d !== domain);
        await saveSettings();
        renderDomains();
      });

      domainsList.appendChild(tag);
    });
  }

  function renderWords() {
    if (!wordsList) return;
    wordsList.innerHTML = '';
    if (!settings.ignoredWords || settings.ignoredWords.length === 0) {
      wordsList.innerHTML = '<span style="color: #64748b; font-size: 11px;">No words ignored</span>';
      return;
    }

    settings.ignoredWords.forEach((word) => {
      const tag = document.createElement('div');
      tag.className = 'domain-tag';
      tag.innerHTML = `
        <span>${word}</span>
        <span class="del-btn" data-word="${word}">&times;</span>
      `;

      tag.querySelector('.del-btn')?.addEventListener('click', async () => {
        settings.ignoredWords = settings.ignoredWords.filter((w) => w.toLowerCase() !== word.toLowerCase());
        await sendPopupMessage({ type: 'UNIGNORE_WORD', word });
        await saveSettings();
        renderWords();
      });

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

  // Event Listeners
  masterToggle.addEventListener('change', async () => {
    settings.enabled = masterToggle.checked;
    await saveSettings();
  });

  grammarToggle.addEventListener('change', async () => {
    settings.autoCheckGrammar = grammarToggle.checked;
    await saveSettings();
  });

  languageSelect.addEventListener('change', async () => {
    settings.preferredLanguage = languageSelect.value;
    await saveSettings();
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

  // Playground samples
  let sampleIndex = 0;
  const samples = [
    {
      text: 'This is a exampel of speling eror and bad grammer.',
      label: 'Load Spanish sample'
    },
    {
      text: 'yo tengo un perro amariyo y quiero comer una pome.',
      label: 'Load German sample'
    },
    {
      text: 'Ich habe ein feler gemacht und bin muede.',
      label: 'Load French sample'
    },
    {
      text: 'Je suis alle au cinema et je mange une pome.',
      label: 'Load English sample'
    }
  ];

  loadSample.addEventListener('click', () => {
    const sample = samples[sampleIndex];
    playgroundText.value = sample.text;
    playgroundText.dispatchEvent(new Event('input', { bubbles: true }));
    sampleIndex = (sampleIndex + 1) % samples.length;
    loadSample.textContent = samples[sampleIndex].label;
  });

  updateUI();
});
