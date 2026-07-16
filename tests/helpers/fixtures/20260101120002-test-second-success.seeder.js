// ESM seeder fixture that runs after the failing one, proving execution
// continues past a failure.
const seed = async () => {
  const pool = globalThis.__TEST_POOL__;
  await pool.query('INSERT INTO test_data (name) VALUES ($1)', ['test-second-success']);
};

export default seed;
