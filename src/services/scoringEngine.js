/**
 * Scoring Engine for WiseMove Connect Leads
 */

const Lead = require('../models/Lead');

const calculateScore = (reqBody) => {
    let score = 0;
    const breakdown = {
        urgency: 0,
        budget: 0,
        intentSignals: 0,
        contactability: 0,
        additionalDetails: 0,
        postcodeCoverage: 10, // Assuming 10 for now, could be dynamic later based on routing
        serviceMatch: 10      // Assuming 10 for now
    };

    // Urgency (Max 20)
    switch(reqBody.urgency) {
        case 'asap': breakdown.urgency = 20; break;
        case '48_hours': breakdown.urgency = 15; break;
        case '1_week': breakdown.urgency = 10; break;
        case '1_2_months': breakdown.urgency = 5; break;
        default: breakdown.urgency = 0; break;
    }

    // Budget (Max 15)
    switch(reqBody.budget) {
        case '5000_plus': breakdown.budget = 15; break;
        case '1000_4999': breakdown.budget = 10; break;
        case '500_999': breakdown.budget = 5; break;
        case '1_499': breakdown.budget = 2; break;
        default: breakdown.budget = 0; break;
    }

    // Intent Signals (Max 15)
    if (reqBody.intentSignals) {
        let intentScore = 0;
        if (reqBody.intentSignals.hasDate) intentScore += 4;
        if (reqBody.intentSignals.hasPropertyOrBusinessType) intentScore += 4;
        if (reqBody.intentSignals.hasSpecificIssue) intentScore += 4;
        if (reqBody.intentSignals.hasLocationDetail) intentScore += 3;
        breakdown.intentSignals = intentScore;
    }

    // Additional Details (Max 10)
    if (reqBody.additionalDetails) {
        const len = reqBody.additionalDetails.length;
        if (len > 100) breakdown.additionalDetails = 10;
        else if (len > 50) breakdown.additionalDetails = 5;
        else if (len > 10) breakdown.additionalDetails = 2;
    }

    // Contactability (Max 20) - based on provided info and valid email/phone (mocking validation score)
    let contactScore = 0;
    if (reqBody.phone) contactScore += 10;
    if (reqBody.email) contactScore += 10;
    breakdown.contactability = contactScore;

    // Calculate total
    score = Object.values(breakdown).reduce((acc, curr) => acc + curr, 0);

    return { score, breakdown };
};

const checkRedFlags = async (reqBody) => {
    const redFlags = [];

    // Disposable email check (mock list)
    const disposableDomains = ['tempmail.com', '10minutemail.com', 'throwaway.com', 'mailinator.com'];
    if (reqBody.email) {
        const domain = reqBody.email.split('@')[1];
        if (disposableDomains.includes(domain)) {
            redFlags.push('Disposable or temporary email address detected');
        }
    }

    // Suspicious keywords
    const suspiciousKeywords = ['test', 'spam', 'hack', 'viagra', 'crypto_alert'];
    if (reqBody.additionalDetails) {
        const lowerDetails = reqBody.additionalDetails.toLowerCase();
        if (suspiciousKeywords.some(keyword => lowerDetails.includes(keyword))) {
            redFlags.push('Suspicious keywords in additionalDetails');
        }
    }

    // Postcode format check (basic UK)
    const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
    if (reqBody.homePostcode && !ukPostcodeRegex.test(reqBody.homePostcode)) {
        redFlags.push('Postcode not recognised or invalid UK format');
    }

    // Phone format check (basic)
    const phoneRegex = /^[0-9\s\+\-\(\)]{10,15}$/;
    if (reqBody.phone && !phoneRegex.test(reqBody.phone)) {
        redFlags.push('Phone number fails format validation');
    }

    // Time on page / Form Completion Rate
    if (reqBody.timeOnPage !== undefined && reqBody.timeOnPage < 5) {
        redFlags.push('Time on page below bot-detection threshold');
    }
    if (reqBody.formCompletionRate !== undefined && reqBody.formCompletionRate < 0.5) {
        redFlags.push('Form completion rate below bot-detection threshold');
    }

    // Duplicate submission detected
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userDuplicate = await Lead.findOne({
        service_type: reqBody.serviceType,
        created_at: { $gte: twentyFourHoursAgo }
    }).populate({
        path: 'user_id',
        match: { email: reqBody.email.toLowerCase() }
    });

    if (userDuplicate && userDuplicate.user_id) {
        redFlags.push('Duplicate submission detected within session window');
    }

    return redFlags;
};

const determineCategory = (score) => {
    if (score >= 80) return 'premium';
    if (score >= 60) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
};

const scoreLead = async (lead, reqBody) => {
    const redFlags = await checkRedFlags(reqBody);
    const { score, breakdown } = calculateScore(reqBody);

    let leadCategory = determineCategory(score);
    if (redFlags.length > 0) {
        leadCategory = 'manual_review';
    }

    return {
        leadScore: score,
        leadCategory,
        redFlags,
        scoringBreakdown: breakdown
    };
};

module.exports = { scoreLead };
