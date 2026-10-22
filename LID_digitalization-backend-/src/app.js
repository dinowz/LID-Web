const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const masterRoutes = require('./routes/master.routes');
const inquiryRoutes = require('./routes/inquiry.routes');
const quotationRoutes = require('./routes/quotation.routes');
const poRoutes = require('./routes/po.routes');
const serviceRoutes = require('./routes/service.routes');
const tfsRoutes = require('./routes/tfs.routes');
const projectRoutes = require('./routes/project.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const deliveryRoutes = require('./routes/delivery.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const fileRoutes = require('./routes/file.routes');
const eventRoutes = require('./routes/events.route');
const targetRoutes = require('./routes/target.routes');
const { startInquiryReminderJob } = require('./jobs/inquiryReminderJob');
const { startQuotationReminderJob } = require('./jobs/quotationReminderJob');
const { startPOReminderJob } = require('./jobs/poReminderJob');
const { startExecutionReminderJob } = require('./jobs/executionReminderJob');
const { startReadyToInvoiceReminderJob } = require('./jobs/readyToInvoiceReminderJob');
const { startDeliveryReminderJob } = require('./jobs/deliveryReminderJob');
const { startTFSReminderJob } = require('./jobs/tfsReminderJob');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin/master', masterRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/po', poRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/tfs', tfsRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/targets', targetRoutes);

// Start cron jobs (Disabled)
// startDeliveryOverdueJob();
// startServiceAutoInvoiceJob();
startInquiryReminderJob();
startQuotationReminderJob();
startPOReminderJob();
startExecutionReminderJob();
startReadyToInvoiceReminderJob();
startDeliveryReminderJob();
startTFSReminderJob();

// Mengajari JSON.stringify cara membaca BigInt
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Internal Business Digitalization API Endpoint' });
});

module.exports = app;
