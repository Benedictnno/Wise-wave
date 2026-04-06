/**
 * Routing Engine for WiseMove Connect Leads
 */

const Partner = require('../models/Partner');
const PartnerService = require('../models/PartnerService');
const LeadPartnerAssignment = require('../models/LeadPartnerAssignment');
const LeadEvent = require('../models/LeadEvent');
const { dispatchNotifications, notifyAdminUnassigned } = require('./notificationEngine');

const getEligiblePartners = async (lead) => {
    // 1. Find all partners authorized for this service_type
    const partnerServices = await PartnerService.find({ service_type: lead.service_type }).select('partner_id').lean();
    const partnerIds = partnerServices.map(ps => ps.partner_id);

    if (partnerIds.length === 0) return [];

    // 2. Filter partners
    // - Active
    // - Coverage area includes the postcode (Basic implementation: either empty coverage = nationwide, or includes the exact postcode or outcode)
    let query = {
        _id: { $in: partnerIds },
        active: true
    };

    const partners = await Partner.find(query).lean();

    // In a real scenario, we'd also check capacity constraints per month
    const eligiblePartners = [];
    for (const partner of partners) {
        // Check Postcode
        // Simplistic match: either no coverage area specified (all OK) or includes prefix
        let postcodeMatch = false;
        if (!partner.coverage_area || partner.coverage_area.length === 0) {
            postcodeMatch = true;
        } else if (lead.property_postcode) {
            const outcode = lead.property_postcode.split(' ')[0];
            postcodeMatch = partner.coverage_area.includes(outcode) || partner.coverage_area.includes(lead.property_postcode);
        } else {
            postcodeMatch = true; // No postcode provided on lead?
        }

        if (postcodeMatch) {
            // Check Capacity (Assumes a simple query to count existing assignments for the month)
            const currentMonthStart = new Date();
            currentMonthStart.setDate(1);
            currentMonthStart.setHours(0, 0, 0, 0);

            const assignedCount = await LeadPartnerAssignment.countDocuments({
                partner_id: partner._id,
                assigned_at: { $gte: currentMonthStart }
            });

            if (assignedCount < partner.max_leads_per_month) {
                // Determine previous rejection to exclude
                const hasRejected = await LeadPartnerAssignment.exists({
                    lead_id: lead._id,
                    partner_id: partner._id,
                    assignment_status: { $in: ['rejected', 'expired'] }
                });

                if (!hasRejected) {
                    eligiblePartners.push(partner);
                }
            }
        }
    }

    return eligiblePartners;
};

const routeLead = async (lead) => {
    const eligiblePartners = await getEligiblePartners(lead);

    if (eligiblePartners.length === 0) {
        lead.status = 'unassigned';
        await lead.save();
        await LeadEvent.create({
            lead_id: lead._id,
            event_type: 'routed',
            event_data: { partnerFound: false }
        });
        
        notifyAdminUnassigned(lead);
        return { success: false, reason: 'no_partner_available' };
    }

    // Select the first eligible one (can implement priority sort here)
    // Example: sort by priority ASC or max remaining capacity
    const selectedPartner = eligiblePartners[0];

    // Assign to partner
    lead.current_partner_id = selectedPartner._id;
    lead.status = 'assigned';
    await lead.save();

    await LeadPartnerAssignment.create({
        lead_id: lead._id,
        partner_id: selectedPartner._id,
        assignment_status: 'assigned',
        assigned_at: new Date()
    });

    await LeadEvent.create({
        lead_id: lead._id,
        event_type: 'routed',
        event_data: { partnerFound: true, partner_id: selectedPartner._id }
    });

    await LeadEvent.create({
        lead_id: lead._id,
        event_type: 'partner_assigned',
        event_data: { partner_id: selectedPartner._id }
    });

    dispatchNotifications(lead, selectedPartner);

    return { success: true, partner: selectedPartner };
};

const fallbackRouteLead = async (lead, previousAssignmentId, rejectionReason) => {
    // 1. Mark previous assignment as rejected/expired
    await LeadPartnerAssignment.findByIdAndUpdate(previousAssignmentId, {
        assignment_status: 'rejected',
        rejection_reason: rejectionReason,
        responded_at: new Date()
    });

    lead.status = 'returned';
    await lead.save();

    await LeadEvent.create({
        lead_id: lead._id,
        event_type: 'partner_rejected',
        event_data: { partner_id: lead.current_partner_id, rejection_reason: rejectionReason }
    });

    // 2. Find next partner
    const result = await routeLead(lead);

    if (result.success) {
        lead.status = 'reassigned';
        await lead.save();
        await LeadEvent.create({
            lead_id: lead._id,
            event_type: 'reassigned',
            event_data: { new_partner_id: result.partner._id }
        });
    }

    return result;
};

module.exports = { routeLead, fallbackRouteLead };
