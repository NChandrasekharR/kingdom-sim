// The redesign at its default knob settings, no scripted events.
// The control case: does the new design stay bounded and tense on its own?
export default {
  name: 'baseline',
  description: 'Redesign defaults, no injected events. Control run.',
  // Start conditions the sim showed are needed to survive the first raid:
  // a real founding party + a grace year to raise defenses. (sim finding 2026-07-09)
  params: { startPop: 10, startFood: 50, raid: { firstYear: 1.5 } },
  events: [],
};
