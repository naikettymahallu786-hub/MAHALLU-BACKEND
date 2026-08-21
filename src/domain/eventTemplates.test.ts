import { cleanEventDescription } from './eventTemplates';

describe('cleanEventDescription', () => {
  it('returns an empty string when the event has no description', () => {
    expect(cleanEventDescription({})).toBe('');
    expect(cleanEventDescription(null)).toBe('');
    expect(cleanEventDescription(undefined)).toBe('');
  });

  it('substitutes {{EVENT_TITLE}} and {{MAJLIS_TITLE}} with the event title', () => {
    const result = cleanEventDescription({
      title: 'Annual Milad',
      description: 'Welcome to {{EVENT_TITLE}}, also known as {{MAJLIS_TITLE}}.',
    });
    expect(result).toBe('Welcome to Annual Milad, also known as Annual Milad.');
  });

  it('falls back to the default venue when none is provided', () => {
    const result = cleanEventDescription({ description: 'Venue: {{VENUE_NAME}}' });
    expect(result).toBe('Venue: മഹല്ല് ജുമാ മസ്ജിദ് അങ്കണം');
  });

  it('uses the provided venue when set', () => {
    const result = cleanEventDescription({ description: 'Venue: {{VENUE_NAME}}', venue: 'Community Hall' });
    expect(result).toBe('Venue: Community Hall');
  });

  it('falls back to the default time slot when no date is provided', () => {
    const result = cleanEventDescription({ description: 'Time: {{TIME_SLOT}}' });
    expect(result).toBe('Time: മഗ്‌രിബ് നമസ്കാരാനന്തരം');
  });

  it('formats the date-derived time slot when a date is provided', () => {
    const result = cleanEventDescription({ description: '{{TIME_SLOT}}', date: new Date('2026-08-18T14:30:00Z') });
    expect(result).not.toBe('');
    expect(result).not.toContain('{{');
  });

  it('falls back to the default chief guest when none is provided', () => {
    const result = cleanEventDescription({ description: '{{CHIEF_GUEST}}' });
    expect(result).toBe('മഹല്ല് ഖതീബ് / ഭാരവാഹികൾ');
  });

  it('uses the provided chief guest when set', () => {
    const result = cleanEventDescription({ description: '{{CHIEF_GUEST}}', chiefGuest: 'Sheikh X' });
    expect(result).toBe('Sheikh X');
  });

  it('strips any unresolved {{...}} placeholder tags', () => {
    const result = cleanEventDescription({ description: 'Unknown: {{SOME_UNRECOGNIZED_TAG}} end.' });
    expect(result).toBe('Unknown:  end.');
  });

  it('strips markdown ** asterisks', () => {
    const result = cleanEventDescription({ description: 'This is **bold** text.' });
    expect(result).toBe('This is bold text.');
  });

  it('applies all substitutions and cleanup together', () => {
    const result = cleanEventDescription({
      title: 'Uroos Celebration',
      venue: 'Main Masjid',
      chiefGuest: 'Ustadh A',
      date: new Date('2026-09-01T10:00:00Z'),
      description: '**{{EVENT_TITLE}}** at {{VENUE_NAME}} with {{CHIEF_GUEST}}. {{UNKNOWN_TAG}}',
    });
    expect(result).toBe('Uroos Celebration at Main Masjid with Ustadh A.');
  });
});
