// ESM seeder fixture: exercises loading a `.js` seeder as an ES module.
const seed = async () => {
  const pool = globalThis.__TEST_POOL__;
  await pool.query('INSERT INTO test_data (name) VALUES ($1)', ['test-success']);
};

export default seed;
