// Pre-packaged master templates auto-seeded into a tenant's EventTemplate
// collection the first time GET /event-templates is called and none exist
// yet (see EventTemplateService.getAll). Moved verbatim out of the route
// file — pure static data, no I/O.
export const MASTER_TEMPLATES = [
  {
    name: 'Islamic Conference & Uroos Notice (വാർഷിക സനദ് ദാന സമ്മേളനം & ഉറൂസ് മുബാറക്)',
    category: 'Religious Conference',
    description: 'Comprehensive 3 to 5 Day Islamic Conference, Uroos Mubarak & Sanad Donation Program Flyer Notice.',
    variables: [
      { key: 'ANNIVERSARY_TITLE', label: 'Anniversary Title / വാർഷിക ശീർഷകം', defaultValue: 'ഹാശിമിയ്യ 20-ാം വാർഷിക സനദ് ദാന സമ്മേളനം' },
      { key: 'UROOS_NUMBER', label: 'Uroos Edition / ഉറൂസ് എണ്ണം', defaultValue: '215-ാം ഉറൂസ് മുബാറക്' },
      { key: 'VENUE_NAME', label: 'Venue / സ്ഥലം', defaultValue: 'മഖാം ജുമാ മസ്ജിദ് അങ്കണം, ആലപ്പുഴ' },
      { key: 'DATES_RANGE', label: 'Event Dates / തിയ്യതികൾ', defaultValue: 'ഏപ്രിൽ 28, 29, 30, മെയ് 1, 2' },
      { key: 'CHIEF_PATRON', label: 'Chief Patron / മുഖ്യ രക്ഷാധികാരി', defaultValue: 'സയ്യിദ് അഹ്മദ് മഹ്ദലി തങ്ങൾ (റ)' },
      { key: 'KEYNOTE_SPEAKER_DAY1', label: 'Day 1 Keynote Speaker', defaultValue: 'ഉസ്താദ് കെ. ബഷീർ ബാഖവി ഇരുമ്പുഴി' },
      { key: 'CHIEF_GUEST_DAY2', label: 'Day 2 Chief Scholar / തങ്ങൾ', defaultValue: 'സയ്യിദ് അബ്ദുറഹ്മാൻ ഇമ്പിച്ചിക്കോയ അൽ ബുഖാരി ബായാർ തങ്ങൾ' },
      { key: 'GUEST_SINGER', label: 'Nasheed / Singer / ഗായകൻ', defaultValue: 'ഉമർ അജി സിറിയ' },
      { key: 'CONVENER_NAME', label: 'Convener / കൺവീനർ', defaultValue: 'കെ.എം. ശരീഫ് ഹാജി (കൺവീനർ)' },
    ],
    programSchedule: [
      {
        dayNumber: 1,
        dateText: '30 ഏപ്രിൽ (ചൊവ്വ)',
        sessionTime: '8.00 PM',
        sessionTitle: 'മത പ്രഭാഷണം',
        keynoteSpeaker: 'ഉസ്താദ് കെ. ബഷീർ ബാഖവി ഇരുമ്പുഴി (മുദരിസ് അല്ലൂർ ജുമാ മസ്ജിദ്)',
        voteOfThanks: 'കെ.എം. ശരീഫ് ഹാജി (കൺവീനർ)',
      },
      {
        dayNumber: 2,
        dateText: '1 മെയ് (ബുധൻ)',
        sessionTime: '10.00 AM & 7.00 PM',
        sessionTitle: 'ശിഷ്യ സംഗമം & താജുൽ ഉലമാ സ്വലാത്ത് മജ്‌ലിസ് വാർഷികവും ഹാൾ ഉദ്ഘാടനവും',
        president: 'എം.എം. ഹനീഫ് മൗലവി',
        inaugurator: 'സയ്യിദ് ഹാമിദ് ബാഫഖി തങ്ങൾ',
        keynoteSpeaker: 'സയ്യിദ് അബ്ദുറഹ്മാൻ ഇമ്പിച്ചിക്കോയ അൽ ബുഖാരി ബായാർ തങ്ങൾ',
        chiefGuests: 'സയ്യിദ് സൈനുൽ ആബിദീൻ തങ്ങൾ അൽ ഐദ്രുസി, കെ.എൻ. ജഅ്ഫർ സ്വാദിഖ് സിദ്ദീഖി',
        felicitations: 'എ. ഫസലുദ്ദീൻ, നൗഷാദ് പടിപ്പുരയ്ക്കൽ, എച്ച്. നസീർ',
        voteOfThanks: 'ഇർഫാൻ സേട്ട്, കെ. ഫൈസൽ',
        notes: 'അന്നദാനം വൈകുന്നേരം 7:00 മുതൽ',
      },
      {
        dayNumber: 3,
        dateText: '2 മെയ് (വ്യാഴം)',
        sessionTime: '5.30 AM & 10.00 AM',
        sessionTitle: 'ഖത്മുൽ ഖുർആൻ & സയ്യിദ് മഹ്ദലി തങ്ങൾ ഉറൂസ് സമാപന ദുആ',
        president: 'ഒ. മുഹമ്മദാലി (ട്രഷറർ)',
        inaugurator: 'ഉസ്താദ് ശറഫുദ്ദീൻ ബാഖവി',
        keynoteSpeaker: 'അബ്ദുൽ കബീർ മദനി നിർക്കുന്നം',
        chiefGuests: 'സയ്യിദ് പി.എം.എസ്.എ. ആറ്റക്കോയ തങ്ങൾ മണ്ണാർക്കാട്',
        voteOfThanks: 'ഇർഫാൻ സേട്ട്',
        notes: 'സമാപന ദുആയും തബർറുക് വിതരണവും',
      },
    ],
    noticeTemplateText: `✨ **{{ANNIVERSARY_TITLE}}** & **{{UROOS_NUMBER}}** ✨\n\n📌 **സ്ഥലം**: {{VENUE_NAME}}\n🗓️ **തിയ്യതി**: {{DATES_RANGE}}\n\n🔴 **മുഖ്യ പ്രഭാഷണങ്ങൾ & അതിഥികൾ**:\n- {{KEYNOTE_SPEAKER_DAY1}}\n- {{CHIEF_GUEST_DAY2}}\n- മദ്ഹുറസൂൽ ആലാപനം: {{GUEST_SINGER}}\n\nകൺവീനർ: {{CONVENER_NAME}}`,
    isMasterTemplate: true,
  },
  {
    name: 'Monthly Swalath & Dua Majlis (മാസാന്ത സ്വലാത്ത് വാർഷികവും ഹദ്ദാദ് റാതീബും)',
    category: 'Swalath / Religious Gathering',
    description: 'Monthly Swalath Majlis, Ratheeb, and Special Prarthana Majlis notice template.',
    variables: [
      { key: 'MAJLIS_TITLE', label: 'Majlis Title / മജ്‌ലിസ് ശീർഷകം', defaultValue: 'മാസാന്ത സ്വലാത്ത് & ദുആ മജ്‌ലിസ്' },
      { key: 'CHIEF_GUEST', label: 'Chief Guest / തങ്ങൾ', defaultValue: 'സയ്യിദ് ബായാർ തങ്ങൾ' },
      { key: 'TIME_SLOT', label: 'Time / സമയം', defaultValue: 'മഗ്‌രിബ് നമസ്കാരാനന്തരം' },
    ],
    programSchedule: [
      {
        dayNumber: 1,
        dateText: 'എല്ലാ മാസത്തെയും ആദ്യ വെള്ളിയാഴ്ച',
        sessionTime: '7.00 PM',
        sessionTitle: 'സ്വലാത്ത് & ഹദ്ദാദ് റാതീബ്',
        keynoteSpeaker: 'ചീഫ് ഇമാം',
        chiefGuests: 'സയ്യിദ് അൽ ബുഖാരി തങ്ങൾ',
      },
    ],
    noticeTemplateText: `✨ **{{MAJLIS_TITLE}}** ✨\n\nനേതൃത്വം: {{CHIEF_GUEST}}\nസമയം: {{TIME_SLOT}}`,
    isMasterTemplate: true,
  },
];
