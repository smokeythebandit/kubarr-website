// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { App } from './app.jsx';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
  // jsdom has no native dialog top layer; emulate method/open/close events.
  HTMLDialogElement.prototype.showModal = vi.fn(function () { this.open = true; this.querySelector('button').focus(); });
  HTMLDialogElement.prototype.close = vi.fn(function () { this.open = false; this.dispatchEvent(new Event('close')); });
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  delete HTMLDialogElement.prototype.showModal;
  delete HTMLDialogElement.prototype.close;
  vi.restoreAllMocks();
  document.body.style.overflow = '';
  delete HTMLImageElement.prototype.animate;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderHome = () => render(<App route="" base="/kubarr-website/"/>);
const links = () => screen.getAllByRole('link', { name: /Open full-size .* screenshot/ });
const finishAnimation = dialog => {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: 'screenshot-exit' });
  fireEvent(dialog, event);
};

it('retains all nine direct-image links in prerendered HTML without requiring JS', () => {
  const html = renderToString(<App route="" base="/kubarr-website/"/>);
  const page = new DOMParser().parseFromString(html, 'text/html');
  const screenshots = [...page.querySelectorAll('.feature-screenshot a')];
  expect(screenshots).toHaveLength(9);
  for (const link of screenshots) expect(link.getAttribute('href')).toBe(link.querySelector('img').getAttribute('src'));
  expect(page.querySelector('.kubernetes-logo').closest('a')).toBeNull();
});

it('opens every isolation and Apps image full-size while leaving its thumbnail in place', () => {
  const { container } = renderHome();
  for (const title of ['Containers', 'Storage', 'Networking', 'App catalog', 'App details', 'Operations']) {
    const link = screen.getByRole('link', { name: `Open full-size ${title} screenshot` });
    const thumbnail = link.querySelector('img');
    fireEvent.click(link);
    const dialog = container.querySelector('dialog');
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-label')).toBe(`${title} screenshot`);
    expect(dialog.querySelector('img').getAttribute('src')).toBe(thumbnail.getAttribute('src'));
    expect(dialog.querySelector('img').alt).toBe(thumbnail.alt);
    expect(link.querySelector('img')).toBe(thumbnail);
    fireEvent.click(screen.getByRole('button', { name: 'Close screenshot' }));
    finishAnimation(dialog);
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(link);
  }
});

it('keeps the modal open during exit and restores focus and scroll after button and Escape close', () => {
  document.body.style.overflow = 'auto';
  renderHome();
  vi.useFakeTimers();
  const [logging, , , containers] = links();
  logging.focus();
  fireEvent.click(logging);
  const dialog = document.querySelector('dialog');
  expect(dialog.open).toBe(true);
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  expect(dialog.getAttribute('aria-label')).toBe('Unified logging screenshot');
  expect(dialog.querySelector('header')).toBeNull();
  expect(dialog.querySelector('.screenshot-close svg')).not.toBeNull();
  expect(dialog.querySelector('img').src).toBe(logging.href);
  expect(dialog.querySelector('img').alt).toBe(logging.querySelector('img').alt);
  expect(document.body.style.overflow).toBe('hidden');
  const close = screen.getByRole('button', { name: 'Close screenshot' });
  expect(document.activeElement).toBe(close);
  fireEvent.click(dialog.querySelector('img'));
  expect(dialog.open).toBe(true);
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 500, top: 100, bottom: 500 });
  fireEvent.click(dialog, { clientX: 200, clientY: 200 }); // Inside the dialog box, not the backdrop.
  expect(dialog.open).toBe(true);
  fireEvent.click(close);
  expect(dialog.open).toBe(true);
  expect(dialog.dataset.state).toBe('closing');
  expect(document.activeElement).toBe(close);
  expect(document.body.style.overflow).toBe('hidden');
  finishAnimation(dialog);
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(logging);
  expect(document.body.style.overflow).toBe('auto');

  containers.focus();
  fireEvent.click(containers);
  expect(dialog.querySelector('img').src).toBe(containers.href);
  // Escape's native cancel must be prevented until the exit finishes.
  const cancel = new Event('cancel', { cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog.open).toBe(true);
  expect(document.body.style.overflow).toBe('hidden');
  act(() => vi.advanceTimersByTime(220)); // fallback when animationend never fires
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(containers);
  expect(document.body.style.overflow).toBe('auto');
});

it('closes on backdrop only, leaves modified links alone, and cleans up on route change', () => {
  const { rerender } = renderHome();
  vi.useFakeTimers();
  const [logging, resources] = links();
  logging.addEventListener('click', event => { if (event.ctrlKey) event.preventDefault(); }); // jsdom cannot follow a direct image link.
  const modified = fireEvent.click(logging, { ctrlKey: true });
  expect(modified).toBe(false);
  expect(document.querySelector('dialog').open).toBe(false);
  resources.focus();
  fireEvent.click(resources);
  const dialog = document.querySelector('dialog');
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 500, top: 100, bottom: 500 });
  fireEvent.click(dialog, { clientX: 50, clientY: 50 });
  expect(dialog.open).toBe(true);
  expect(dialog.dataset.state).toBe('closing');
  fireEvent.click(dialog, { clientX: 50, clientY: 50 }); // Repeated dismissals must not queue closes.
  act(() => vi.advanceTimersByTime(220));
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(resources);
  fireEvent.click(logging);
  expect(dialog.open).toBe(true);
  rerender(<App route="docs/" base="/kubarr-website/"/>);
  expect(document.body.style.overflow).toBe('');
  const closes = HTMLDialogElement.prototype.close.mock.calls.length;
  act(() => vi.advanceTimersByTime(500));
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(closes);
});

