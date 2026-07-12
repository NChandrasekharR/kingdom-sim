// A hard run: intelligent multi-front raids, harder winters, and a schedule of
// shocks. Tests death-spiral risk and whether the player can recover.
export default {
  name: 'gauntlet',
  description: 'Multi-front smart raids + scheduled disasters. Stress test.',
  params: {
    startPop: 10, startFood: 50,
    raid: { firstYear: 1.5, targeting: 'value', fronts: 2, warlordEveryYears: 3, militaryPressure: 0.6 },
    winter: { biggerColderExpo: 0.0 },
  },
  events: [
    { atYear: 2.5, event: 'drought' },
    { atYear: 4.0, event: 'harshWinter' },
    { atYear: 5.5, event: 'supplyRaid' },
    { atYear: 7.0, event: 'plague' },
    { atYear: 9.0, event: 'harshWinter' },
  ],
};
