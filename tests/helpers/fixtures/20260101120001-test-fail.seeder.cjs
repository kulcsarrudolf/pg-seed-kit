// CommonJS seeder fixture: exercises loading a `.cjs` seeder via dynamic import.
const seed = async () => {
  throw new Error('Intentional seeder failure');
};

module.exports = seed;
