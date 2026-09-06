import browser from 'webextension-polyfill';
import { UserSettings } from '../shared/types';
import { SUPPORTED_LANGUAGES, POPULAR_LANGUAGES } from '../shared/languages';

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
    settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
  } catch {
    settings = {
      enabled: true,
      preferredLanguage: 'es',
      autoCheckGrammar: true,
      ignoredDomains: [],
      theme: 'dark',
      debounceMs: 450,
      stats: { wordsChecked: 0, correctionsAccepted: 0, translationsPerformed: 0 }
    };
  }

  // Update UI with settings
  function updateUI() {
    masterToggle.checked = settings.enabled;
    grammarToggle.checked = settings.autoCheckGrammar;
    languageSelect.value = settings.preferredLanguage || 'es';

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

  async function saveSettings() {
    try {
      settings = await browser.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings
      });
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

  // Playground samples
  let sampleIndex = 0;
  const samples = [
    {
      text: 'yo tengo un perro amariyo y quiero comer una pome',
      label: 'Load German sample'
    },
    {
      text: 'Ich habe ein feler gemacht und bin muede',
      label: 'Load French sample'
    },
    {
      text: 'Je suis alle au cinema et je mange une pome',
      label: 'Load English sample'
    },
    {
      text: 'This is a exampel of speling eror and grammatical mistake',
      label: 'Load Spanish sample'
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
