import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAccount(urlPattern: string, platform: string) {
  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('*')
    .ilike('profile_url', `%${urlPattern}%`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (accounts && accounts.length > 0) {
    const acc = accounts[0];
    console.log(`\n${platform.toUpperCase()} Account Status:`);
    console.log('  ID:', acc.id);
    console.log('  Snapshot ID:', acc.snapshot_id || 'NULL');
    console.log('  Webhook Status:', acc.webhook_status || 'NULL');
    console.log('  Verification Status:', acc.verification_status);
    console.log('  Has Profile Data:', !!acc.profile_data);
    console.log('  Last Verification Attempt:', acc.last_verification_attempt_at || 'NULL');
    if (acc.profile_data) {
      const pd = acc.profile_data as any;
      console.log('  Profile Data Keys:', Object.keys(pd).slice(0, 8).join(', '));
    }
    return acc;
  } else {
    console.log(`\n${platform}: No account found`);
    return null;
  }
}

async function main() {
  await checkAccount('instagram.com/the_john_jace', 'Instagram');
  await checkAccount('tiktok.com/@zacy.ae', 'TikTok');
  await checkAccount('youtube.com/@CarPetKingThe1st', 'YouTube');
}

main();

