const paths: Record<string, string> = {
  animal:'<path d="m5 9-1-6 6 4h4l6-4-1 6v7c0 6-14 6-14 0Z"/><path d="M8 12h.01M16 12h.01m-6 4 2 1 2-1"/>',
  rocket:'<path d="M9 15c-4-6 3-11 12-12 0 8-6 15-12 12Z"/><circle cx="16" cy="8" r="2"/><path d="m9 8-5 1-2 5 7-1m7 2-1 5-5 2-1-7M6 17l-3 4 5-2"/>',
  book:'<path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15"/>',
  blocks:'<rect x="3" y="12" width="8" height="9" rx="1"/><rect x="13" y="12" width="8" height="9" rx="1"/><rect x="8" y="3" width="8" height="7" rx="1"/>',
  car:'<path d="m5 10 2-6h10l2 6M3 10h18v8H3Zm2 8v3m14-3v3M6 14h2m8 0h2"/>',
  music:'<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
  ball:'<circle cx="12" cy="12" r="9"/><path d="m12 8 4 3-2 5h-5l-1-5Zm0 0V3m4 8 5-2m-7 7 3 4m-8-4-3 4m2-9L3 9"/>',
  bubble:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  wave:'<path d="M3 10v4M7 6v12M12 3v18M17 7v10M21 10v4"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6z"/><path d="m9 12 2 2 4-4"/>',
  leaf:'<path d="M20 3C8 3 3 8 5 15c6 6 16 1 15-12Z"/><path d="M4 21 15 10"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
  'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevrons:'<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
  settings:'<path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 3 3 3-1 1-3 3-2-1-3 1-3-3-2-2 1-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="m20 2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  sliders:'<path d="M4 6h5M14 6h6M4 12h9M18 12h2M4 18h2M11 18h9"/><circle cx="11.5" cy="6" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/><circle cx="8.5" cy="18" r="2.5"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  volume:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  check:'<path d="m5 12 4 4L19 6"/>', x:'<path d="m6 6 12 12M6 18 18 6"/>',
};
export function mountIcons(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach(el => {
    const path = paths[el.dataset.icon ?? ''];
    if (path) el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  });
}
