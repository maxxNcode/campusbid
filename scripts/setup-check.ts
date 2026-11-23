// Run with: npm run setup:check   (reads .env if present)
import { runSetupChecks } from './setup-check-lib.ts'

const results = await runSetupChecks(process.env)
for (const result of results) {
  console.log(`${result.ok ? 'OK     ' : 'MISSING'} ${result.name}: ${result.detail}`)
}
const failed = results.filter((result) => !result.ok)
console.log(failed.length === 0 ? '\nEverything needed is in place.' : `\n${failed.length} item(s) to fix before seeding:\n- ${failed.map((r) => r.name).join('\n- ')}`)
process.exit(failed.length === 0 ? 0 : 1)
