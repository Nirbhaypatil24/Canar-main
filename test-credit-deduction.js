const fetch = require("node-fetch");

async function testCreditDeduction() {
  const baseUrl = "http://localhost:3000";

  try {
    console.log("🧪 Testing Credit Deduction System...\n");

    // Step 1: Check initial credits
    console.log("1. Checking initial credits...");
    const creditsResponse = await fetch(`${baseUrl}/api/credits`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=test-session", // For bypass mode
      },
    });

    const creditsData = await creditsResponse.json();
    console.log(`   Initial credits: ${creditsData.creditsRemaining}`);

    if (creditsData.creditsRemaining < 5) {
      console.log(
        "   ❌ Insufficient credits to test. Need at least 5 credits."
      );
      return;
    }

    // Step 2: Update profile (should deduct 5 credits)
    console.log("\n2. Updating profile...");
    const updateResponse = await fetch(`${baseUrl}/api/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=test-session",
      },
      body: JSON.stringify({
        name: "Test User Updated",
        email: "test@example.com",
        bio: "Updated bio for testing",
      }),
    });

    const updateData = await updateResponse.json();

    if (updateResponse.ok) {
      console.log("   ✅ Profile updated successfully");
      console.log(
        `   Credits remaining after update: ${updateData.creditsRemaining}`
      );

      if (updateData.creditsRemaining === creditsData.creditsRemaining - 5) {
        console.log("   ✅ Credit deduction working correctly");
      } else {
        console.log("   ❌ Credit deduction failed - unexpected credit amount");
      }
    } else {
      console.log(`   ❌ Profile update failed: ${updateData.message}`);
    }

    // Step 3: Try to update again with insufficient credits
    console.log("\n3. Testing insufficient credits scenario...");
    const insufficientCreditsResponse = await fetch(`${baseUrl}/api/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=test-session",
      },
      body: JSON.stringify({
        name: "Should Fail",
        email: "fail@example.com",
      }),
    });

    const insufficientData = await insufficientCreditsResponse.json();

    if (insufficientCreditsResponse.status === 403) {
      console.log("   ✅ Correctly blocked due to insufficient credits");
      console.log(`   Error message: ${insufficientData.message}`);
    } else {
      console.log("   ❌ Should have been blocked due to insufficient credits");
    }

    console.log("\n🎉 Credit deduction test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testCreditDeduction();
