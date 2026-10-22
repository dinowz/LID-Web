const quotationService = require('../services/quotation.service');
const inquiryService = require('../services/inquiry.service');
const { broadcast } = require('../utils/sseEmitter');



const getQuotations = async (req, res) => {
  try {
    const data = await quotationService.getQuotations(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getQuotationById = async (req, res) => {
  try {
    const data = await quotationService.getQuotationById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Quotation not found' });
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const prepareQuotationFromInquiry = async (req, res) => {
  try {
    const prisma = require('../config/prisma');
    const inquiryId = req.params.inquiryId;
    const inquiry = await inquiryService.getInquiryById(inquiryId);
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });

    // Look for previous REVERTED quotation to prefill calculation parameters
    const previousQuotation = await prisma.quotation.findFirst({
      where: {
        inquiryId: BigInt(inquiryId),
        status: 'REJECTED',
        lossReason: 'REVERTED_TO_INQUIRY'
      },
      include: {
        details: true,
        sparePartDetail: true,
        serviceDetail: true,
        projectDetail: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const response = {
      ...inquiry,
      prefilledQuotation: previousQuotation ? JSON.parse(JSON.stringify(previousQuotation, (k, v) => typeof v === 'bigint' ? v.toString() : v)) : null
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createQuotationFromInquiry = async (req, res) => {
  try {
    const inquiryId = req.params.inquiryId;
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === Role-based type gating ===
    const inquiry = await inquiryService.getInquiryById(inquiryId);
    if (inquiry) {
      if (inquiry.requestType.startsWith('SPARE_PART') && !userRoles.some(r => ['ADMIN', 'SPARE_PART'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin membuat Quotation untuk Spare Part Inquiry.' });
      }
      if (inquiry.requestType.startsWith('SERVICE_') && !userRoles.some(r => ['ADMIN', 'SERVICE'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin membuat Quotation untuk Service Inquiry.' });
      }
    }

    const data = await quotationService.createQuotationFromInquiry(inquiryId, req.body, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const revertQuotationToInquiry = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === Role-based type gating ===
    const quotation = await quotationService.getQuotationById(req.params.id);
    if (quotation) {
      const inquiryType = quotation.inquiry?.requestType || '';
      if (inquiryType.startsWith('SPARE_PART') && !userRoles.some(r => ['ADMIN', 'SPARE_PART'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin merevert Spare Part Quotation.' });
      }
      if (inquiryType.startsWith('SERVICE_') && !userRoles.some(r => ['ADMIN', 'SERVICE'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin merevert Service Quotation.' });
      }
    }

    const inquiryId = await quotationService.revertQuotationToInquiry(req.params.id, userId, req.body.reason);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json({ inquiryId: inquiryId.toString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


const updateQuotation = async (req, res) => {
  try {
    const prisma = require('../config/prisma');
    const { status, remarks, details, basePrice, totalPrice, lossReason, lossDetail } = req.body;
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === Role-based type gating ===
    const quotation = await quotationService.getQuotationById(req.params.id);
    if (quotation) {
      const inquiryType = quotation.inquiry?.requestType || '';
      if (inquiryType.startsWith('SPARE_PART') && !userRoles.some(r => ['ADMIN', 'SPARE_PART'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin mengedit Spare Part Quotation.' });
      }
      if (inquiryType.startsWith('SERVICE_') && !userRoles.some(r => ['ADMIN', 'SERVICE'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin mengedit Service Quotation.' });
      }
    }

    // If full data is provided (e.g. details or basePrice), use the deep update service
    if (details || basePrice !== undefined || totalPrice !== undefined) {
      const data = await quotationService.updateQuotationData(req.params.id, req.body, userId);
      broadcast({ type: 'REFRESH_BADGE' });
      return res.json(data);
    }

    // Otherwise, handle simple status/remarks update (legacy logic)
    const data = await prisma.$transaction(async (tx) => {
      const current = await tx.quotation.findUnique({
        where: { id: BigInt(req.params.id) },
        include: { purchaseOrders: true }
      });

      if (!current) throw new Error('Quotation not found');

      // Status Logic Enforcement
      if (status && status !== current.status) {
        if (current.status === 'REALIZED' || current.status === 'CLOSE_LOSS') {
          throw new Error(`Cannot change status from ${current.status}`);
        }
        
        // Only allow DRAFT -> SENT or any non-final -> CLOSE_LOSS
        if (current.status === 'DRAFT' && status !== 'SENT' && status !== 'CLOSE_LOSS') {
          throw new Error('DRAFT quotation can only be changed to SENT or CLOSE_LOSS');
        }
      }

      const now = new Date();
      const updated = await tx.quotation.update({
        where: { id: BigInt(req.params.id) },
        data: {
          ...(status && { status }),
          ...(remarks !== undefined && { remarks }),
          ...(status === 'CLOSE_LOSS' && {
            lossReason: lossReason || null,
            lossDetail: lossDetail || null
          }),
          lastActivityAt: now,
          ...(status && status !== current.status && { statusChangedAt: now }),
          updatedBy: userId ? Number(userId) : null
        },
        include: {
          details: true,
          purchaseOrders: true,
          inquiry: { include: { customer: true, codeWord: true } },
          sparePartDetail: true,
          serviceDetail: true,
          projectDetail: true,
          creator: true
        }
      });

      // Record History if status changed
      if (status && status !== current.status) {
        let note = `Status changed to ${status}`;
        if (status === 'CLOSE_LOSS' && lossReason) {
          note = `Closed Loss: [${lossReason}] ${lossDetail || ''}`;
        }
        await tx.quotationStatusHistory.create({
          data: {
            quotationId: updated.id,
            oldStatus: current.status,
            newStatus: status,
            changeNote: note,
            changedBy: userId ? Number(userId) : null
          }
        });
      }

      // Auto-create PO when status becomes REALIZED and no PO exists yet.
      // With mixed external service, all SERVICE_EXTERNAL inquiries now go through PO flow.
      if (status === 'REALIZED' && (!updated.purchaseOrders || updated.purchaseOrders.length === 0)) {
        const isSparepart = updated.quotationType === 'SPARE_PART' || (!updated.quotationType && !updated.serviceDetail && !updated.projectDetail);
        let poType = 'SPARE_PART';
        if (updated.quotationType === 'SERVICE' || updated.serviceDetail) poType = 'SERVICE';
        if (updated.quotationType === 'PROJECT' || updated.projectDetail) poType = 'PROJECT';

        const poDetails = updated.details.map(d => {
          const qty = Number(d.qty || 1);
          const sellPrice = Number(d.sellPriceCalc || 0);
          const effectiveTotalPrice = (isSparepart && sellPrice > 0) ? Math.round(sellPrice) : Number(d.totalPrice || 0);
          const effectiveUnitPrice = (isSparepart && sellPrice > 0 && qty > 0) ? Math.round(sellPrice / qty) : Number(d.unitPrice || 0);

          return {
            quotationDetailId: d.id,
            itemType: d.itemType,
            qty: d.qty,
            unitPrice: effectiveUnitPrice,
            totalPrice: effectiveTotalPrice,
            note: d.note,
            ...(d.mappedServiceId && { service: { connect: { id: d.mappedServiceId } } }),
            ...(d.mappedSparePartId && { sparePart: { connect: { id: d.mappedSparePartId } } }),
          };
        });

        const newPo = await tx.purchaseOrder.create({
          data: {
            quotation: { connect: { id: updated.id } },
            status: 'REVIEW',
            poType,
            netValue: updated.totalPrice,
            currency: updated.currency,
            exchangeRate: updated.exchangeRate,
            codeWord: updated.inquiry?.codeWord?.code || null,
            salesOrganization: updated.creator?.name || 'System Generated',
            hasDp: Boolean(updated.sparePartDetail?.hasDp),
            dpPercent: updated.sparePartDetail?.hasDp ? (updated.sparePartDetail?.dpPercent || 0) : 0,
            dpAmount: updated.sparePartDetail?.hasDp ? (updated.sparePartDetail?.dpAmount || 0) : 0,
            createdBy: userId ? Number(userId) : null,
            details: { create: poDetails },
          },
        });

        if (poType === 'SPARE_PART') {
          await tx.purchaseOrderSparePart.create({
            data: { poId: newPo.id, shipToPartyName: updated.inquiry?.customer?.name || null }
          });
        } else if (poType === 'SERVICE') {
          await tx.purchaseOrderService.create({ data: { poId: newPo.id } });
        } else if (poType === 'PROJECT') {
          await tx.purchaseOrderProject.create({ data: { poId: newPo.id } });
        }
      }

      return {
        ...updated,
        purchaseOrder: updated.purchaseOrders?.[0] || null
      };
    });

    broadcast({ type: 'REFRESH_BADGE' });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const downloadQuotationPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const { pdfBuffer, filename } = await quotationService.generateQuotationPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    res.status(500).json({ error: error.message || 'Failed to generate PDF' });
  }
};

const deleteQuotation = async (req, res) => {
  try {
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === Role-based type gating ===
    const quotation = await quotationService.getQuotationById(req.params.id);
    if (quotation) {
      const inquiryType = quotation.inquiry?.requestType || '';
      if (inquiryType.startsWith('SPARE_PART') && !userRoles.some(r => ['ADMIN', 'SPARE_PART'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus Spare Part Quotation.' });
      }
      if (inquiryType.startsWith('SERVICE_') && !userRoles.some(r => ['ADMIN', 'SERVICE'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus Service Quotation.' });
      }
    }

    await quotationService.deleteQuotation(req.params.id);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: "Cannot delete Quotation because it is already linked to a Purchase Order or Invoice. Please delete the linked data first." 
      });
    }
    res.status(400).json({ error: error.message });
  }
};

const acceptTfsQuotationWithPo = async (req, res) => {
  try {
    const quotationId = req.params.id;
    const userId = req.user ? req.user.id : null;
    
    // Get file path if uploaded
    let customerPoFile = null;
    if (req.file) {
      customerPoFile = `/uploads/po/service/${req.file.filename}`;
    } else {
      return res.status(400).json({ error: 'Customer PO file is required' });
    }

    const data = await quotationService.acceptTfsQuotationWithPo(quotationId, userId, customerPoFile);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getQuotations,
  getQuotationById,
  prepareQuotationFromInquiry,
  createQuotationFromInquiry,
  revertQuotationToInquiry,
  updateQuotation,
  downloadQuotationPdf,
  deleteQuotation,
  acceptTfsQuotationWithPo
};
