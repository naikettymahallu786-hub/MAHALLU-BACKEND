export function cleanEventDescription(e: any): string {
  if (!e || !e.description) return '';
  let desc: string = e.description;

  const title = e.title || '';
  const venue = e.venue || 'മഹല്ല് ജുമാ മസ്ജിദ് അങ്കണം';
  const timeStr = e.date ? new Date(e.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
  const dateStr = e.date ? new Date(e.date).toLocaleDateString('en-GB') : '';

  desc = desc.replace(/\{\{MAJLIS_TITLE\}\}/g, title);
  desc = desc.replace(/\{\{EVENT_TITLE\}\}/g, title);
  desc = desc.replace(/\{\{ANNIVERSARY_TITLE\}\}/g, title);
  desc = desc.replace(/\{\{UROOS_NUMBER\}\}/g, 'ഉറൂസ് മുബാറക്');
  desc = desc.replace(/\{\{VENUE_NAME\}\}/g, venue);
  desc = desc.replace(/\{\{TIME_SLOT\}\}/g, timeStr || 'മഗ്‌രിബ് നമസ്കാരാനന്തരം');
  desc = desc.replace(/\{\{CHIEF_GUEST\}\}/g, e.chiefGuest || 'മഹല്ല് ഖതീബ് / ഭാരവാഹികൾ');
  desc = desc.replace(/\{\{KEYNOTE_SPEAKER_DAY1\}\}/g, 'മുഖ്യ പ്രഭാഷകർ');
  desc = desc.replace(/\{\{CHIEF_GUEST_DAY2\}\}/g, 'സയ്യിദ് ബാഫഖി തങ്ങൾ');
  desc = desc.replace(/\{\{GUEST_SINGER\}\}/g, 'ഇസ്ലാമിക് ഗായകർ');
  desc = desc.replace(/\{\{CONVENER_NAME\}\}/g, 'കൺവീനർ');
  desc = desc.replace(/\{\{DATES_RANGE\}\}/g, dateStr);

  // Strip remaining {{...}} tags
  desc = desc.replace(/\{\{[^}]+\}\}/g, '').trim();

  // Strip Markdown ** asterisks
  desc = desc.replace(/\*\*/g, '');

  return desc;
}
