import { supabaseAdmin } from '@/lib/supabase';

async function main() {
  const { data, error } = await supabaseAdmin
    .from('contest_submissions')
    .select('id, contest_id, content_review_status, processing_status, updated_at')
    .eq('id', 10);

  if (error) {
    console.error('Error fetching submission:', error);
    process.exit(1);
  }

  console.log('Submission data:', data);
}

main();
