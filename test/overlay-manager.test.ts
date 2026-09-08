import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OverlayManager } from '../src/content/overlay-manager';
import { CorrectionPopup } from '../src/content/correction-popup';
import { GrammarCorrection, DEFAULT_SETTINGS } from '../src/shared/types';

describe('OverlayManager & Hover Separated Settings', () => {
  let overlayManager: OverlayManager;
  let input: HTMLInputElement;

  beforeEach(() => {
    vi.useFakeTimers();
    overlayManager = new OverlayManager();
    input = document.createElement('input');
    input.value = 'I has a speling error';
    document.body.appendChild(input);
  });

  afterEach(() => {
    overlayManager.clear();
    input.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('verifies DEFAULT_SETTINGS has separated highlight and hover options', () => {
    expect(DEFAULT_SETTINGS.autoPopupOnHighlight).toBe(false);
    expect(DEFAULT_SETTINGS.autoPopupOnHover).toBe(true);
  });

  it('creates markers with full word height rather than 4px strip', () => {
    const corrections: GrammarCorrection[] = [
      {
        original: 'speling',
        corrected: 'spelling',
        offset: 8,
        length: 7,
        type: 'spelling',
        explanation: 'Did you mean spelling?'
      }
    ];

    overlayManager.setCorrections(input, corrections, 'en');

    // Query marker created in overlay container
    const marker = (overlayManager as any).markers[0] as HTMLElement;
    expect(marker).toBeDefined();

    // Height must be at least 18px to cover the word letters
    const height = parseFloat(marker.style.height);
    expect(height).toBeGreaterThanOrEqual(18);
  });

  it('triggers correction popup when autoPopupHover is enabled and user hovers over marker', () => {
    const showSpy = vi.spyOn(CorrectionPopup, 'show').mockImplementation(() => {});

    overlayManager.setAutoPopupHover(true);

    const corrections: GrammarCorrection[] = [
      {
        original: 'speling',
        corrected: 'spelling',
        offset: 8,
        length: 7,
        type: 'spelling'
      }
    ];

    overlayManager.setCorrections(input, corrections, 'en');
    const marker = (overlayManager as any).markers[0] as HTMLElement;

    // Simulate mouseenter on marker
    marker.dispatchEvent(new MouseEvent('mouseenter'));

    // Before timer fires
    expect(showSpy).not.toHaveBeenCalled();

    // Fast-forward past the 150ms hover delay
    vi.advanceTimersByTime(160);

    expect(showSpy).toHaveBeenCalled();
  });

  it('does NOT trigger correction popup on hover when autoPopupHover is disabled', () => {
    const showSpy = vi.spyOn(CorrectionPopup, 'show').mockImplementation(() => {});

    overlayManager.setAutoPopupHover(false);

    const corrections: GrammarCorrection[] = [
      {
        original: 'speling',
        corrected: 'spelling',
        offset: 8,
        length: 7,
        type: 'spelling'
      }
    ];

    overlayManager.setCorrections(input, corrections, 'en');
    const marker = (overlayManager as any).markers[0] as HTMLElement;

    marker.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(300);

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('successfully applies fix when clicking accept button in hover suggestion popup', () => {
    input.value = 'lanterns hatss';

    const corrections: GrammarCorrection[] = [
      {
        original: 'hatss',
        corrected: 'hats',
        offset: 9,
        length: 5,
        type: 'spelling',
        explanation: 'Spelling correction.'
      }
    ];

    overlayManager.setCorrections(input, corrections, 'en');
    const marker = (overlayManager as any).markers[0] as HTMLElement;

    // Hover over the marker to trigger popup
    marker.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(160);

    const host = (overlayManager as any).host;
    const acceptBtn = host.popoverContainer.querySelector('#polyglot-btn-accept') as HTMLButtonElement;
    expect(acceptBtn).not.toBeNull();
    expect(acceptBtn.textContent).toContain('hats');

    // Simulate user mousedown and click on the accept button
    acceptBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    acceptBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(input.value).toBe('lanterns hats');
    expect(CorrectionPopup.isOpen()).toBe(false);
  });

  it('corrects typo even if offset was shifted using expectedOriginal realignment', () => {
    input.value = 'all lanterns hatss here';

    const corrections: GrammarCorrection[] = [
      {
        original: 'hatss',
        corrected: 'hats',
        offset: 5, // Intentionally wrong offset (real offset is 13)
        length: 5,
        type: 'spelling'
      }
    ];

    overlayManager.setCorrections(input, corrections, 'en');
    const marker = (overlayManager as any).markers[0] as HTMLElement;

    marker.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(160);

    const host = (overlayManager as any).host;
    const acceptBtn = host.popoverContainer.querySelector('#polyglot-btn-accept') as HTMLButtonElement;
    expect(acceptBtn).not.toBeNull();

    acceptBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    acceptBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(input.value).toBe('all lanterns hats here');
  });
});