it('does not let a previous close timer shut a newly opened modal', () => {
  renderHome();
  vi.useFakeTimers();
  const [logging, resources] = links();
  fireEvent.click(logging);
  const dialog = document.querySelector('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Close screenshot' }));
  finishAnimation(dialog);
  fireEvent.click(resources);
  expect(dialog.dataset.state).toBe('open');
  act(() => vi.advanceTimersByTime(500));
  expect(dialog.open).toBe(true);
  expect(dialog.querySelector('img').src).toBe(resources.href);
  fireEvent.click(screen.getByRole('button', { name: 'Close screenshot' }));
  act(() => vi.advanceTimersByTime(220));
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(resources);
});

it('closes immediately when reduced motion is requested', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  renderHome();
  vi.useFakeTimers();
  const [logging] = links();
  fireEvent.click(logging);
  const dialog = document.querySelector('dialog');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(logging);
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
});

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

it('keeps the original thumbnail styles intact during shared-image opening, viewing, and closing', async () => {
  const animations = [];
  vi.stubGlobal('innerWidth', 1200);
  vi.stubGlobal('innerHeight', 800);
  HTMLImageElement.prototype.animate = vi.fn(function (keyframes, options) {
    let resolve;
    const finished = new Promise(done => { resolve = done; });
    const animation = { finished, cancel: vi.fn(), resolve, keyframes, options };
    animations.push(animation);
    return animation;
  });
  renderHome();
  const [logging] = links();
  const thumbnail = logging.querySelector('img');
  thumbnail.style.opacity = '0.8';
  thumbnail.style.visibility = 'visible';
  thumbnail.style.display = 'block';
  const originalStyle = thumbnail.getAttribute('style');
  const expectThumbnailUnchanged = () => {
    expect(thumbnail.getAttribute('style')).toBe(originalStyle);
    expect(thumbnail.style.opacity).toBe('0.8');
    expect(thumbnail.style.visibility).toBe('visible');
    expect(thumbnail.style.display).toBe('block');
  };
  const source = vi.spyOn(thumbnail, 'getBoundingClientRect').mockReturnValue(rect(30, 260, 220, 130));
  const imageRect = vi.spyOn(HTMLImageElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(150, 80, 900, 600));
  logging.focus();
  fireEvent.click(logging);
  const dialog = document.querySelector('dialog');
  expectThumbnailUnchanged(); // pending decode
  await act(async () => {});
  expect(animations).toHaveLength(1);
  expect(animations[0].keyframes[0].transform).toBe('translate(-120px, 180px) scale(0.24444444444444444, 0.21666666666666667)');
  expectThumbnailUnchanged(); // opening animation in flight
  await act(async () => animations[0].resolve());
  expectThumbnailUnchanged(); // viewing
  source.mockReturnValue(rect(55, 360, 240, 140));
  fireEvent.click(screen.getByRole('button', { name: 'Close screenshot' }));
  expect(animations).toHaveLength(2);
  expect(animations[1].keyframes[1].transform).toBe('translate(-95px, 280px) scale(0.26666666666666666, 0.23333333333333334)');
  expect(dialog.open).toBe(true);
  expect(document.activeElement).not.toBe(logging);
  expectThumbnailUnchanged(); // closing animation in flight
  await act(async () => animations[1].resolve());
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(logging);
  expectThumbnailUnchanged();
  imageRect.mockRestore();
});

it('waits for decoding, ignores late decode after dismissal, and falls back for an offscreen source', async () => {
  let decoded;
  HTMLImageElement.prototype.decode = vi.fn(() => new Promise(resolve => { decoded = resolve; }));
  HTMLImageElement.prototype.animate = vi.fn();
  renderHome();
  const [logging] = links();
  fireEvent.click(logging);
  const dialog = document.querySelector('dialog');
  expect(dialog.dataset.state).toBe('pending');
  fireEvent.click(screen.getByRole('button', { name: 'Close screenshot' }));
  expect(dialog.open).toBe(false);
  await act(async () => decoded());
  expect(HTMLImageElement.prototype.animate).not.toHaveBeenCalled();
  vi.spyOn(logging.querySelector('img'), 'getBoundingClientRect').mockReturnValue(rect(-500, -500, 200, 100));
  fireEvent.click(logging);
  await act(async () => decoded());
  expect(dialog.dataset.motion).toBe('fallback');
  fireEvent.click(screen.getByRole('button', { name: 'Close screenshot' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close screenshot' }));
  finishAnimation(dialog);
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(2);
  expect(HTMLImageElement.prototype.animate).not.toHaveBeenCalled();
  delete HTMLImageElement.prototype.decode;
});

it('skips WAAPI for reduced motion even when both images have geometry', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  vi.stubGlobal('innerWidth', 1200);
  vi.stubGlobal('innerHeight', 800);
  HTMLImageElement.prototype.animate = vi.fn();
  vi.spyOn(HTMLImageElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(100, 100, 400, 300));
  renderHome();
  const [logging] = links();
  fireEvent.click(logging);
  fireEvent.click(screen.getByRole('button', { name: 'Close screenshot' }));
  expect(HTMLImageElement.prototype.animate).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(logging);
});
