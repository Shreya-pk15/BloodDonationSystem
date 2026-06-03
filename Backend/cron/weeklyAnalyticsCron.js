const cron = require('node-cron');
const Request = require('../models/Request');
const User = require('../models/User');
const { sendWeeklyAnalyticsEmail } = require('../services/emailService');

// Runs once weekly and emails analytics to admins and hospitals
const startWeeklyAnalyticsCron = (io) => {
  // '0 0 * * 0' runs at 00:00 (midnight) every Sunday
  cron.schedule('0 0 * * 0', async () => {
    try {
      const totalDonors = await User.countDocuments({ role: 'donor' });
      const totalHospitals = await User.countDocuments({ role: 'hospital' });

      const requests = await Request.find();
      const totalRequests = requests.length;
      const completedRequests = requests.filter(r => r.status === 'completed' || r.status === 'fulfilled').length;

      const bgMap = {};
      requests.forEach(r => { bgMap[r.bloodGroup] = (bgMap[r.bloodGroup] || 0) + 1; });

      let mostRequestedBg = 'None';
      let maxCount = 0;
      for (const bg in bgMap) {
        if (bgMap[bg] > maxCount) {
          maxCount = bgMap[bg];
          mostRequestedBg = bg;
        }
      }

      const stats = {
        totalDonors,
        totalHospitals,
        totalRequests,
        completedRequests,
        mostRequestedBloodGroup: mostRequestedBg,
      };

      // Send to all admins and verified hospitals
      const admins = await User.find({ role: 'admin' });
      const hospitals = await User.find({ role: 'hospital', isVerified: true });

      const recipients = [...admins, ...hospitals];

      for (const r of recipients) {
        try {
          await sendWeeklyAnalyticsEmail(r, stats);
        } catch (emailErr) {
          console.error('Weekly analytics email failed for', r.email, emailErr.message);
        }
      }

      console.log('Weekly analytics email job completed.');
    } catch (err) {
      console.error('Weekly analytics cron error:', err.message);
    }
  });
};

module.exports = startWeeklyAnalyticsCron;
