#!/usr/bin/env node

/**
 * Authentication System Test Suite
 * 
 * This script tests the complete authentication flow, database integration,
 * and subscription logic for the Canar SaaS application.
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TEST_USER = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'testpassword123'
};

class AuthTestSuite {
  constructor() {
    this.session = null;
    this.testResults = [];
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async test(testName, testFn) {
    try {
      await testFn();
      this.testResults.push({ name: testName, status: 'PASS' });
      await this.log(`Test PASSED: ${testName}`, 'success');
    } catch (error) {
      this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
      await this.log(`Test FAILED: ${testName} - ${error.message}`, 'error');
    }
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.session ? { 'Authorization': `Bearer ${this.session}` } : {}),
        ...options.headers
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.text();
    
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = { raw: data };
    }

    return { response, data: jsonData };
  }

  async runTests() {
    await this.log('🚀 Starting Authentication System Test Suite');
    await this.log(`Testing against: ${BASE_URL}`);

    // Test 1: Health Check
    await this.test('Health Check', async () => {
      const { response } = await this.makeRequest('/api/auth/health');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    // Test 2: Database Connection
    await this.test('Database Connection', async () => {
      const { response } = await this.makeRequest('/api/user');
      // Should return 401 (unauthorized) not 500 (server error)
      if (response.status === 500) {
        throw new Error('Database connection failed');
      }
    });

    // Test 3: User Registration
    await this.test('User Registration', async () => {
      const { response, data } = await this.makeRequest('/api/register', {
        method: 'POST',
        body: JSON.stringify(TEST_USER)
      });

      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Registration response missing success flag');
      }

      if (!data.user || !data.user.id) {
        throw new Error('Registration response missing user data');
      }
    });

    // Test 4: User Login
    await this.test('User Login', async () => {
      const { response, data } = await this.makeRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify({
          username: TEST_USER.email,
          password: TEST_USER.password
        })
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Login response missing success flag');
      }

      if (!data.user || !data.user.id) {
        throw new Error('Login response missing user data');
      }

      // Store session/token for subsequent tests
      if (data.token) {
        this.session = data.token;
        await this.log('JWT token received and stored');
      } else {
        await this.log('Session-based authentication detected');
      }
    });

    // Test 5: Get User Info
    await this.test('Get User Info', async () => {
      const { response, data } = await this.makeRequest('/api/user');

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('User info response missing success flag');
      }

      if (!data.user || !data.user.id) {
        throw new Error('User info response missing user data');
      }

      if (data.user.email !== TEST_USER.email) {
        throw new Error('User email mismatch');
      }
    });

    // Test 6: Get Subscription Plans
    await this.test('Get Subscription Plans', async () => {
      const { response, data } = await this.makeRequest('/api/subscription/plans');

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Plans response missing success flag');
      }

      if (!Array.isArray(data.plans)) {
        throw new Error('Plans response missing plans array');
      }

      if (data.plans.length === 0) {
        throw new Error('No subscription plans found');
      }

      // Validate plan structure
      const plan = data.plans[0];
      if (!plan.id || !plan.name || !plan.price || !plan.credits) {
        throw new Error('Invalid plan structure');
      }
    });

    // Test 7: Get Credits (No Subscription)
    await this.test('Get Credits (No Subscription)', async () => {
      const { response, data } = await this.makeRequest('/api/credits');

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Credits response missing success flag');
      }

      if (data.hasActiveSubscription !== false) {
        throw new Error('Expected no active subscription');
      }

      if (data.creditsRemaining !== 0) {
        throw new Error('Expected 0 credits for new user');
      }
    });

    // Test 8: Create Subscription
    await this.test('Create Subscription', async () => {
      const { response, data } = await this.makeRequest('/api/subscription/subscribe', {
        method: 'POST',
        body: JSON.stringify({ planType: 'basic' })
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Subscription response missing success flag');
      }

      if (!data.subscription || !data.subscription.id) {
        throw new Error('Subscription response missing subscription data');
      }

      if (data.subscription.planType !== 'Basic') {
        throw new Error('Invalid plan type in subscription');
      }

      if (data.subscription.creditsAllocated !== 500) {
        throw new Error('Invalid credits allocated for basic plan');
      }
    });

    // Test 9: Get Credits (With Subscription)
    await this.test('Get Credits (With Subscription)', async () => {
      const { response, data } = await this.makeRequest('/api/credits');

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Credits response missing success flag');
      }

      if (data.hasActiveSubscription !== true) {
        throw new Error('Expected active subscription');
      }

      if (data.creditsRemaining !== 500) {
        throw new Error(`Expected 500 credits, got ${data.creditsRemaining}`);
      }

      if (data.planType !== 'Basic') {
        throw new Error('Invalid plan type');
      }
    });

    // Test 10: Update Profile (Should Deduct Credits)
    await this.test('Update Profile (Credit Deduction)', async () => {
      const profileData = {
        name: 'Test User',
        email: TEST_USER.email,
        bio: 'Test bio'
      };

      const { response, data } = await this.makeRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Profile update response missing success flag');
      }

      if (!data.profile || !data.profile.id) {
        throw new Error('Profile update response missing profile data');
      }

      if (data.profile.name !== profileData.name) {
        throw new Error('Profile name not updated correctly');
      }
    });

    // Test 11: Verify Credits Deducted
    await this.test('Verify Credits Deducted', async () => {
      const { response, data } = await this.makeRequest('/api/credits');

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (data.creditsRemaining !== 495) {
        throw new Error(`Expected 495 credits after deduction, got ${data.creditsRemaining}`);
      }
    });

    // Test 12: Get Profile
    await this.test('Get Profile', async () => {
      const { response, data } = await this.makeRequest('/api/profile');

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Profile response missing success flag');
      }

      if (!data.profile || !data.profile.id) {
        throw new Error('Profile response missing profile data');
      }

      if (data.profile.name !== 'Test User') {
        throw new Error('Profile name mismatch');
      }
    });

    // Test 13: Add Education (Credit Deduction)
    await this.test('Add Education (Credit Deduction)', async () => {
      const educationData = {
        degree: 'Bachelor of Science',
        university: 'Test University',
        duration: '2018-2022'
      };

      const { response, data } = await this.makeRequest('/api/education', {
        method: 'POST',
        body: JSON.stringify(educationData)
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Education response missing success flag');
      }

      if (!data.education || !data.education.id) {
        throw new Error('Education response missing education data');
      }
    });

    // Test 14: Verify More Credits Deducted
    await this.test('Verify More Credits Deducted', async () => {
      const { response, data } = await this.makeRequest('/api/credits');

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (data.creditsRemaining !== 490) {
        throw new Error(`Expected 490 credits after second deduction, got ${data.creditsRemaining}`);
      }
    });

    // Test 15: Logout
    await this.test('Logout', async () => {
      const { response, data } = await this.makeRequest('/api/logout', {
        method: 'POST'
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        throw new Error('Logout response missing success flag');
      }

      // Clear session
      this.session = null;
    });

    // Test 16: Verify Logout (Cannot Access Protected Endpoints)
    await this.test('Verify Logout (Cannot Access Protected Endpoints)', async () => {
      const { response } = await this.makeRequest('/api/user');

      if (response.status !== 401) {
        throw new Error(`Expected 401 after logout, got ${response.status}`);
      }
    });

    // Test 17: Tenant Isolation Test
    await this.test('Tenant Isolation Test', async () => {
      // Create a second user
      const secondUser = {
        email: 'test2@example.com',
        username: 'testuser2',
        password: 'testpassword123'
      };

      // Register second user
      const { response: regResponse } = await this.makeRequest('/api/register', {
        method: 'POST',
        body: JSON.stringify(secondUser)
      });

      if (regResponse.status !== 201) {
        throw new Error('Failed to register second user for isolation test');
      }

      // Login as second user
      const { response: loginResponse, data: loginData } = await this.makeRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify({
          username: secondUser.email,
          password: secondUser.password
        })
      });

      if (loginResponse.status !== 200) {
        throw new Error('Failed to login as second user');
      }

      // Store second user's session
      const secondUserSession = loginData.token;

      // Try to access first user's data with second user's session
      const { response: isolationResponse } = await this.makeRequest('/api/profile', {
        headers: { 'Authorization': `Bearer ${secondUserSession}` }
      });

      // Should not be able to access first user's data
      if (isolationResponse.status === 200) {
        throw new Error('Tenant isolation failed - second user can access first user data');
      }
    });

    await this.log('🎉 Test suite completed!');
    await this.printResults();
  }

  async printResults() {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = total - passed;

    await this.log('\n📊 Test Results Summary:');
    await this.log(`Total Tests: ${total}`);
    await this.log(`Passed: ${passed}`, passed === total ? 'success' : 'info');
    await this.log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info');

    if (failed > 0) {
      await this.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => this.log(`  - ${r.name}: ${r.error}`, 'error'));
    }

    if (passed === total) {
      await this.log('\n🎉 All tests passed! The authentication system is working correctly.', 'success');
    } else {
      await this.log('\n⚠️  Some tests failed. Please review the errors above.', 'error');
    }
  }
}

// Run the test suite
async function main() {
  const testSuite = new AuthTestSuite();
  await testSuite.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = AuthTestSuite;

