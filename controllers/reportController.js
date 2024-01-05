//controllers/reportController.js

const ReportAbuse = require('../models/ReportAbuse');
const Impact = require('../models/Impact'); 
const Notification = require('../models/Notification');

exports.reportAbuse = async (req, res) => {
    const { impactId, reportContent } = req.body;
    const reportedBy = req.user;

    // Validation: check if all necessary fields are filled
    if (!impactId || !reportContent.trim()) {
        return res.status(400).json({ message: "Please ensure all fields are filled." });
    }

    try {
        // Ensure the impact exists
        const impact = await Impact.findById(impactId);
        if (!impact) {
            return res.status(404).json({ message: "Impact not found" });
        }

        // Check if user already has a pending report for this impact
        const existingReport = await ReportAbuse.findOne({
            Impact: impactId,
            reportedBy,
            status: 'pending'
        });

        if (existingReport) {
            return res.status(409).json({ message: "You already have a pending report for this impact." });
        }

        // Create new report abuse record
        const newReport = new ReportAbuse({
            Impact: impactId,
            reportedBy,
            reportContent
        });

        await newReport.save();

        // Trigger a notification for user about report queueing
        const newNotification = new Notification({
            user: reportedBy,
            text: 'Your report is queued and will be reviewed shortly.',
            type: 'Info', // or another appropriate type
        });

        await newNotification.save();

        // Send response
        res.status(201).json({ message: "Report abuse submitted and queued for review." });
    } catch (error) {
        console.error("Error reporting abuse: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
