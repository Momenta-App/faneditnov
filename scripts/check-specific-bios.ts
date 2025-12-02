#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check specific creators from the missing/extra list
  const creatorsToCheck = [
    { id: '7159533502815536134', username: 'ᴀᴛᴋ' }, // Missing adsartkevinfx@gmail.com
    { id: '7304704907747230722', username: 'Soap' }, // Missing soap.films.@gmail.com (invalid)
    { id: '7175043123608257579', username: 'Authentic' }, // Missing authentictalk@gmail.com
    { id: '6810527806524802053', username: 'Digital footprint' }, // Missing digitalprintfoot@gmail.com
    { id: '6997363709694034950', username: 'quatra' }, // Missing quatravfx@gmail.com
    { id: '7476478803272041515', username: 'rizing.edits' }, // Extra acc@aep.rizing
    { id: '7460182868779566103', username: '𝘨𝘳𝘪𝘮𝘦 ®' }, // Extra grime.aep@gmail.com
  ];

  for (const creator of creatorsToCheck) {
    const { data, error } = await supabase
      .from('creators_hot')
      .select('creator_id, username, bio')
      .eq('creator_id', creator.id)
      .single();

    if (data) {
      console.log(`\n=== @${data.username} (${data.creator_id}) ===`);
      console.log('Bio:');
      console.log(data.bio);
      console.log('\nEmails found in bio:');
      const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g;
      const emails = data.bio.match(emailRegex) || [];
      emails.forEach((email: string, idx: number) => {
        console.log(`  ${idx + 1}. ${email}`);
      });
      console.log('---');
    } else if (error) {
      console.log(`\nError fetching @${creator.username}: ${error.message}`);
    }
  }
}

main().catch(console.error);

