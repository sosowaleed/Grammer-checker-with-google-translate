/**
 * PolyglotGrammar Internationalization & Localization (l10n) Engine
 * Dynamic runtime UI translation supporting top 10 languages with standard extensible schema.
 */

export interface UiLanguageOption {
  code: string;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

export const AVAILABLE_UI_LANGUAGES: UiLanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' }
];

export type TranslationKey =
  | 'app_name'
  | 'app_subtitle'
  | 'created_by'
  | 'status_active'
  | 'status_disabled'
  | 'ext_status'
  | 'ext_status_desc'
  | 'auto_check'
  | 'auto_check_desc'
  | 'auto_popup_highlight'
  | 'auto_popup_highlight_desc'
  | 'auto_popup_hover'
  | 'auto_popup_hover_desc'
  | 'ui_language'
  | 'ui_language_desc'
  | 'pref_language'
  | 'stat_words'
  | 'stat_corrected'
  | 'stat_translations'
  | 'playground_title'
  | 'playground_placeholder'
  | 'playground_hint'
  | 'playground_checking'
  | 'playground_ready'
  | 'playground_clean'
  | 'playground_issues'
  | 'load_sample_es'
  | 'load_sample_de'
  | 'load_sample_fr'
  | 'load_sample_en'
  | 'ignored_domains'
  | 'ignored_domains_desc'
  | 'ignored_domains_none'
  | 'domain_placeholder'
  | 'btn_add'
  | 'ignored_words'
  | 'ignored_words_desc'
  | 'ignored_words_none'
  | 'word_placeholder'
  | 'tip_title'
  | 'tip_desc'
  | 'tip_stripe'
  | 'tip_kofi'
  | 'tab_fixes'
  | 'tab_synonyms'
  | 'tab_definitions'
  | 'tab_translate'
  | 'btn_copy'
  | 'btn_replace'
  | 'btn_apply_correction'
  | 'no_synonyms_show_def'
  | 'no_definitions_found'
  | 'showing_correction_for';

