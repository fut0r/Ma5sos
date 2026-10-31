/*
 * `npm run paylink:check`: signs in to Paylink with the keys in .env.local and
 * says whether they work. Charges nothing and prints no secret.
 */
try {
  const { config } = await import('../server/config.js');
  const { checkConnection } = await import('../server/paylink.js');
  const { mode, baseUrl, apiId } = config.paylink;

  console.log(`Paylink mode: ${mode}${mode === 'mock' ? ' (local simulation, Paylink is not contacted)' : ` → ${baseUrl}`}`);
  if (mode !== 'mock') console.log(`API ID: ${apiId.slice(0, 7)}…${apiId.slice(-4)}`);

  const result = await checkConnection();
  if (result === 'ok') console.log('✓ Paylink accepted the keys. Payments are ready.');
  else console.log('Set PAYLINK_ENV=production (with your keys) in .env.local to use Paylink for real.');
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}
