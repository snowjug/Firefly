// Prints a demo-mode conversation so you can read how the simulated customer behaves.
//
//   node --disable-warning=ExperimentalWarning scripts/simulate.ts [difficulty] [temperature] [style]
//
// The trainee lines are a fixed example; edit LINES to try your own.
import { simulate } from '../server/engine/simulate.ts';
import { makeScenario } from '../server/engine/testing.ts';
import type { CommunicationStyle, Difficulty, StartTemperature } from '#shared/domain/vocab.ts';

const [difficulty = 'standard', temperature = 'frustrated', style = 'talkative'] =
  process.argv.slice(2);

const LINES = [
  "Hi, thanks for calling. My name is Sam. What's been happening?",
  "I'm sorry about that, it sounds really frustrating when you need the portal for your patients. Can you read me exactly what the screen says?",
  'Thanks. When did it last work, and did anything change before that?',
  'Is your work email also signed in on your phone or another device?',
  "I'll take ownership of this. I'll get your account unlocked and call you back by 10am. Is there anything else I can help with?",
];

const scenario = makeScenario({
  difficulty: difficulty as Difficulty,
  startingTemperature: temperature as StartTemperature,
  style: style as CommunicationStyle,
});
const sim = await simulate(scenario, LINES);

console.log(`\n[${difficulty} / ${temperature} / ${style}]\n`);
console.log(`CUSTOMER: ${sim.opening}\n`);
for (const t of sim.turns) {
  console.log(`TRAINEE : ${t.trainee}`);
  console.log(`CUSTOMER: ${t.customer}`);
  const changes = t.events
    .filter((e) => e.key === 'temperature')
    .map((e) => `${e.delta > 0 ? '+' : ''}${e.delta} ${e.category}`)
    .join(', ');
  console.log(`          (temperature ${t.temperature}${changes ? `; ${changes}` : ''})\n`);
}
