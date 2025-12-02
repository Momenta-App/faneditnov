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

  // Check specific creators
  const creatorIds = [
    '7159533502815536134', // ᴀᴛᴋ
    '7416998669768180782', // TheMotivatedMentality
    '7307313158959121440', // tusk
  ];

  for (const creatorId of creatorIds) {
    const { data, error } = await supabase
      .from('creators_hot')
      .select('creator_id, username, bio')
      .eq('creator_id', creatorId)
      .single();

    if (data) {
      console.log(`\nCreator: @${data.username} (${data.creator_id})`);
      console.log(`Bio (raw):`);
      console.log(JSON.stringify(data.bio));
      console.log(`Bio (display):`);
      console.log(data.bio);
      console.log('---');
    }
  }
}

main().catch(console.error);

