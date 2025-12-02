/**
 * Test script for verification logic
 * Tests bio extraction and code verification functions
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { extractBioFromProfileData, verifyCodeInBio } from '../src/lib/social-account-helpers';

console.log('🧪 Testing Verification Logic');
console.log('==============================\n');

// Test 1: TikTok bio extraction
console.log('1️⃣  Testing TikTok bio extraction...');
const tiktokProfile = {
  biography: 'Check out my content! Verification code: ABC123',
  nickname: 'testuser',
  followers: 1000,
};
const tiktokBio = extractBioFromProfileData(tiktokProfile, 'tiktok');
console.log(`   Bio extracted: "${tiktokBio}"`);
console.log(`   ✅ Expected: "Check out my content! Verification code: ABC123"`);
console.log(`   ${tiktokBio === 'Check out my content! Verification code: ABC123' ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: Instagram bio extraction
console.log('2️⃣  Testing Instagram bio extraction...');
const instagramProfile = {
  biography: 'Content creator | ABC123',
  bio: 'Content creator | ABC123',
};
const instagramBio = extractBioFromProfileData(instagramProfile, 'instagram');
console.log(`   Bio extracted: "${instagramBio}"`);
console.log(`   ✅ Expected: "Content creator | ABC123"`);
console.log(`   ${instagramBio === 'Content creator | ABC123' ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: YouTube description extraction
console.log('3️⃣  Testing YouTube description extraction...');
const youtubeProfile = {
  Description: 'My channel description with code ABC123',
  followers: 5000,
};
const youtubeBio = extractBioFromProfileData(youtubeProfile, 'youtube');
console.log(`   Bio extracted: "${youtubeBio}"`);
console.log(`   ✅ Expected: "My channel description with code ABC123"`);
console.log(`   ${youtubeBio === 'My channel description with code ABC123' ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: Code verification - code found
console.log('4️⃣  Testing code verification - code found...');
const bioWithCode = 'Check out my content! Verification code: ABC123';
const codeFound = verifyCodeInBio(bioWithCode, 'ABC123');
console.log(`   Bio: "${bioWithCode}"`);
console.log(`   Code: "ABC123"`);
console.log(`   Result: ${codeFound}`);
console.log(`   ${codeFound ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 5: Code verification - code not found
console.log('5️⃣  Testing code verification - code not found...');
const bioWithoutCode = 'Check out my content!';
const codeNotFound = verifyCodeInBio(bioWithoutCode, 'ABC123');
console.log(`   Bio: "${bioWithoutCode}"`);
console.log(`   Code: "ABC123"`);
console.log(`   Result: ${codeNotFound}`);
console.log(`   ${!codeNotFound ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 6: Code verification - case insensitive
console.log('6️⃣  Testing code verification - case insensitive...');
const bioMixedCase = 'My bio with abc123 code';
const codeFoundCaseInsensitive = verifyCodeInBio(bioMixedCase, 'ABC123');
console.log(`   Bio: "${bioMixedCase}"`);
console.log(`   Code: "ABC123"`);
console.log(`   Result: ${codeFoundCaseInsensitive}`);
console.log(`   ${codeFoundCaseInsensitive ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 7: Code verification - with extra spaces
console.log('7️⃣  Testing code verification - with extra spaces...');
const bioWithSpaces = 'My bio with   ABC   123   code';
const codeFoundWithSpaces = verifyCodeInBio(bioWithSpaces, 'ABC123');
console.log(`   Bio: "${bioWithSpaces}"`);
console.log(`   Code: "ABC123"`);
console.log(`   Result: ${codeFoundWithSpaces}`);
console.log(`   ${codeFoundWithSpaces ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 8: Empty bio
console.log('8️⃣  Testing empty bio...');
const emptyBio = '';
const emptyResult = verifyCodeInBio(emptyBio, 'ABC123');
console.log(`   Bio: ""`);
console.log(`   Code: "ABC123"`);
console.log(`   Result: ${emptyResult}`);
console.log(`   ${!emptyResult ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('✅ All verification logic tests completed!');

