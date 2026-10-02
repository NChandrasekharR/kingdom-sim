// Pronouns for the named people of the wilds. Warlords, avengers and camp folk
// are minted from fixed first-name lists, so a name's first word decides the
// pronoun — "Warlord Thyra Ironmaw falls at HER own hall", not his.

const SHE = new Set([
  // warlords (camp.js WARLORD_FIRST)
  'Ragna', 'Yrsa', 'Hallgerd', 'Thyra', 'Gunnhild', 'Astrid', 'Sigrid', 'Brenna',
  // camp folk (camp.js FOLK_FIRST) — any of them may live to be an avenger
  'Aldith', 'Sana', 'Ebba', 'Wren', 'Ida', 'Mara', 'Suvi', 'Runa', 'Liv',
  'Tova', 'Hild', 'Asa', 'Inga', 'Bera', 'Edda', 'Saga', 'Una', 'Frida',
  'Gyda', 'Oda', 'Rana', 'Kelda',
]);

// first word of a name, past any "Warlord " title
export function firstName(name) {
  return String(name || '').replace(/^Warlord\s+/i, '').split(/[\s,]/)[0];
}

export function isShe(name) {
  return SHE.has(firstName(name));
}

// pron(name).he / .He / .his / .His / .him
export function pron(name) {
  return isShe(name)
    ? { he: 'she', He: 'She', his: 'her', His: 'Her', him: 'her' }
    : { he: 'he', He: 'He', his: 'his', His: 'His', him: 'him' };
}

// "the Guildhall" / "the High Seat" — never "the The High Seat"
export function theName(name, capital = false) {
  const bare = String(name).replace(/^The\s+/, '');
  return `${capital ? 'The' : 'the'} ${bare}`;
}
