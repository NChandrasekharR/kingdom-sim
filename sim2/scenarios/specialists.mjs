// Probes Pillar B specifically: fast skill gain + high master value, then kill
// masters (raids/plague) to see how brittle "irreplaceable people" makes it.
export default {
  name: 'specialists',
  description: 'Fast skill growth + master deaths. Tests brittleness of the human layer.',
  params: {
    startPop: 10, startFood: 50,
    skill: { gainPerTick: 0.0016, max: 1.0 },
    raid: { firstYear: 1.5, targeting: 'value' },
  },
  events: [
    { event: 'masterSmith', atYear: 1.0 },
    { event: 'plague', atYear: 6.0 },        // will it take the masters?
    { event: 'plague', atYear: 8.5 },
  ],
  // background random raids that can pick off skilled crews
  randomEvents: [{ event: 'goodHarvest', perTickChance: 0.0008 }],
};