export const TRANSLATIONS: Record<string, Record<TranslationKey, string>> = {
  en: {
    app_name: 'PolyglotGrammar',
    app_subtitle: 'Multilingual Grammar & Spell Checker',
    created_by: 'Created by',
    status_active: 'Active',
    status_disabled: 'Disabled',
    ext_status: 'Extension Status',
    ext_status_desc: 'Enable proofreading, synonyms & translation',
    auto_check: 'Auto-check as you type',
    auto_check_desc: 'Debounced real-time grammar detection',
    auto_popup_highlight: 'Auto-popup on highlight',
    auto_popup_highlight_desc: 'Open suggestion card automatically when selecting text',
    auto_popup_hover: 'Auto-popup on hover',
    auto_popup_hover_desc: 'Show correction popup when hovering on misspelled words',
    ui_language: 'Interface Language',
    ui_language_desc: 'Choose the language displayed across the extension UI',
    pref_language: 'Preferred Target / Fallback Language',
    stat_words: 'Words Checked',
    stat_corrected: 'Corrected',
    stat_translations: 'Translations',
    playground_title: 'Interactive Playground',
    playground_placeholder: 'Type here to test PolyglotGrammar live...',
    playground_hint: 'Click the pill icon or corrections above for real-time fixes',
    playground_checking: 'Checking live...',
    playground_ready: 'Ready',
    playground_clean: 'All clear!',
    playground_issues: 'issues found',
    load_sample_es: 'Load Spanish sample',
    load_sample_de: 'Load German sample',
    load_sample_fr: 'Load French sample',
    load_sample_en: 'Load English sample',
    ignored_domains: 'Ignored Domains',
    ignored_domains_desc: 'Disable checking on specific websites',
    ignored_domains_none: 'No domains ignored',
    domain_placeholder: 'e.g. github.com',
    btn_add: 'Add',
    ignored_words: 'Ignored Words',
    ignored_words_desc: 'Words skipped during grammar and spell checks',
    ignored_words_none: 'No words ignored',
    word_placeholder: 'e.g. Forvel',
    tip_title: 'Support the Project',
    tip_desc: 'If you find PolyglotGrammar helpful, consider leaving a tip!',
    tip_stripe: 'Tip via Stripe',
    tip_kofi: 'Support on Ko-fi',
    tab_fixes: 'Fixes',
    tab_synonyms: 'Synonyms',
    tab_definitions: 'Definitions',
    tab_translate: 'Translate',
    btn_copy: 'Copy',
    btn_replace: 'Replace',
    btn_apply_correction: 'Apply Correction',
    no_synonyms_show_def: 'No synonyms found — showing definition:',
    no_definitions_found: 'No definition available for this term.',
    showing_correction_for: 'Showing correction for:'
  },
  es: {
    app_name: 'PolyglotGrammar',
    app_subtitle: 'Corrector gramatical y ortográfico multilingüe',
    created_by: 'Creado por',
    status_active: 'Activo',
    status_disabled: 'Desactivado',
    ext_status: 'Estado de la extensión',
    ext_status_desc: 'Activar corrección, sinónimos y traducción',
    auto_check: 'Comprobación automática al escribir',
    auto_check_desc: 'Detección gramatical en tiempo real',
    auto_popup_highlight: 'Ventana emergente al resaltar',
    auto_popup_highlight_desc: 'Abrir tarjeta de sugerencias automáticamente al seleccionar texto',
    auto_popup_hover: 'Ventana emergente al pasar el cursor',
    auto_popup_hover_desc: 'Mostrar sugerencia al pasar sobre palabras con errores',
    ui_language: 'Idioma de la interfaz',
    ui_language_desc: 'Selecciona el idioma mostrado en la extensión',
    pref_language: 'Idioma de destino / respaldo preferido',
    stat_words: 'Palabras revisadas',
    stat_corrected: 'Corregidas',
    stat_translations: 'Traducciones',
    playground_title: 'Área interactiva de prueba',
    playground_placeholder: 'Escribe aquí para probar PolyglotGrammar en vivo...',
    playground_hint: 'Haz clic en la píldora o sugerencias para corregir en tiempo real',
    playground_checking: 'Comprobando en vivo...',
    playground_ready: 'Listo',
    playground_clean: '¡Todo correcto!',
    playground_issues: 'errores detectados',
    load_sample_es: 'Cargar ejemplo en español',
    load_sample_de: 'Cargar ejemplo en alemán',
    load_sample_fr: 'Cargar ejemplo en francés',
    load_sample_en: 'Cargar ejemplo en inglés',
    ignored_domains: 'Sitios web ignorados',
    ignored_domains_desc: 'Desactivar revisión en sitios web específicos',
    ignored_domains_none: 'Ningún sitio web ignorado',
    domain_placeholder: 'ej. github.com',
    btn_add: 'Añadir',
    ignored_words: 'Palabras ignoradas',
    ignored_words_desc: 'Palabras omitidas durante la revisión ortográfica',
    ignored_words_none: 'Ninguna palabra ignorada',
    word_placeholder: 'ej. Forvel',
    tip_title: 'Apoya el proyecto',
    tip_desc: '¡Si te resulta útil PolyglotGrammar, considera dejar una propina!',
    tip_stripe: 'Donar por Stripe',
    tip_kofi: 'Apoyar en Ko-fi',
    tab_fixes: 'Correcciones',
    tab_synonyms: 'Sinónimos',
    tab_definitions: 'Definiciones',
    tab_translate: 'Traducir',
    btn_copy: 'Copiar',
    btn_replace: 'Reemplazar',
    btn_apply_correction: 'Aplicar corrección',
    no_synonyms_show_def: 'Sinónimos no encontrados — mostrando definición:',
    no_definitions_found: 'No hay definición disponible para este término.',
    showing_correction_for: 'Mostrando corrección para:'
  },
  fr: {
    app_name: 'PolyglotGrammar',
    app_subtitle: 'Correcteur grammatical et orthographique multilingue',
    created_by: 'Créé par',
    status_active: 'Actif',
    status_disabled: 'Désactivé',
    ext_status: "Statut de l'extension",
    ext_status_desc: 'Activer la relecture, les synonymes et la traduction',
    auto_check: 'Vérification automatique lors de la saisie',
    auto_check_desc: 'Détection grammaticale en temps réel',
    auto_popup_highlight: 'Fenêtre automatique lors du surlignage',
    auto_popup_highlight_desc: 'Ouvrir la carte de suggestion lors de la sélection de texte',
    auto_popup_hover: 'Fenêtre automatique au survol',
    auto_popup_hover_desc: 'Afficher la correction au survol des mots mal orthographiés',
    ui_language: "Langue de l'interface",
    ui_language_desc: "Choisissez la langue affichée dans l'interface",
    pref_language: 'Langue cible préférée / de secours',
    stat_words: 'Mots vérifiés',
    stat_corrected: 'Corrigés',
    stat_translations: 'Traductions',
    playground_title: 'Espace interactif',
    playground_placeholder: 'Tapez ici pour tester PolyglotGrammar en direct...',
    playground_hint: 'Cliquez sur la pilule ou les corrections pour corriger immédiatement',
    playground_checking: 'Vérification en cours...',
    playground_ready: 'Prêt',
    playground_clean: 'Tout est parfait !',
    playground_issues: 'erreurs trouvées',
    load_sample_es: 'Charger un exemple en espagnol',
    load_sample_de: 'Charger un exemple en allemand',
    load_sample_fr: 'Charger un exemple en français',
    load_sample_en: 'Charger un exemple en anglais',
    ignored_domains: 'Domaines ignorés',
    ignored_domains_desc: 'Désactiver la vérification sur des sites spécifiques',
    ignored_domains_none: 'Aucun domaine ignoré',
    domain_placeholder: 'ex. github.com',
    btn_add: 'Ajouter',
    ignored_words: 'Mots ignorés',
    ignored_words_desc: 'Mots exclus de la vérification grammaticale',
    ignored_words_none: 'Aucun mot ignoré',
    word_placeholder: 'ex. Forvel',
    tip_title: 'Soutenez le projet',
    tip_desc: 'Si PolyglotGrammar vous est utile, pensez à laisser un pourboire !',
    tip_stripe: 'Don via Stripe',
    tip_kofi: 'Soutenir sur Ko-fi',
    tab_fixes: 'Corrections',
    tab_synonyms: 'Synonymes',
    tab_definitions: 'Définitions',
    tab_translate: 'Traduire',
    btn_copy: 'Copier',
    btn_replace: 'Remplacer',
    btn_apply_correction: 'Appliquer la correction',
    no_synonyms_show_def: 'Aucun synonyme trouvé — affichage de la définition :',
    no_definitions_found: 'Aucune définition disponible pour ce terme.',
    showing_correction_for: 'Correction suggérée pour :'
  },
  de: {
    app_name: 'PolyglotGrammar',
    app_subtitle: 'Mehrsprachige Grammatik- & Rechtschreibprüfung',
    created_by: 'Erstellt von',
    status_active: 'Aktiv',
    status_disabled: 'Deaktiviert',
    ext_status: 'Erweiterungsstatus',
    ext_status_desc: 'Korrekturlesen, Synonyme & Übersetzung aktivieren',
    auto_check: 'Automatische Prüfung beim Tippen',
    auto_check_desc: 'Echtzeit-Grammatikanalyse mit Debounce',
    auto_popup_highlight: 'Automatisches Popup beim Markieren',
    auto_popup_highlight_desc: 'Vorschlagskarte beim Auswählen von Text automatisch öffnen',
    auto_popup_hover: 'Automatisches Popup beim Hovern',
    auto_popup_hover_desc: 'Korrekturkarte anzeigen, wenn der Mauszeiger über Fehlern schwebt',
    ui_language: 'Benutzeroberflächensprache',
    ui_language_desc: 'Wählen Sie die Sprache der Erweiterung',
    pref_language: 'Bevorzugte Ziel- / Ausweichsprache',
    stat_words: 'Geprüfte Wörter',
    stat_corrected: 'Korrigiert',
    stat_translations: 'Übersetzungen',
    playground_title: 'Interaktiver Spielplatz',
    playground_placeholder: 'Hier tippen, um PolyglotGrammar live zu testen...',
    playground_hint: 'Klicken Sie auf die Pille oder Vorschläge für Sofortkorrekturen',
    playground_checking: 'Prüfung läuft...',
    playground_ready: 'Bereit',
    playground_clean: 'Alles fehlerfrei!',
    playground_issues: 'Fehler gefunden',
    load_sample_es: 'Spanisches Beispiel laden',
    load_sample_de: 'Deutsches Beispiel laden',
    load_sample_fr: 'Französisches Beispiel laden',
    load_sample_en: 'Englisches Beispiel laden',
    ignored_domains: 'Ignorierte Webseiten',
    ignored_domains_desc: 'Prüfung auf bestimmten Webseiten deaktivieren',
    ignored_domains_none: 'Keine Webseiten ignoriert',
    domain_placeholder: 'z.B. github.com',
    btn_add: 'Hinzufügen',
    ignored_words: 'Ignorierte Wörter',
    ignored_words_desc: 'Wörter, die bei der Prüfung übersprungen werden',
    ignored_words_none: 'Keine Wörter ignoriert',
    word_placeholder: 'z.B. Forvel',
    tip_title: 'Projekt unterstützen',
    tip_desc: 'Wenn Ihnen PolyglotGrammar gefällt, freuen wir uns über ein Trinkgeld!',
    tip_stripe: 'Spenden über Stripe',
    tip_kofi: 'Unterstützen auf Ko-fi',
    tab_fixes: 'Korrekturen',
    tab_synonyms: 'Synonyme',
    tab_definitions: 'Definitionen',
    tab_translate: 'Übersetzen',
    btn_copy: 'Kopieren',
    btn_replace: 'Ersetzen',
    btn_apply_correction: 'Korrektur anwenden',
    no_synonyms_show_def: 'Keine Synonyme gefunden — Definition wird angezeigt:',
    no_definitions_found: 'Keine Definition für diesen Begriff verfügbar.',
    showing_correction_for: 'Korrekturvorschlag für:'
  },
  it: {
    app_name: 'PolyglotGrammar',
    app_subtitle: 'Correttore grammaticale e ortografico multilingue',
    created_by: 'Creato da',
    status_active: 'Attivo',
    status_disabled: 'Disattivato',
    ext_status: "Stato dell'estensione",
    ext_status_desc: 'Abilita correzione, sinonimi e traduzione',
    auto_check: 'Controllo automatico durante la digitazione',
    auto_check_desc: 'Rilevamento grammaticale in tempo reale',
    auto_popup_highlight: 'Popup automatico alla selezione',
    auto_popup_highlight_desc: 'Apri la scheda dei suggerimenti automaticamente quando selezioni il testo',
    auto_popup_hover: 'Popup automatico al passaggio del mouse',
    auto_popup_hover_desc: 'Mostra il popup di correzione passando sopra gli errori',
    ui_language: "Lingua dell'interfaccia",
    ui_language_desc: "Scegli la lingua mostrata nell'estensione",
    pref_language: 'Lingua di destinazione preferita',
    stat_words: 'Parole verificate',
    stat_corrected: 'Corrette',
    stat_translations: 'Traduzioni',
    playground_title: 'Area di prova interattiva',
    playground_placeholder: 'Scrivi qui per provare PolyglotGrammar in tempo reale...',
    playground_hint: 'Fai clic sulla pillola o sulle correzioni per applicare le modifiche',
    playground_checking: 'Controllo in corso...',
    playground_ready: 'Pronto',
    playground_clean: 'Tutto corretto!',
    playground_issues: 'errori rilevati',
    load_sample_es: 'Carica esempio spagnolo',
    load_sample_de: 'Carica esempio tedesco',
    load_sample_fr: 'Carica esempio francese',
    load_sample_en: 'Carica esempio inglese',
    ignored_domains: 'Domini ignorati',
    ignored_domains_desc: 'Disabilita il controllo su siti web specifici',
    ignored_domains_none: 'Nessun dominio ignorato',
    domain_placeholder: 'es. github.com',
    btn_add: 'Aggiungi',
    ignored_words: 'Parole ignorate',
    ignored_words_desc: 'Parole saltate durante il controllo ortografico',
    ignored_words_none: 'Nessuna parola ignorata',
    word_placeholder: 'es. Forvel',
    tip_title: 'Sostieni il progetto',
    tip_desc: 'Se trovi utile PolyglotGrammar, considera di lasciare una mancia!',
    tip_stripe: 'Dona con Stripe',
    tip_kofi: 'Sostieni su Ko-fi',
    tab_fixes: 'Correzioni',
    tab_synonyms: 'Sinonimi',
    tab_definitions: 'Definizioni',
    tab_translate: 'Traduci',
    btn_copy: 'Copia',
    btn_replace: 'Sostituisci',
    btn_apply_correction: 'Applica correzione',
    no_synonyms_show_def: 'Nessun sinonimo trovato — visualizzazione definizione:',
    no_definitions_found: 'Nessuna definizione disponibile per questo termine.',
    showing_correction_for: 'Correzione per:'
  },
  pt: {
    app_name: 'PolyglotGrammar',
    app_subtitle: 'Corretor gramatical e ortográfico multilíngue',
    created_by: 'Criado por',
    status_active: 'Ativo',
    status_disabled: 'Desativado',
    ext_status: 'Status da extensão',
    ext_status_desc: 'Ativar revisão, sinônimos e tradução',
    auto_check: 'Verificação automática ao digitar',
    auto_check_desc: 'Detecção gramatical em tempo real',
    auto_popup_highlight: 'Popup automático ao destacar',
    auto_popup_highlight_desc: 'Abrir cartão de sugestões automaticamente ao selecionar texto',
    auto_popup_hover: 'Popup automático ao passar o cursor',
    auto_popup_hover_desc: 'Exibir correção ao passar o cursor sobre erros',
    ui_language: 'Idioma da interface',
    ui_language_desc: 'Escolha o idioma exibido na extensão',
    pref_language: 'Idioma de destino / reserva preferido',
    stat_words: 'Palavras verificadas',
    stat_corrected: 'Corrigidas',
    stat_translations: 'Traduções',
    playground_title: 'Área interativa de testes',
    playground_placeholder: 'Digite aqui para testar o PolyglotGrammar ao vivo...',
    playground_hint: 'Clique na pílula ou correções para aplicar na hora',
    playground_checking: 'Verificando ao vivo...',
    playground_ready: 'Pronto',
    playground_clean: 'Tudo certo!',
    playground_issues: 'erros encontrados',
    load_sample_es: 'Carregar exemplo em espanhol',
    load_sample_de: 'Carregar exemplo em alemão',
    load_sample_fr: 'Carregar exemplo em francês',
    load_sample_en: 'Carregar exemplo em inglês',
    ignored_domains: 'Domínios ignorados',
    ignored_domains_desc: 'Desativar verificação em sites específicos',
    ignored_domains_none: 'Nenhum domínio ignorado',
    domain_placeholder: 'ex. github.com',
    btn_add: 'Adicionar',
    ignored_words: 'Palavras ignoradas',
    ignored_words_desc: 'Palavras ignoradas durante a verificação',
    ignored_words_none: 'Nenhuma palavra ignorada',
    word_placeholder: 'ex. Forvel',
    tip_title: 'Apoie o projeto',
    tip_desc: 'Se você acha o PolyglotGrammar útil, considere deixar uma gorjeta!',
    tip_stripe: 'Doar via Stripe',
    tip_kofi: 'Apoiar no Ko-fi',
    tab_fixes: 'Correções',
    tab_synonyms: 'Sinônimos',
    tab_definitions: 'Definições',
    tab_translate: 'Traduzir',
    btn_copy: 'Copiar',
    btn_replace: 'Substituir',
    btn_apply_correction: 'Aplicar correção',
    no_synonyms_show_def: 'Nenhum sinônimo encontrado — exibindo definição:',
    no_definitions_found: 'Nenhuma definição disponível para este termo.',
    showing_correction_for: 'Mostrando correção para:'
  },
  ru: {
    app_name: 'PolyglotGrammar',
    app_subtitle: 'Многоязычная проверка грамматики и орфографии',
    created_by: 'Создатель:',
    status_active: 'Активно',
    status_disabled: 'Отключено',
    ext_status: 'Состояние расширения',
    ext_status_desc: 'Включить проверку, синонимы и перевод',
    auto_check: 'Автопроверка при вводе',
    auto_check_desc: 'Проверка грамматики в реальном времени',
    auto_popup_highlight: 'Всплывающее окно при выделении',
    auto_popup_highlight_desc: 'Автоматически открывать карточку при выделении текста',
    auto_popup_hover: 'Всплывающее окно при наведении',
    auto_popup_hover_desc: 'Показывать карточку при наведении курсора на ошибки',
    ui_language: 'Язык интерфейса',
    ui_language_desc: 'Выберите язык интерфейса расширения',
    pref_language: 'Предпочитаемый язык перевода',
    stat_words: 'Слов проверено',
    stat_corrected: 'Исправлено',
    stat_translations: 'Переводов',
    playground_title: 'Интерактивная песочница',
    playground_placeholder: 'Введите текст для проверки PolyglotGrammar вживую...',
    playground_hint: 'Нажмите на плашку или подсказки для быстрого исправления',
    playground_checking: 'Проверка...',
    playground_ready: 'Готово',
    playground_clean: 'Ошибок нет!',
    playground_issues: 'ошибок найдено',
    load_sample_es: 'Пример на испанском',
    load_sample_de: 'Пример на немецком',
    load_sample_fr: 'Пример на французском',
    load_sample_en: 'Пример на английском',
    ignored_domains: 'Исключённые сайты',
    ignored_domains_desc: 'Отключить проверку на определённых сайтах',
    ignored_domains_none: 'Нет исключённых сайтов',
    domain_placeholder: 'напр. github.com',
    btn_add: 'Добавить',
    ignored_words: 'Игнорируемые слова',
    ignored_words_desc: 'Слова, пропускаемые при проверке',
    ignored_words_none: 'Нет игнорируемых слов',
    word_placeholder: 'напр. Forvel',
    tip_title: 'Поддержать проект',
    tip_desc: 'Если PolyglotGrammar вам полезен, поддержите разработку чаевыми!',
    tip_stripe: 'Чаевые через Stripe',
    tip_kofi: 'Поддержать на Ko-fi',
    tab_fixes: 'Исправления',
    tab_synonyms: 'Синонимы',
    tab_definitions: 'Определения',
    tab_translate: 'Перевод',
    btn_copy: 'Копировать',
    btn_replace: 'Заменить',
    btn_apply_correction: 'Применить исправление',
    no_synonyms_show_def: 'Синонимы не найдены — показ определения:',
    no_definitions_found: 'Определение для этого слова не найдено.',
    showing_correction_for: 'Исправление для:'
  },
  ja: {
    app_name: 'PolyglotGrammar',
    app_subtitle: '多言語文法・スペルチェッカー',
    created_by: '作者:',
    status_active: '有効',
    status_disabled: '無効',
    ext_status: '拡張機能の状態',
    ext_status_desc: '文章校正・類語・翻訳を有効化',
    auto_check: '入力中の自動チェック',
    auto_check_desc: 'リアルタイムで文法とスペルを検出',
    auto_popup_highlight: '選択時の自動ポップアップ',
    auto_popup_highlight_desc: 'テキスト選択時に自動で提案カードを開く',
    auto_popup_hover: 'ホバー時の自動ポップアップ',
    auto_popup_hover_desc: '波線エラーにマウスを重ねた時にポップアップを表示',
    ui_language: '表示言語',
    ui_language_desc: '拡張機能のUI表示言語を選択',
    pref_language: '優先翻訳先 / フォールバック言語',
    stat_words: 'チェックした単語',
    stat_corrected: '修正数',
    stat_translations: '翻訳回数',
    playground_title: '体験プレイグラウンド',
    playground_placeholder: 'ここに文字を入力してリアルタイム校正を体験...',
    playground_hint: 'ピルアイコンまたは修正候補をクリックして置換できます',
    playground_checking: 'チェック中...',
    playground_ready: '準備完了',
    playground_clean: '問題は見つかりませんでした！',
    playground_issues: '件のエラー検出',
    load_sample_es: 'スペイン語の例文',
    load_sample_de: 'ドイツ語の例文',
    load_sample_fr: 'フランス語の例文',
    load_sample_en: '英語の例文',
    ignored_domains: '除外ドメイン',
    ignored_domains_desc: '特定のウェブサイトでチェックを無効化',
    ignored_domains_none: '除外されたドメインはありません',
    domain_placeholder: '例: github.com',
    btn_add: '追加',
    ignored_words: '除外単語',
    ignored_words_desc: '校正時にスキップする特定の単語',
    ignored_words_none: '除外された単語はありません',
    word_placeholder: '例: Forvel',
    tip_title: 'プロジェクトを応援',
    tip_desc: 'PolyglotGrammarがお役に立ちましたら、ぜひチップで応援してください！',
    tip_stripe: 'Stripeで寄付',
    tip_kofi: 'Ko-fiで応援',
    tab_fixes: '修正',
    tab_synonyms: '類語',
    tab_definitions: '定義',
    tab_translate: '翻訳',
    btn_copy: 'コピー',
    btn_replace: '置き換える',
    btn_apply_correction: '修正を適用',
    no_synonyms_show_def: '類語が見つかりません — 単語の定義を表示:',
    no_definitions_found: 'この単語の定義はありません。',
    showing_correction_for: '修正候補:'
  },
  zh: {
    app_name: 'PolyglotGrammar',
    app_subtitle: '多语言语法与拼写检查工具',
    created_by: '开发者：',
    status_active: '运行中',
    status_disabled: '已停用',
    ext_status: '扩展状态',
    ext_status_desc: '启用语法检查、同义词与即时翻译',
    auto_check: '打字时实时检测',
    auto_check_desc: '防抖实时智能语法纠错',
    auto_popup_highlight: '选中文本自动弹出',
    auto_popup_highlight_desc: '选中文本时自动打开建议卡片',
    auto_popup_hover: '悬停错误自动弹出',
    auto_popup_hover_desc: '鼠标悬停在拼写错误上方时显示修正卡片',
    ui_language: '界面语言',
    ui_language_desc: '选择扩展面板的显示语言',
    pref_language: '首选翻译目标语言',
    stat_words: '已检查词数',
    stat_corrected: '已修正',
    stat_translations: '翻译次数',
    playground_title: '交互式测试场',
    playground_placeholder: '在此输入文字，体验实时校对...',
    playground_hint: '点击药丸图标或修正建议即可一键替换',
    playground_checking: '实时检查中...',
    playground_ready: '就绪',
    playground_clean: '全部通过！未发现错误',
    playground_issues: '处错误',
    load_sample_es: '载入西班牙语示例',
    load_sample_de: '载入德语示例',
    load_sample_fr: '载入法语示例',
    load_sample_en: '载入英语示例',
    ignored_domains: '忽略网站',
    ignored_domains_desc: '在指定网站上禁用自动检查',
    ignored_domains_none: '暂无忽略网站',
    domain_placeholder: '例如 github.com',
    btn_add: '添加',
    ignored_words: '忽略词汇',
    ignored_words_desc: '检查时跳过的特定词汇',
    ignored_words_none: '暂无忽略词汇',
    word_placeholder: '例如 Forvel',
    tip_title: '支持该项目',
    tip_desc: '如果您喜欢 PolyglotGrammar，欢迎赞助支持持续开发！',
    tip_stripe: '通过 Stripe 赞助',
    tip_kofi: '在 Ko-fi 上支持',
    tab_fixes: '修正',
    tab_synonyms: '同义词',
    tab_definitions: '释义',
    tab_translate: '翻译',
    btn_copy: '复制',
    btn_replace: '替换',
    btn_apply_correction: '应用修正',
    no_synonyms_show_def: '未找到同义词 — 显示英文释义：',
    no_definitions_found: '暂无此词条释义。',
    showing_correction_for: '建议修正：'
  },
  ar: {
    app_name: 'PolyglotGrammar',
    app_subtitle: 'المدقق اللغوي والإملائي متعدد اللغات',
    created_by: 'تم التطوير بواسطة',
    status_active: 'مفعل',
    status_disabled: 'معطل',
    ext_status: 'حالة الإضافة',
    ext_status_desc: 'تفعيل التدقيق اللغوي، المترادفات والترجمة الفورية',
    auto_check: 'تدقيق تلقائي أثناء الكتابة',
    auto_check_desc: 'كشف الأخطاء الإملائية والنحوية في الوقت الفعلي',
    auto_popup_highlight: 'نافذة تلقائية عند تحديد النص',
    auto_popup_highlight_desc: 'فتح بطاقة الاقتراحات تلقائياً عند تظليل النص',
    auto_popup_hover: 'نافذة تلقائية عند التمرير',
    auto_popup_hover_desc: 'إظهار التصحيح بمجرد تمرير الفأرة فوق الكلمات الخاطئة',
    ui_language: 'لغة الواجهة',
    ui_language_desc: 'اختر لغة عرض واجهة الإضافة',
    pref_language: 'اللغة المفضلة للترجمة',
    stat_words: 'الكلمات المدققة',
    stat_corrected: 'تم تصحيحها',
    stat_translations: 'الترجمات',
    playground_title: 'مساحة التجربة التفاعلية',
    playground_placeholder: 'اكتب هنا لتجربة PolyglotGrammar مباشرة...',
    playground_hint: 'انقر على أيقونة الكبسولة أو التصحيحات لتطبيق التعديل مباشرة',
    playground_checking: 'جاري التدقيق...',
    playground_ready: 'جاهز',
    playground_clean: 'النص سليم تماماً!',
    playground_issues: 'أخطاء تم اكتشافها',
    load_sample_es: 'تحميل نموذج إسباني',
    load_sample_de: 'تحميل نموذج ألماني',
    load_sample_fr: 'تحميل نموذج فرنسي',
    load_sample_en: 'تحميل نموذج إنجليزي',
    ignored_domains: 'المواقع المستثناة',
    ignored_domains_desc: 'تعطيل التدقيق في مواقع إلكترونية معينة',
    ignored_domains_none: 'لا توجد مواقع مستثناة',
    domain_placeholder: 'مثال: github.com',
    btn_add: 'إضافة',
    ignored_words: 'الكلمات المستثناة',
    ignored_words_desc: 'كلمات يتم تجاهلها أثناء الفحص الإملائي',
    ignored_words_none: 'لا توجد كلمات مستثناة',
    word_placeholder: 'مثال: Forvel',
    tip_title: 'ادعم المشروع',
    tip_desc: 'إذا وجدت PolyglotGrammar مفيداً لك، يسعدنا دعمك بتبرع بسيط!',
    tip_stripe: 'تبرع عبر Stripe',
    tip_kofi: 'ادعمنا على Ko-fi',
    tab_fixes: 'التصحيحات',
    tab_synonyms: 'المترادفات',
    tab_definitions: 'التعريف',
    tab_translate: 'ترجمة',
    btn_copy: 'نسخ',
    btn_replace: 'استبدال',
    btn_apply_correction: 'تطبيق التصحيح',
    no_synonyms_show_def: 'لم يتم العثور على مرادفات — عرض المعنى:',
    no_definitions_found: 'لا يتوفر تعريف لهذه الكلمة.',
    showing_correction_for: 'تصحيح مقترح لـ:'
  }
};

