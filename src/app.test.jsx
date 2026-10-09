// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, command, routes } from './app.jsx';

const execCommand = document.execCommand;
beforeEach(() => {
  window.kubarrTheme = { get: () => 'system', set: () => {} };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (execCommand === undefined) delete document.execCommand;
  else document.execCommand = execCommand;
  window.getSelection().removeAllRanges();
});

const home = () => render(<App route="" base="/kubarr-website/"/>);

describe('shared main navigation', () => {
  const expected = [
    ['Home', '/kubarr-website/'],
    ['Features', '/kubarr-website/features/'],
    ['GitHub ↗', 'https://github.com/smokeythebandit/Kubarr'],
  ];

  for (const route of routes) {
    it(`renders the same menu with the correct active link on ${route || 'home'}`, () => {
      render(<App route={route} base="/kubarr-website/"/>);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const links = Array.from(nav.querySelectorAll('a'));
      expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual(expected);
      const active = route === '' ? 'Home' : route.startsWith('features/') ? 'Features' : undefined;
      expect(links.filter(link => link.hasAttribute('aria-current')).map(link => [link.textContent, link.getAttribute('aria-current')])).toEqual(active ? [[active, 'page']] : []);
      expect(nav.querySelector('.nav-github')).toBe(links[2]);
      expect(screen.queryByLabelText('Theme')).toBeNull();
    });

    it(`uses the same responsive menu behavior on ${route || 'home'}`, () => {
      render(<App route={route} base="/kubarr-website/"/>);
      const menu = screen.getByRole('button', { name: 'Menu' });
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(menu.getAttribute('aria-controls')).toBe(nav.id);
      expect(menu.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(menu);
      expect(menu.getAttribute('aria-expanded')).toBe('true');
      expect(nav.classList.contains('is-open')).toBe(true);
      nav.querySelector('a').focus();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(menu.getAttribute('aria-expanded')).toBe('false');
      expect(nav.classList.contains('is-open')).toBe(false);
      expect(document.activeElement).toBe(menu);
      fireEvent.click(menu);
      nav.querySelector('a').addEventListener('click', event => event.preventDefault()); // jsdom cannot follow page links.
      fireEvent.click(nav.querySelector('a'));
      expect(menu.getAttribute('aria-expanded')).toBe('false');
      expect(nav.classList.contains('is-open')).toBe(false);
    });
  }
});

describe('features page', () => {
  const entries = [
    ['observability', 'Observability', 'Logging'],
    ['isolation', 'Isolation', 'Keep app workloads organized'],
    ['modularity', 'Modularity', 'Chart-based apps are independent components'],
  ];
  for (const route of ['features/', ...entries.map(([id]) => `features/${id}/`)]) {
    it(`has real sidebar routes and only the selected content on ${route}`, () => {
      const { container } = render(<App route={route} base="/kubarr-website/"/>);
      const nav = screen.getByRole('navigation', { name: 'Features' });
      const links = Array.from(nav.querySelectorAll('a'));
      expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
        ['Overview', '/kubarr-website/features/'],
        ...entries.map(([id, label]) => [label, `/kubarr-website/features/${id}/`]),
      ]);
      expect(links.filter(link => link.hasAttribute('aria-current')).map(link => [link.textContent, link.getAttribute('aria-current')])).toEqual([[route === 'features/' ? 'Overview' : entries.find(([id]) => route === `features/${id}/`)[1], 'page']]);
      const selected = entries.find(([id]) => route === `features/${id}/`);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(selected?.[1] ?? 'Features');
      if (selected) {
        expect(screen.getByText(new RegExp(selected[2]))).toBeTruthy();
        if (selected[0] === 'observability') {
          expect(screen.getByRole('heading', { name: 'Resource tracking', level: 2 })).toBeTruthy();
          expect(screen.getByText('Track CPU and memory usage in monitoring.')).toBeTruthy();
          expect(screen.getByRole('heading', { name: 'Live network view', level: 2 })).toBeTruthy();
          expect(screen.getByText('See network activity and connections live.')).toBeTruthy();
        }
        for (const [id, , text] of entries) if (id !== selected[0]) expect(container.querySelector('.features-content').textContent).not.toContain(text);
        expect(container.querySelector('.feature-links')).toBeNull();
      } else {
        expect(Array.from(container.querySelectorAll('.feature-links a')).map(link => link.getAttribute('href'))).toEqual(entries.map(([id]) => `/kubarr-website/features/${id}/`));
        for (const [, , text] of entries) expect(container.querySelector('.features-content').textContent).not.toContain(text);
      }
      expect(container.querySelector('.feature-card, .features-next, .actions')).toBeNull();
    });
  }
});

