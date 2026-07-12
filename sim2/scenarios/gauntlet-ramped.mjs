// Gauntlet's shocks, but delayed to when the kingdom is established (year 5+).
// Tests Finding 5's hypothesis: the SAME disasters are survivable if they ramp
// with the kingdom instead of hitting a fragile year-2 economy.
export default {
  name: 'gauntlet-ramped',
  description: 'Same shocks as gauntlet, delayed to the established mid-game.',
  params: {
    startPop: 10, startFood: 50,
    raid: { firstYear: 1.5, targeting: 'value', warlordEveryYears: 3, warlordMinPop: 25 },
  },
  events: [
    { atYear: 5.0, event: 'drought' },
    { atYear: 6.5, event: 'harshWinter' },
    { atYear: 8.0, event: 'supplyRaid' },
    { atYear: 9.5, event: 'plague' },
    { atYear: 11.0, event: 'harshWinter' },
  ],
};
