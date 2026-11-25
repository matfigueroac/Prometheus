/* The poster is a normal watch link until the reader requests inline playback. */
document.addEventListener('click', (event) => {
  const poster = event.target.closest('.video-poster');
  if (!poster || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey
      || event.shiftKey || event.altKey || location.protocol === 'file:') return;

  const source = new URL(poster.href);
  const id = source.searchParams.get('v');
  if (source.hostname !== 'www.youtube.com' || !/^[\w-]{11}$/.test(id || '')) return;
  event.preventDefault();

  const embed = new URL('https://www.youtube-nocookie.com/embed/' + id);
  embed.searchParams.set('autoplay', '1');
  const start = parseInt(source.searchParams.get('t') || '0', 10);
  if (start > 0) embed.searchParams.set('start', start);
  const frame = document.createElement('iframe');
  frame.src = embed.href;
  frame.title = poster.getAttribute('aria-label');
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  poster.replaceWith(frame);
  frame.focus();
});