describe('isolation content', () => {
  it('shows only relevant isolation screenshots and explains the distinct boundaries', () => {
    const { container } = render(<App route="features/isolation/" base="/kubarr-website/"/>);
    expect(Array.from(container.querySelectorAll('.features-content h2'), heading => heading.textContent)).toEqual([
      'Containers', 'Cilium networking', 'Storage', 'VPN',
    ]);
    expect(screen.getByText(/not separate virtual machines or an absolute security boundary/)).toBeTruthy();
    expect(screen.getByText(/Kubarr does not install Cilium/)).toBeTruthy();
    expect(screen.getByText(/a separate config claim does not isolate shared media/)).toBeTruthy();
    expect(screen.getByText(/Its firewall kill switch is enabled by default/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'charts repository' }).getAttribute('href')).toBe('https://github.com/smokeythebandit/kubarr-charts');
    expect(screen.getByRole('link', { name: 'how Kubarr works' }).getAttribute('href')).toBe('/kubarr-website/docs/how-it-works/');
    expect(screen.getByText(/observed traffic, not NetworkPolicy enforcement/)).toBeTruthy();
    const sections = Array.from(container.querySelectorAll('.features-content section'));
    expect(sections.map(section => Array.from(section.querySelectorAll('img'), img => img.getAttribute('src')))).toEqual([
      ['/kubarr-website/assets/isolation/containers.jpg'], [],
      ['/kubarr-website/assets/isolation/storage.jpg'], ['/kubarr-website/assets/isolation/vpn.jpg'],
    ]);
    for (const figure of container.querySelectorAll('.feature-screenshot')) {
      const img = figure.querySelector('img');
      expect(img.getAttribute('alt')).toBeTruthy();
      expect(img.getAttribute('width')).toBeTruthy();
      expect(img.getAttribute('height')).toBeTruthy();
      expect(figure.querySelector('a').getAttribute('href')).toBe(img.getAttribute('src'));
      expect(figure.querySelector('figcaption').textContent).toBeTruthy();
    }
    expect(container.querySelector('[src*="observability/"]')).toBeNull();
  });
});

describe('menu keyboard handling', () => {
  it('leaves focus alone on Escape while closed', () => {
    home();
    const menu = screen.getByRole('button', { name: 'Menu' });
    const code = screen.getByRole('code', { name: /Install command/ });
    code.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(code);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes an open menu and returns focus to its button', () => {
    home();
    const menu = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    screen.getByRole('code', { name: /Install command/ }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);
  });
});

describe('install command copy', () => {
  it('uses the clipboard when available and confirms success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fallback = vi.fn().mockReturnValue(true);
    document.execCommand = fallback;
    home();
    fireEvent.click(screen.getByRole('button', { name: 'Copy install command' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Command copied to clipboard.'));
    expect(writeText).toHaveBeenCalledWith(command);
    expect(fallback).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Install command copied' }).textContent).toBe('Copied');
  });

  it('selects the visible command when clipboard and fallback both fail', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const fallback = vi.fn().mockReturnValue(false);
    document.execCommand = fallback;
    home();
    const button = screen.getByRole('button', { name: 'Copy install command' });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Copy failed. Select the command to copy it manually.'));
    expect(fallback).toHaveBeenCalledWith('copy');
    expect(window.getSelection().toString()).toBe(command);
    expect(window.getSelection().getRangeAt(0).commonAncestorContainer).toBe(screen.getByRole('code', { name: /Install command/ }));
    expect(document.activeElement).toBe(button);
    expect(button.textContent).toBe('Copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
