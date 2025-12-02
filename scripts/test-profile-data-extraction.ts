/**
 * Quick test to verify profile data extraction for Instagram and YouTube
 * Tests bio extraction from sample BrightData responses
 */

import { extractBioFromProfileData } from '../src/lib/social-account-helpers';

console.log('🧪 Testing Profile Data Extraction');
console.log('=================================\n');

// Test Instagram bio extraction
console.log('1️⃣  Testing Instagram bio extraction...');
const instagramProfile = {
  biography: 'Footballer | Real Madrid | Portugal 🇵🇹',
  account_id: 'cristiano',
  nickname: 'Cristiano Ronaldo',
  followers: 650000000,
  following: 563,
  is_verified: true,
};

const instagramBio = extractBioFromProfileData(instagramProfile, 'instagram');
console.log(`   Input: ${JSON.stringify(instagramProfile.biography)}`);
console.log(`   Extracted: "${instagramBio}"`);
console.log(`   ${instagramBio === instagramProfile.biography ? '✅ PASS' : '❌ FAIL'}\n`);

// Test YouTube description extraction
console.log('2️⃣  Testing YouTube description extraction...');
const youtubeProfile = {
  Description: 'SUBSCRIBE FOR A COOKIE!\nNew MrBeast or MrBeast Gaming video every single Saturday!',
  name: 'MrBeast',
  subscribers: 453000000,
  videos_count: 925,
  channel_id: 'UCX6OQ3DkcsbYNE6H8uQQuVA',
};

const youtubeBio = extractBioFromProfileData(youtubeProfile, 'youtube');
console.log(`   Input: ${JSON.stringify(youtubeProfile.Description)}`);
console.log(`   Extracted: "${youtubeBio}"`);
console.log(`   ${youtubeBio === youtubeProfile.Description ? '✅ PASS' : '❌ FAIL'}\n`);

// Test YouTube with lowercase description
console.log('3️⃣  Testing YouTube lowercase description...');
const youtubeProfileLower = {
  description: 'This is a lowercase description field',
  name: 'Test Channel',
};

const youtubeBioLower = extractBioFromProfileData(youtubeProfileLower, 'youtube');
console.log(`   Input: ${JSON.stringify(youtubeProfileLower.description)}`);
console.log(`   Extracted: "${youtubeBioLower}"`);
console.log(`   ${youtubeBioLower === youtubeProfileLower.description ? '✅ PASS' : '❌ FAIL'}\n`);

// Test with missing bio fields
console.log('4️⃣  Testing with missing bio fields...');
const noBioProfile = {
  account_id: 'testuser',
  nickname: 'Test User',
  followers: 1000,
};

const noBio = extractBioFromProfileData(noBioProfile, 'instagram');
console.log(`   Profile: ${JSON.stringify(noBioProfile)}`);
console.log(`   Extracted: "${noBio}"`);
console.log(`   ${noBio === '' ? '✅ PASS (empty string for no bio)' : '❌ FAIL'}\n`);

console.log('✅ All extraction tests completed!');

