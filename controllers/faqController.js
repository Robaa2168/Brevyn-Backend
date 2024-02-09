//controllers/faqController.js

const Faq = require('../models/Faq'); 
const sanitizeHtml = require('sanitize-html');

exports.postFaq = async (req, res) => {
    let { question, answer, category } = req.body;

    // Validate the input
    if (!question || !answer || !category) {
        return res.status(400).json({ message: 'Question, answer, and category are required.' });
    }

    // Sanitize HTML content to prevent XSS attacks
    answer = sanitizeHtml(answer, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']) // Customize allowed tags as needed
    });

    try {
        const newFaq = new Faq({ question, answer, category }); // Include category in the new FAQ
        await newFaq.save();
        res.status(201).json({ message: 'FAQ created successfully', faq: newFaq });
    } catch (error) {
        res.status(500).json({ message: 'Error creating FAQ', error: error.message });
    }
};


exports.getFaqs = async (req, res) => {
    try {
        const faqs = await Faq.find({ category: 'Transaction' }); 
        res.status(200).json(faqs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching FAQs', error: error.message });
    }
};



exports.updateFaq = async (req, res) => {
    const { id } = req.params;
    const { question, answer } = req.body;

    // Validate the input
    if (!question || !answer) {
        return res.status(400).json({ message: 'Both question and answer are required.' });
    }

    try {
        const updatedFaq = await Faq.findByIdAndUpdate(id, { question, answer }, { new: true });
        if (!updatedFaq) {
            return res.status(404).json({ message: 'FAQ not found' });
        }
        res.status(200).json(updatedFaq);
    } catch (error) {
        res.status(500).json({ message: 'Error updating FAQ', error: error.message });
    }
};


exports.deleteFaq = async (req, res) => {
    const { id } = req.params;

    try {
        const deletedFaq = await Faq.findByIdAndDelete(id);
        if (!deletedFaq) {
            return res.status(404).json({ message: 'FAQ not found' });
        }
        res.status(200).json({ message: 'FAQ deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting FAQ', error: error.message });
    }
};

exports.getFaqById = async (req, res) => {
    const { id } = req.params;

    try {
        const faq = await Faq.findById(id);
        if (!faq) {
            return res.status(404).json({ message: 'FAQ not found' });
        }
        res.status(200).json(faq);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching FAQ', error: error.message });
    }
};