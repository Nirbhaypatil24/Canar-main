// Test script to verify authentication functionality
const API_BASE = 'http://localhost:5000';

async function testRegistration() {
    console.log('Testing registration...');
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'password123';
    
    try {
        const response = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });
        
        const data = await response.json();
        console.log('Registration result:', response.status, data);
        
        if (response.ok) {
            console.log('✅ Registration successful');
            return { email: testEmail, password: testPassword, user: data };
        } else {
            console.log('❌ Registration failed');
            return null;
        }
    } catch (error) {
        console.error('Registration error:', error);
        return null;
    }
}

async function testLogin(email, password) {
    console.log('Testing login...');
    
    try {
        const response = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: email,
                password: password
            })
        });
        
        const data = await response.json();
        console.log('Login result:', response.status, data);
        
        if (response.ok) {
            console.log('✅ Login successful');
            return true;
        } else {
            console.log('❌ Login failed');
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        return false;
    }
}

async function testCompleteFlow() {
    console.log('🚀 Starting complete authentication test...\n');
    
    // Test registration
    const regResult = await testRegistration();
    if (!regResult) {
        console.log('❌ Registration test failed, stopping tests');
        return;
    }
    
    console.log('\n');
    
    // Test login
    const loginResult = await testLogin(regResult.email, regResult.password);
    if (!loginResult) {
        console.log('❌ Login test failed');
        return;
    }
    
    console.log('\n✅ All authentication tests passed!');
    console.log('Backend is working correctly');
    console.log('\nIf frontend forms are not working, check:');
    console.log('1. Browser console for JavaScript errors');
    console.log('2. Input field CSS for pointer-events or user-select issues');
    console.log('3. Form validation preventing input');
    console.log('4. React Hook Form configuration');
}

testCompleteFlow();