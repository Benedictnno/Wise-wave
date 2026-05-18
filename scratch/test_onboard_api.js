// Using native fetch

async function testOnboard() {
    const payload = {
        companyName: "Test Partner Onboarding Corp",
        contactName: "Onboarding Contact",
        email: `onboard_${Date.now()}@test.com`,
        phone: "07700900000",
        categories: ["641234567890abcdef123456"], // temporary invalid MongoDB ID or we can find a real one
        postcodes: ["SW1A", "EC1A"],
        agreementAccepted: true,
        preferredContactMethod: "email"
    };

    console.log("Sending onboarding payload...");
    try {
        const res = await fetch("http://localhost:5000/api/partners/onboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log("Response:", data);
    } catch (err) {
        console.error("Fetch error:", err.message);
    }
}

testOnboard();
