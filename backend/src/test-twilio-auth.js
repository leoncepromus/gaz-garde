// test-twilio-auth.js
require('dotenv').config();

const twilio = require('twilio');

console.log('=== TWILIO AUTHENTICATION TEST ===');
console.log('SID (first 8 chars):', process.env.TWILIO_ACCOUNT_SID?.slice(0, 8));
console.log('Token (length):', process.env.TWILIO_AUTH_TOKEN?.length);
console.log('From number:', process.env.TWILIO_PHONE_FROM);
console.log('To number:', process.env.TWILIO_PHONE_TO);
console.log('');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function test() {
    try {
        // Test 1: Fetch account info
        console.log('📡 Testing API connection...');
        const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        console.log('✅ API Connection successful!');
        console.log('   Account Name:', account.friendlyName);
        console.log('   Account Status:', account.status);
        console.log('');
        
        // Test 2: Check if phone number is valid
        console.log('📞 Checking phone number...');
        const incomingNumbers = await client.incomingPhoneNumbers.list({limit: 1});
        console.log('✅ Account has phone numbers:', incomingNumbers.length > 0);
        if (incomingNumbers.length > 0) {
            console.log('   Your numbers:', incomingNumbers.map(n => n.phoneNumber).join(', '));
        }
        console.log('');
        
        // Test 3: Try sending a test SMS
        console.log('📱 Attempting to send test SMS...');
        const message = await client.messages.create({
            body: 'Test message from GasSafer - Authentication working!',
            from: process.env.TWILIO_PHONE_FROM,
            to: process.env.TWILIO_PHONE_TO
        });
        console.log('✅ SMS sent successfully!');
        console.log('   Message SID:', message.sid);
        console.log('   Status:', message.status);
        
    } catch (error) {
        console.error('❌ Twilio Error:');
        console.error('   Code:', error.code);
        console.error('   Message:', error.message);
        console.error('   Status:', error.status);
        
        // Common error codes and solutions
        if (error.code === 20003) {
            console.error('\n🔧 SOLUTION: Your credentials are WRONG');
            console.error('   - Go to https://console.twilio.com');
            console.error('   - Copy your Account SID and Auth Token');
            console.error('   - Update your .env file');
        } else if (error.code === 20404) {
            console.error('\n🔧 SOLUTION: Phone number not found');
            console.error('   - Check TWILIO_PHONE_FROM in .env');
            console.error('   - Make sure you bought this number in Twilio');
        } else if (error.code === 21211) {
            console.error('\n🔧 SOLUTION: Invalid "To" phone number');
            console.error('   - Check TWILIO_PHONE_TO format');
            console.error('   - Must include country code (e.g., +1234567890)');
        } else if (error.code === 21610) {
            console.error('\n🔧 SOLUTION: Unverified phone number');
            console.error('   - For trial accounts, verify your number first');
            console.error('   - Go: https://console.twilio.com/verify');
        }
    }
}

test();