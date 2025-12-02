import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAccounts() {
  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('platform', 'youtube')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Recent YouTube accounts:\n');
  accounts?.forEach(acc => {
    console.log(`Account ID: ${acc.id}`);
    console.log(`  URL: ${acc.profile_url}`);
    console.log(`  Snapshot ID: ${acc.snapshot_id || 'NULL'}`);
    console.log(`  Webhook Status: ${acc.webhook_status || 'NULL'}`);
    console.log(`  Verification Status: ${acc.verification_status}`);
    console.log(`  Has Profile Data: ${!!acc.profile_data}`);
    if (acc.profile_data) {
      const pd = acc.profile_data as any;
      console.log(`  Profile Data Keys: ${Object.keys(pd).slice(0, 10).join(', ')}`);
      console.log(`  Description: ${(pd.Description || pd.description || '').substring(0, 100)}`);
    }
    console.log('');
  });
}

checkAccounts();