/**
 * Get localized string by translation key with fallback to English
 */
export function t(key: TranslationKey, lang: string = 'en', params?: Record<string, string | number>): string {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  let text = dict[key] || TRANSLATIONS['en'][key] || key;

  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
    }
  }

  return text;
}

/**
 * Returns available UI languages
 */
export function getAvailableUiLanguages(): UiLanguageOption[] {
  return AVAILABLE_UI_LANGUAGES;
}

/**
 * Applies translations to DOM elements with data-i18n attributes
 */
export function applyTranslations(lang: string = 'en', root: HTMLElement | Document = document): void {
  const currentLang = TRANSLATIONS[lang] ? lang : 'en';
  const langMeta = AVAILABLE_UI_LANGUAGES.find((l) => l.code === currentLang);

  // Set document or container direction
  if (root === document) {
    document.documentElement.lang = currentLang;
    if (langMeta) {
      document.documentElement.dir = langMeta.dir;
    }
  } else if (root instanceof HTMLElement) {
    if (langMeta) {
      root.dir = langMeta.dir;
    }
  }

  // Translate textContent
  const elements = root.querySelectorAll<HTMLElement>('[data-i18n]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n') as TranslationKey;
    if (key) {
      el.textContent = t(key, currentLang);
    }
  });

  // Translate placeholders
  const placeholderEls = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]');
  placeholderEls.forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder') as TranslationKey;
    if (key) {
      el.placeholder = t(key, currentLang);
    }
  });

  // Translate titles / tooltips
  const titleEls = root.querySelectorAll<HTMLElement>('[data-i18n-title]');
  titleEls.forEach((el) => {
    const key = el.getAttribute('data-i18n-title') as TranslationKey;
    if (key) {
      el.title = t(key, currentLang);
    }
  });
}
