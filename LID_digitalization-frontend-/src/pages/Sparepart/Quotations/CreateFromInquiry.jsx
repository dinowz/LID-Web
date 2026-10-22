import React, { useState, useEffect } from 'react';
import {
  Card, Table, Typography, Space, Button, message,
  Select, Input, Switch, InputNumber, Row, Col, Tag, Divider, Tooltip, Collapse, DatePicker
} from 'antd';
import dayjs from 'dayjs';
import { CheckOutlined, ArrowLeftOutlined, InfoCircleOutlined, CalculatorOutlined, LockOutlined, EditOutlined as EditIcon } from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  prepareQuotationFromInquiry,
  createQuotationFromInquiry,
  getQuotationById,
  updateQuotation
} from '../../../services/quotation.service';
import { getServices, getSpareParts } from '../../../services/master.service';
import { getCustomers } from '../../../services/inquiry.service';
import useUnsavedChangesWarning from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';

const { Title, Text } = Typography;
const { Option } = Select;

const ATTENTION_TITLES = ['Mr.', 'Ms.'];
const { Panel } = Collapse;
const BANK_DETAILS_OPTIONS = [
  {
    label: 'HSBC - IDR Account',
    value: 'PT. Loesche Indonesia, HSBC – WTC Branch, Jl. Jend. Sudirman Jakarta, IDR Account No. 050-270123-068',
  },
  {
    label: 'HSBC - EUR Account',
    value: 'PT. Loesche Indonesia, HSBC – WTC Branch, Jl. Jend. Sudirman Jakarta, EUR Account No. 050-270123-116, SWIFT: HSBCIDJA',
  },
  {
    label: 'HSBC - USD Account',
    value: 'PT. Loesche Indonesia, HSBC – WTC Branch, Jl. Jend. Sudirman Jakarta, USD Account No. 050-270123-115, SWIFT: HSBCIDJA',
  },
];

const CreateFromInquiry = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = location.pathname.includes('/edit');
  const isViewOnly = new URLSearchParams(location.search).get('mode') === 'view';

  const [inquiry, setInquiry] = useState(null);
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Data structure for quotation mappings and inputs
  const [mappings, setMappings] = useState({});
  const [quotationMeta, setQuotationMeta] = useState({
    remarks: '',
    margin: 0,
    currency: 'IDR',
    exchangeRate: 1,
    clientInquiryDate: null,
    customerInquiryNumber: '',
    globalDiscount: 0,
    forecast: 'NORMAL',
  });

  const [sparePartDetail, setSparepartDetail] = useState({
    endCustomerId: null,
    location: '',
    projectNo: '',
    additionalInformation: '',
    validityDays: 30,
    attentionTitle: 'Ms.',
    attention: '',
    deliveryDateDesc: '',
    deliveryTerms: '',
    deliveryTermsShort: '',
    paymentTerms: '',
    paymentConditions: '',
    bankDetails: '',
    hasDp: false,
    dpPercent: 20,
    dpAmount: 0,
  });

  const [saving, setSaving] = useState(false);
  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [srvData, sppData, custData] = await Promise.all([
          getServices({ active: true }),
          getSpareParts({ active: true }),
          getCustomers()
        ]);

        setServices(srvData);
        setSpareParts(sppData);
        setCustomers(custData);

        if (isEdit || isViewOnly) {
          // Fetch existing quotation
          const quoData = await getQuotationById(id);
          setQuotation(quoData);
          setInquiry(quoData.inquiry);

          // Map Meta
          setQuotationMeta({
            remarks: quoData.remarks,
            margin: parseFloat(quoData.margin) || 0,
            currency: quoData.currency,
            exchangeRate: parseFloat(quoData.exchangeRate) || 1,
            clientInquiryDate: quoData.clientInquiryDate ? dayjs(quoData.clientInquiryDate) : (quoData.inquiry?.inquiryDate ? dayjs(quoData.inquiry.inquiryDate) : dayjs(quoData.inquiry?.createdAt)),
            customerInquiryNumber: quoData.customerInquiryNumber || '',
            globalDiscount: parseFloat(quoData.globalDiscount) || 0,
            forecast: quoData.forecast || 'NORMAL',
          });

          // Map Sparepart Detail
          if (quoData.sparePartDetail) {
            setSparepartDetail({
              endCustomerId: quoData.sparePartDetail.endCustomerId,
              location: quoData.sparePartDetail.location || quoData.inquiry?.codeWord?.code || '',
              projectNo: quoData.sparePartDetail.projectNo || quoData.inquiry?.codeWord?.projectNo || '',
              additionalInformation: quoData.sparePartDetail.additionalInformation || '',
              validityDays: quoData.sparePartDetail.validityDays,
              attentionTitle: quoData.sparePartDetail.attentionTitle || 'Ms.',
              attention: quoData.sparePartDetail.attention || '',
              deliveryDateDesc: quoData.sparePartDetail.deliveryDateDesc || '',
              deliveryTerms: quoData.sparePartDetail.deliveryTerms || '',
              deliveryTermsShort: quoData.sparePartDetail.deliveryTermsShort || '',
              paymentTerms: quoData.sparePartDetail.paymentTerms || '',
              paymentConditions: quoData.sparePartDetail.paymentConditions || '',
              bankDetails: quoData.sparePartDetail.bankDetails || '',
              hasDp: Boolean(quoData.sparePartDetail.hasDp),
              dpPercent: quoData.sparePartDetail.dpPercent != null ? parseFloat(quoData.sparePartDetail.dpPercent) : 20,
              dpAmount: quoData.sparePartDetail.dpAmount != null ? parseFloat(quoData.sparePartDetail.dpAmount) : 0,
            });
          }

          // Map Details/Mappings — include per-item pricing (fallback to global params for old quotations)
          const globalSp = quoData.sparePartDetail;
          const initialMap = {};
          (quoData.details || []).forEach(d => {
            initialMap[d.inquiryDetailId] = {
              inquiryDetailId: d.inquiryDetailId,
              itemType: d.itemType,
              mappedServiceId: d.mappedServiceId,
              mappedSparePartId: d.mappedSparePartId,
              isAlternative: d.isAlternative,
              unitPrice: parseFloat(d.unitPrice) || 0,
              qty: parseFloat(d.qty) || 1,
              discount: parseFloat(d.discount) || 0,
              note: d.note || '',
              // Per-item pricing — use stored value, or fall back to global sparePartDetail
              vendorSource: d.vendorSource || globalSp?.vendorSource || 'LOG',
              handlingPct: d.handlingPct !== undefined && d.handlingPct !== null ? parseFloat(d.handlingPct) : (parseFloat(globalSp?.handlingPct) ?? 10),
              canonPct: d.canonPct !== undefined && d.canonPct !== null ? parseFloat(d.canonPct) : (parseFloat(globalSp?.canonPct) ?? 0),
              commissionPct: d.commissionPct !== undefined ? parseFloat(d.commissionPct) : (parseFloat(globalSp?.commissionPct) || 0),
              overheadPct: d.overheadPct !== undefined ? parseFloat(d.overheadPct) : (parseFloat(globalSp?.overheadPct) || 0),
              freightPct: d.freightPct !== undefined ? parseFloat(d.freightPct) : (parseFloat(globalSp?.freightPct) || 0),
              customPct: d.customPct !== undefined ? parseFloat(d.customPct) : (parseFloat(globalSp?.customPct) || 0),
            };
          });
          setMappings(initialMap);

        } else {
          // Normal creation from Inquiry (supports auto-prefill from REVERTED quotation)
          const inqData = await prepareQuotationFromInquiry(id);
          setInquiry(inqData);

          const preQuo = inqData.prefilledQuotation;

          // Prefill location and projectNo from codeWord relation or prefilled quotation
          setSparepartDetail(prev => ({
            ...prev,
            endCustomerId: preQuo?.sparePartDetail?.endCustomerId || prev.endCustomerId,
            location: preQuo?.sparePartDetail?.location || inqData.codeWord?.code || '',
            projectNo: preQuo?.sparePartDetail?.projectNo || inqData.codeWord?.projectNo || '',
            additionalInformation: preQuo?.sparePartDetail?.additionalInformation || '',
            validityDays: preQuo?.sparePartDetail?.validityDays || 30,
            attentionTitle: preQuo?.sparePartDetail?.attentionTitle || 'Ms.',
            attention: preQuo?.sparePartDetail?.attention || '',
            deliveryDateDesc: preQuo?.sparePartDetail?.deliveryDateDesc || '',
            deliveryTerms: preQuo?.sparePartDetail?.deliveryTerms || '',
            deliveryTermsShort: preQuo?.sparePartDetail?.deliveryTermsShort || '',
            paymentTerms: preQuo?.sparePartDetail?.paymentTerms || '',
            paymentConditions: preQuo?.sparePartDetail?.paymentConditions || '',
            bankDetails: preQuo?.sparePartDetail?.bankDetails || '',
            hasDp: Boolean(preQuo?.sparePartDetail?.hasDp),
            dpPercent: preQuo?.sparePartDetail?.dpPercent != null ? parseFloat(preQuo.sparePartDetail.dpPercent) : 20,
            dpAmount: preQuo?.sparePartDetail?.dpAmount != null ? parseFloat(preQuo.sparePartDetail.dpAmount) : 0,
          }));

          // Auto-initialize currency based on customer type or prefilled quotation
          const initialCurrency = preQuo?.currency || (inqData.customer?.customerType === 'FOREIGN' ? 'EUR' : 'IDR');
          setQuotationMeta(prev => ({
            ...prev,
            remarks: preQuo?.remarks || prev.remarks,
            margin: preQuo?.margin ? parseFloat(preQuo.margin) : prev.margin,
            currency: initialCurrency,
            exchangeRate: preQuo?.exchangeRate ? parseFloat(preQuo.exchangeRate) : prev.exchangeRate,
            globalDiscount: preQuo?.globalDiscount ? parseFloat(preQuo.globalDiscount) : prev.globalDiscount,
            forecast: preQuo?.forecast || prev.forecast,
            clientInquiryDate: inqData.inquiryDate ? dayjs(inqData.inquiryDate) : dayjs(inqData.createdAt),
            customerInquiryNumber: preQuo?.customerInquiryNumber || prev.customerInquiryNumber,
          }));

          const preDetailsByInqId = {};
          const preDetailsByLineNo = {};
          if (preQuo && Array.isArray(preQuo.details)) {
            preQuo.details.forEach(pd => {
              if (pd.inquiryDetailId) {
                preDetailsByInqId[pd.inquiryDetailId] = pd;
              }
              if (pd.lineNo) {
                preDetailsByLineNo[pd.lineNo] = pd;
              }
            });
          }

          const initialMap = {};
          (inqData.details || []).forEach((d, idx) => {
            const matchedPd = preDetailsByInqId[d.id] || preDetailsByLineNo[d.lineNo || (idx + 1)];
            const globalSp = preQuo?.sparePartDetail;

            // Auto-match spare part dari master berdasarkan Part Number jika belum ter-mapping
            let autoMappedSparePartId = matchedPd?.mappedSparePartId ? String(matchedPd.mappedSparePartId) : null;
            if (!autoMappedSparePartId && d.requestedPartNumber && sppData) {
              const reqPn = d.requestedPartNumber.trim().toLowerCase();
              if (reqPn && reqPn !== '-') {
                const foundSp = sppData.find(sp => sp.partCode?.trim().toLowerCase() === reqPn);
                if (foundSp) {
                  autoMappedSparePartId = String(foundSp.id);
                }
              }
            }

            initialMap[d.id] = {
              inquiryDetailId: d.id,
              itemType: d.itemType,
              mappedServiceId: matchedPd?.mappedServiceId ? String(matchedPd.mappedServiceId) : null,
              mappedSparePartId: autoMappedSparePartId,
              isAlternative: matchedPd?.isAlternative || false,
              unitPrice: matchedPd ? parseFloat(matchedPd.unitPrice) || 0 : 0,
              qty: matchedPd?.qty ? parseFloat(matchedPd.qty) : (parseFloat(d.qty) || 1),
              discount: matchedPd ? parseFloat(matchedPd.discount) || 0 : 0,
              note: matchedPd?.note || '',
              // Per-item pricing defaults from matched detail or prefilled global sparePartDetail
              vendorSource: matchedPd?.vendorSource || globalSp?.vendorSource || 'LOG',
              handlingPct: matchedPd?.handlingPct !== undefined && matchedPd?.handlingPct !== null
                ? parseFloat(matchedPd.handlingPct)
                : (globalSp?.handlingPct !== undefined ? parseFloat(globalSp.handlingPct) : 10),
              canonPct: matchedPd?.canonPct !== undefined && matchedPd?.canonPct !== null
                ? parseFloat(matchedPd.canonPct)
                : (globalSp?.canonPct !== undefined ? parseFloat(globalSp.canonPct) : 0),
              commissionPct: matchedPd?.commissionPct !== undefined
                ? parseFloat(matchedPd.commissionPct)
                : (globalSp?.commissionPct ? parseFloat(globalSp.commissionPct) : 0),
              overheadPct: matchedPd?.overheadPct !== undefined
                ? parseFloat(matchedPd.overheadPct)
                : (globalSp?.overheadPct ? parseFloat(globalSp.overheadPct) : 0),
              freightPct: matchedPd?.freightPct !== undefined
                ? parseFloat(matchedPd.freightPct)
                : (globalSp?.freightPct ? parseFloat(globalSp.freightPct) : 0),
              customPct: matchedPd?.customPct !== undefined
                ? parseFloat(matchedPd.customPct)
                : (globalSp?.customPct ? parseFloat(globalSp.customPct) : 0),
            };
          });
          setMappings(initialMap);
        }
      } catch (err) {
        message.error('Failed to load data for quotation');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleMappingChange = (detailId, field, value) => {
    let finalValue = value;
    setIsDirty(true);
    setMappings(prev => ({
      ...prev,
      [detailId]: {
        ...prev[detailId],
        [field]: finalValue
      }
    }));
  };

  const handleSparepartDetailChange = (field, value) => {
    setIsDirty(true);
    setSparepartDetail(prev => ({ ...prev, [field]: value }));
  };

  const handleDpToggle = (checked) => {
    setIsDirty(true);
    setSparepartDetail(prev => {
      const dpPercent = prev.dpPercent || 20;
      let newPaymentTerms = prev.paymentTerms;
      if (checked && (!prev.paymentTerms || prev.paymentTerms.trim() === '' || prev.paymentTerms.includes('Nett by T/T within 30 days'))) {
        newPaymentTerms = `Down payment ${dpPercent}% upon PO confirmation, balance ${100 - dpPercent}% within 30 days upon delivery and receipt of invoice.`;
      }
      return {
        ...prev,
        hasDp: checked,
        dpPercent: dpPercent,
        paymentTerms: newPaymentTerms,
      };
    });
  };

  const handleDpPercentChange = (val) => {
    setIsDirty(true);
    const num = Number(val) || 0;
    setSparepartDetail(prev => {
      let newPaymentTerms = prev.paymentTerms;
      if (prev.hasDp && prev.paymentTerms && prev.paymentTerms.startsWith('Down payment')) {
        newPaymentTerms = `Down payment ${num}% upon PO confirmation, balance ${100 - num}% within 30 days upon delivery and receipt of invoice.`;
      }
      return {
        ...prev,
        dpPercent: num,
        paymentTerms: newPaymentTerms,
      };
    });
  };

  const applyDpPaymentTermsTemplate = () => {
    setIsDirty(true);
    const pct = sparePartDetail.dpPercent || 20;
    setSparepartDetail(prev => ({
      ...prev,
      paymentTerms: `Down payment ${pct}% upon PO confirmation, balance ${100 - pct}% within 30 days upon delivery and receipt of invoice.`
    }));
  };

  // Helper: get selected spare part master data for a given detail row
  const getSelectedSparePart = (detailId) => {
    const selectedId = mappings[detailId]?.mappedSparePartId;
    if (!selectedId) return null;
    return spareParts.find(s => s.id === selectedId || String(s.id) === String(selectedId)) || null;
  };

  // Auto-fill Handling & Canon based on vendor source for a specific item
  const applyVendorSourceForItem = (detailId, source) => {
    const isLog = source === 'LOG';
    setMappings(prev => ({
      ...prev,
      [detailId]: {
        ...prev[detailId],
        vendorSource: source,
        handlingPct: isLog ? 10 : 0,
        canonPct: isLog ? 0 : 6,
      }
    }));
  };

  const calculateTotal = () => {
    const itemCalculations = [];
    let grandBasePrice = 0;
    let grandSellPriceBeforeDiscount = 0;
    let grandItemDiscountTotal = 0;

    Object.values(mappings).forEach(row => {
      // Base price: qty × unitPrice (no discount here)
      const lineTotal = row.qty * row.unitPrice;
      const itemBasePrice = lineTotal > 0 ? lineTotal : 0;
      grandBasePrice += itemBasePrice;

      const hp = (row.handlingPct || 0) / 100;
      const oh = (row.overheadPct || 0) / 100;
      const cp = (row.canonPct || 0) / 100;
      const cm = (row.commissionPct || 0) / 100;
      const fr = (row.freightPct || 0) / 100;
      const cu = (row.customPct || 0) / 100;

      // Pembulatan pada setiap tahap kalkulasi item
      const itemAfterHandling = Math.round(itemBasePrice * (1 + hp));
      const itemAfterOverhead = Math.round(itemAfterHandling * (1 + oh));
      const itemAfterFreight = Math.round(itemAfterOverhead * (1 + fr));
      const itemAfterCustom = Math.round(itemAfterFreight * (1 + cu));

      const itemSubTotal = itemAfterCustom;

      const totalDeductionPct = cp + cm;
      const rawSellPrice = totalDeductionPct < 1
        ? itemSubTotal / (1 - totalDeductionPct)
        : itemSubTotal;

      // Bulatkan harga jual sebelum diskon
      const itemSellPriceBeforeDiscount = Math.round(rawSellPrice);

      const nomHandling = itemAfterHandling - itemBasePrice;
      const nomOverhead = itemAfterOverhead - itemAfterHandling;
      const nomFreight = itemAfterFreight - itemAfterOverhead;
      const nomCustom = itemAfterCustom - itemAfterFreight;
      const nomCanon = Math.round(itemSellPriceBeforeDiscount * cp);
      const nomComm = Math.round(itemSellPriceBeforeDiscount * cm);

      const itemDiscount = Math.round(row.discount || 0);
      const itemSellPrice = Math.max(itemSellPriceBeforeDiscount - itemDiscount, 0);

      grandSellPriceBeforeDiscount += itemSellPriceBeforeDiscount;
      grandItemDiscountTotal += itemDiscount;

      const inqDetail = inquiry?.details?.find(d => d.id === row.inquiryDetailId) || {};
      const itemName = inqDetail.requestedItemName || inqDetail.requestDescription || 'Unknown Item';

      itemCalculations.push({
        inquiryDetailId: row.inquiryDetailId,
        itemName,
        qty: row.qty,
        basePrice: itemBasePrice,
        nomHandling,
        nomOverhead,
        nomCanon,
        nomComm,
        nomFreight,
        nomCustom,
        subTotal: itemSubTotal,
        sellPriceBeforeDiscount: itemSellPriceBeforeDiscount,
        discount: itemDiscount,
        sellPrice: itemSellPrice,
        vendorSource: row.vendorSource,
        handlingPct: row.handlingPct || 0,
        canonPct: row.canonPct || 0,
        commissionPct: row.commissionPct || 0,
        overheadPct: row.overheadPct || 0,
        freightPct: row.freightPct || 0,
        customPct: row.customPct || 0,
      });
    });

    const grandSellPrice = grandSellPriceBeforeDiscount - grandItemDiscountTotal;
    const globalDiscountNominal = Math.round(quotationMeta.globalDiscount || 0);
    const grandSellPriceAfterGlobal = Math.max(grandSellPrice - globalDiscountNominal, 0);

    const isLocal = inquiry?.customer?.customerType !== 'FOREIGN';
    let finalTotal = grandSellPriceAfterGlobal;
    let finalCurrency = quotationMeta.currency;

    if (isLocal && quotationMeta.currency !== 'IDR') {
      // Bulatkan hasil konversi mata uang
      finalTotal = Math.round(grandSellPriceAfterGlobal * (quotationMeta.exchangeRate || 1));
      finalCurrency = 'IDR';
    }

    let globalNomHandling = 0;
    let globalNomOverhead = 0;
    let globalNomCanon = 0;
    let globalNomComm = 0;
    let globalNomFreight = 0;
    let globalNomCustom = 0;
    let globalSubTotal = 0;

    itemCalculations.forEach(ic => {
      globalNomHandling += ic.nomHandling;
      globalNomOverhead += ic.nomOverhead;
      globalNomFreight += ic.nomFreight;
      globalNomCustom += ic.nomCustom;
      globalSubTotal += ic.subTotal;
      globalNomCanon += ic.nomCanon;
      globalNomComm += ic.nomComm;
    });

    return {
      itemCalculations,
      basePrice: grandBasePrice,
      sellPrice: grandSellPrice,
      grandSellPriceAfterGlobal,
      globalDiscountNominal,
      globalNomHandling,
      globalNomOverhead,
      globalNomCanon,
      globalNomComm,
      globalNomFreight,
      globalNomCustom,
      finalTotal,
      finalCurrency,
      globalSubTotal,
    };
  };

  // Compute validity expiry date preview
  const getValidityExpiry = () => {
    const d = isEdit && quotation ? new Date(quotation.createdAt) : new Date();
    d.setDate(d.getDate() + (sparePartDetail.validityDays || 30));
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const handleSaveQuotation = async () => {
    if (!quotationMeta.clientInquiryDate) {
      return message.error('Please select the Client Inquiry Date / Reference Date');
    }

    // Validation for Canon + Commission limit
    const items = Object.values(mappings);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Validasi Canon + Commission tidak boleh >= 100%
      const totalDeduction = (item.canonPct || 0) + (item.commissionPct || 0);
      if (totalDeduction >= 100) {
        return message.error(`Baris ke-${i + 1}: Total Canon% + Commission% tidak boleh mencapai 100% atau lebih (saat ini: ${totalDeduction}%)`);
      }
    }

    // Validation for Commercial Terms (Mandatory)
    if (!sparePartDetail.deliveryDateDesc || sparePartDetail.deliveryDateDesc.trim() === '') {
      return message.error('Commercial Terms: Delivery Date Description wajib diisi');
    }
    if (!sparePartDetail.paymentTerms || sparePartDetail.paymentTerms.trim() === '') {
      return message.error('Commercial Terms: Payment Terms wajib diisi');
    }
    if (!sparePartDetail.paymentConditions || sparePartDetail.paymentConditions.trim() === '') {
      return message.error('Commercial Terms: Payment Conditions wajib diisi');
    }
    if (!sparePartDetail.deliveryTerms || sparePartDetail.deliveryTerms.trim() === '') {
      return message.error('Commercial Terms: Delivery Terms wajib diisi');
    }
    if (!sparePartDetail.bankDetails || sparePartDetail.bankDetails.trim() === '') {
      return message.error('Commercial Terms: Bank Details wajib dipilih');
    }

    setSaving(true);
    try {
      const calc = calculateTotal();
      const { basePrice, sellPrice, grandSellPriceAfterGlobal, finalTotal, finalCurrency } = calc;

      const payload = {
        details: Object.values(mappings).map(m => ({
          ...m,
          // totalPrice = base price murni (sebelum markup), discount disimpan terpisah di field discount
          totalPrice: Math.max(m.qty * m.unitPrice, 0),
          sellPriceCalc: (() => {
            // Kalkulasi sell price per-item: markup dulu, lalu potong diskon nominal
            const base = Math.max(m.qty * m.unitPrice, 0);
            const hp = (m.handlingPct || 0) / 100;
            const oh = (m.overheadPct || 0) / 100;
            const cp = (m.canonPct || 0) / 100;
            const cm = (m.commissionPct || 0) / 100;
            const fr = (m.freightPct || 0) / 100;
            const cu = (m.customPct || 0) / 100;
            const subTotal = base * (1 + hp) * (1 + oh) * (1 + fr) * (1 + cu);
            const totalDeductionPct = cp + cm;
            const sellBeforeDiscount = totalDeductionPct < 1 ? subTotal / (1 - totalDeductionPct) : subTotal;

            return Math.round(Math.max(sellBeforeDiscount - (m.discount || 0), 0));
          })()
        })),
        basePrice,
        globalDiscount: quotationMeta.globalDiscount || 0,
        margin: quotationMeta.margin,
        totalPrice: grandSellPriceAfterGlobal,
        currency: quotationMeta.currency,
        exchangeRate: quotationMeta.exchangeRate,
        remarks: quotationMeta.remarks,
        clientInquiryDate: quotationMeta.clientInquiryDate.format('YYYY-MM-DD'),
        customerInquiryNumber: quotationMeta.customerInquiryNumber || null,
        forecast: quotationMeta.forecast || 'NORMAL',
        quotationType: 'SPARE_PART',
        sparePartDetail: {
          ...sparePartDetail,
          sellPriceCalc: grandSellPriceAfterGlobal,
          hasDp: Boolean(sparePartDetail.hasDp),
          dpPercent: sparePartDetail.hasDp ? (Number(sparePartDetail.dpPercent) || 0) : null,
          dpAmount: sparePartDetail.hasDp ? Math.round((grandSellPriceAfterGlobal * (sparePartDetail.dpPercent || 0)) / 100) : 0,
        }
      };

      if (isEdit) {
        await updateQuotation(id, payload);
        setIsDirty(false);
        message.success('Quotation Updated Successfully!');
        navigate(`/quotations/${id}`);
      } else {
        const response = await createQuotationFromInquiry(id, payload);
        setIsDirty(false);
        message.success('Quotation Created Successfully!');
        navigate(`/quotations/${response.id}`);
      }
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !inquiry) return null;

  const {
    itemCalculations,
    basePrice,
    sellPrice,
    grandSellPriceAfterGlobal,
    globalDiscountNominal,
    globalNomHandling,
    globalNomOverhead,
    globalNomCanon,
    globalNomComm,
    globalNomFreight,
    globalNomCustom,
    finalTotal,
    finalCurrency,
    globalSubTotal,
  } = calculateTotal();

  const hasGlobalDiscount = (quotationMeta.globalDiscount || 0) > 0;
  const hasPerItemDiscount = Object.values(mappings).some(m => (m.discount || 0) > 0);

  const dpAmount = sparePartDetail.hasDp ? Math.round((grandSellPriceAfterGlobal * (sparePartDetail.dpPercent || 0)) / 100) : 0;
  const balanceAmount = grandSellPriceAfterGlobal - dpAmount;

  const itemColumns = [
    {
      title: 'Requested Item/Desc', dataIndex: 'requestedItemName', width: 180, key: 'req',
      render: (t, r) => (
        <div>
          <span className="inline-block px-2 py-1 bg-gray-100 text-xs font-semibold rounded-md mb-1">{r.itemType}</span><br />
          <Text strong>{t || r.requestDescription}</Text>
          <div className="text-xs text-gray-500 mt-1">Req Qty: {r.qty} {r.uom}</div>
          {r.requestedPartNumber && (
            <div className="text-xs text-blue-600 mt-0.5">Part No: {r.requestedPartNumber}</div>
          )}
        </div>
      )
    },
    {
      title: 'Map & Stock', key: 'map', width: 280,
      render: (_, r) => {
        if (r.itemType === 'SERVICE') {
          return (
            <Select
              showSearch
              allowClear
              disabled={isViewOnly}
              className="w-full"
              placeholder="Search Master Service..."
              optionFilterProp="label"
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              value={mappings[r.id]?.mappedServiceId}
              onChange={(v) => handleMappingChange(r.id, 'mappedServiceId', v)}
            >
              {services.map(s => <Option key={s.id} value={s.id} label={`[${s.serviceCode}] ${s.serviceName}`}>[{s.serviceCode}] {s.serviceName}</Option>)}
            </Select>
          );
        }
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              showSearch
              allowClear
              disabled={isViewOnly}
              className="w-full"
              placeholder="Search Spare Part..."
              optionFilterProp="label"
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              value={mappings[r.id]?.mappedSparePartId}
              onChange={(v) => handleMappingChange(r.id, 'mappedSparePartId', v)}
            >
              {spareParts.map(s => <Option key={s.id} value={s.id} label={`[${s.partCode}] ${s.partName}`}>[{s.partCode}] {s.partName}</Option>)}
            </Select>

            {/* Master data reference info — shown when a spare part is selected */}
            {(() => {
              const sp = getSelectedSparePart(r.id);
              if (!sp) return null;
              const stockQty = parseFloat(sp.stockQty ?? 0);
              const estPrice = sp.estimatedPrice ? parseFloat(sp.estimatedPrice) : null;
              const stdPrice = sp.standardPrice ? parseFloat(sp.standardPrice) : null;
              return (
                <div className="!bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Stock:</span>
                    <span className={`font-semibold ${stockQty > 0 ? 'text-green-600' : 'text-red-500'
                      }`}>
                      {stockQty.toLocaleString('id-ID')} {sp.uom}
                    </span>
                  </div>
                  {estPrice !== null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Est. Price:</span>
                      <span className="font-semibold text-blue-700">
                        {sp.currency} {estPrice.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  {stdPrice !== null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Std. Price:</span>
                      <span className="font-medium text-gray-600">
                        {sp.currency} {stdPrice.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </Space>
        );
      }
    },
    {
      title: 'Pricing & Qty', key: 'price', width: 260,
      render: (_, r) => (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div className="flex justify-between items-center">
            <span className="text-xs">Qty:</span>
            <InputNumber className="!w-36" controls={false} size="small" min={1} disabled={isViewOnly} value={mappings[r.id]?.qty} onChange={(v) => handleMappingChange(r.id, 'qty', v)} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">
              Unit Price:
            </span>

            <InputNumber
              controls={false}
              size="small"
              min={0}
              precision={2}
              step={1000}
              className="!w-36"
              disabled={isViewOnly}
              value={
                mappings[r.id]?.unitPrice
              }

              onChange={(value) =>
                handleMappingChange(
                  r.id,
                  'unitPrice',
                  value || 0
                )
              }

              formatter={(value) => {
                if (
                  value === undefined ||
                  value === null ||
                  value === ''
                ) {
                  return '';
                }

                const parts =
                  String(value).split('.');

                const integerPart =
                  parts[0].replace(
                    /\B(?=(\d{3})+(?!\d))/g,
                    '.'
                  );

                return parts.length > 1
                  ? `${integerPart},${parts[1]}`
                  : integerPart;
              }}

              parser={(value) => {
                if (!value) {
                  return 0;
                }

                return value
                  .replace(/\./g, '')
                  .replace(',', '.')
                  .replace(/[^\d.-]/g, '');
              }}
            />
          </div>
        </Space>
      )
    },
    {
      title: 'Note', key: 'note', width: 200,
      render: (_, r) => (
        <Input.TextArea
          rows={3}
          disabled={isViewOnly}
          placeholder="Note regarding this mapping or item..."
          value={mappings[r.id]?.note}
          onChange={(e) => handleMappingChange(r.id, 'note', e.target.value)}
        />
      )
    }
  ];

  return (
    <>
      <UnsavedChangesModal blocker={blocker} />
      <div className="space-y-6 max-w-7xl mx-auto mb-10">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit || isViewOnly ? `/quotations/${id}` : `/inquiries/${id}`)} />
            <div>
              <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
                {isViewOnly ? `View Quotation: ${quotation?.quotationNumber}` : (isEdit ? `Edit Quotation: ${quotation?.quotationNumber}` : `Prepare Quotation for: ${inquiry?.inquiryNumber}`)}
              </Title>
              <Text type="secondary">
                {isViewOnly ? 'Read-only view of calculation parameters and details.' : (isEdit ? 'Update pricing, items, and commercial terms.' : 'Map inquiry items and determine pricing & availability.')}
              </Text>
            </div>
          </Space>
          <Space>
            {!isViewOnly && (
              <Button type="primary" className="bg-blue-600" disabled={saving} onClick={handleSaveQuotation} icon={<CheckOutlined />}>
                {saving ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Quotation' : 'Create Quotation')}
              </Button>
            )}
          </Space>
        </div>

        {/* Customer Inquiry Items Table */}
        <Card title="Customer Inquiry Items" className="rounded-xl shadow-sm border-gray-100 !mb-3">
          <div className="mb-4 text-gray-600 flex justify-between items-center">
            <div>
              <strong>Customer:</strong> {inquiry.customer?.name || '-'}
              <Tag color={inquiry.customer?.customerType === 'FOREIGN' ? 'gold' : 'blue'} className="!ml-2">
                {inquiry.customer?.customerType || 'LOCAL'}
              </Tag>
              <span className="mx-2">|</span>
              <strong>Subject:</strong> {inquiry.subject}
            </div>
            {inquiry.customer?.customerType === 'FOREIGN' && quotationMeta.currency !== 'IDR' && (
              <Tag color="warning">Foreign Customer: Standard currency is {quotationMeta.currency}</Tag>
            )}
          </div>
          <Table
            columns={itemColumns}
            dataSource={inquiry.details}
            pagination={false}
            rowKey="id"
            bordered
            expandable={{
              expandedRowRender: (r) => {
                const m = mappings[r.id] || {};
                const isLog = m.vendorSource === 'LOG';
                return (
                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 m-2">
                    <div className="font-semibold text-indigo-700 text-xs mb-3 flex items-center gap-2">
                      <CalculatorOutlined /> Price Calculation Parameters — <span className="font-normal text-gray-500">{r.requestedItemName || r.requestDescription}</span>
                    </div>
                    <Row gutter={[16, 12]}>
                      {/* Vendor Source */}
                      <Col span={24}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-gray-700 w-32">Vendor Source:</span>
                          <Select
                            size="small"
                            style={{ minWidth: 180 }}
                            disabled={isViewOnly}
                            value={m.vendorSource || 'LOG'}
                            onChange={(v) => applyVendorSourceForItem(r.id, v)}
                          >
                            <Option value="LOG"><Space><Tag color="green" className="!text-[10px] !py-0">LOG</Tag>Pembelian ke LOG</Space></Option>
                            <Option value="NON_LOG"><Space><Tag color="orange" className="!text-[10px] !py-0">Non-LOG</Tag>Pembelian ke Vendor Lain</Space></Option>
                          </Select>
                        </div>
                      </Col>
                      {/* Locked: Handling & Canon */}
                      <Col span={12}>
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] font-semibold text-blue-800">Handling %</span>
                              <span className="text-[9px] text-blue-400 flex items-center gap-1"><LockOutlined /> Auto</span>
                            </div>
                            <span className="text-lg font-bold text-blue-700">{m.handlingPct ?? 10}%</span>
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] font-semibold text-blue-800">Canon %</span>
                              <span className="text-[9px] text-blue-400 flex items-center gap-1"><LockOutlined /> Auto</span>
                            </div>
                            <span className="text-lg font-bold text-blue-700">{m.canonPct ?? 0}%</span>
                          </div>
                        </div>
                      </Col>
                      <Col span={24}>
                        <Divider dashed style={{ margin: '4px 0', borderColor: '#c7d2fe' }} />
                      </Col>
                      {/* Editable: Commission, Overhead, Freight, Custom */}
                      {[
                        { key: 'commissionPct', label: 'Commission %', color: '#7c3aed' },
                        { key: 'overheadPct', label: 'Overhead %', color: '#0369a1' },
                        { key: 'freightPct', label: 'Freight %', color: '#ea580c' },
                        { key: 'customPct', label: 'Custom %', color: '#ea580c' },
                      ].map(({ key, label, color }) => (
                        <Col span={12} key={key}>
                          <div className={`p-2 bg-white border rounded-lg hover:border-blue-300 transition-colors border-gray-200`}>
                            <span className="block text-[10px] font-semibold mb-1" style={{ color }}>{label}</span>
                            <InputNumber
                              size="small"
                              className="w-full"
                              min={0}
                              precision={2}
                              addonAfter="%"
                              disabled={isViewOnly}
                              value={m[key] ?? 0}
                              onChange={v => handleMappingChange(r.id, key, v || 0)}
                            />
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </div>
                );
              },
              rowExpandable: () => true,
            }}
          />
        </Card>

        {/* Expandable pricing row rendered inside items table */}
        {/* Removed: global Price Calculation Parameters card */}

        {/* Quotation Meta + Summary */}
        <Row gutter={16} className="mt-3">
          <Col span={12}>
            <Card title="Quotation Metadata" className="rounded-xl shadow-sm border-gray-100 h-full">
              <Space direction="vertical" className="w-full">
                <div>
                  <span className="block text-sm mb-1 font-semibold text-gray-700">
                    Client Inquiry Date <span className="text-red-500">*</span>
                  </span>
                  <DatePicker
                    className="w-full"
                    disabled={isViewOnly}
                    value={quotationMeta.clientInquiryDate}
                    onChange={v => setQuotationMeta(p => ({ ...p, clientInquiryDate: v }))}
                    format="DD MMM YYYY"
                    allowClear={false}
                  />
                </div>
                <div>
                  <span className="block text-sm mb-1 font-semibold text-gray-700">
                    Customer Inquiry No. / Ref:
                  </span>
                  <Input
                    placeholder="e.g. INQ/CUST/2026/001"
                    disabled={isViewOnly}
                    value={quotationMeta.customerInquiryNumber}
                    onChange={e => setQuotationMeta(p => ({ ...p, customerInquiryNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <span className="block text-sm mb-1 font-semibold text-gray-700">Forecast:</span>
                  <Select
                    className="w-full"
                    disabled={isViewOnly}
                    value={quotationMeta.forecast}
                    onChange={v => setQuotationMeta(p => ({ ...p, forecast: v }))}
                  >
                    <Option value="WORST">WORST</Option>
                    <Option value="NORMAL">NORMAL</Option>
                    <Option value="BEST">BEST</Option>
                  </Select>
                </div>
                <div>
                  <span className="block text-sm mb-1 font-semibold text-gray-700">Currency:</span>
                  <Row gutter={8}>
                    <Col span={8}>
                      <Select className="w-full" disabled={isViewOnly} value={quotationMeta.currency} onChange={v => setQuotationMeta(p => ({ ...p, currency: v, exchangeRate: v === 'IDR' ? 1 : p.exchangeRate }))}>
                        <Option value="IDR">IDR</Option>
                        <Option value="EUR">EUR</Option>
                        <Option value="USD">USD</Option>
                      </Select>
                    </Col>
                    <Col span={16}>
                      <InputNumber
                        className="!w-full"
                        placeholder="Exchange Rate"
                        disabled={isViewOnly || quotationMeta.currency === 'IDR'}
                        value={quotationMeta.exchangeRate}
                        onChange={v => setQuotationMeta(p => ({ ...p, exchangeRate: v }))}
                        formatter={value => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value ? value.replace(/Rp|\s|,/g, '') : ''}
                      />
                    </Col>
                  </Row>
                </div>
                <div>
                  <span className="block text-sm mb-1 font-semibold text-gray-700">Additional Remarks:</span>
                  <Input.TextArea rows={4} disabled={isViewOnly} value={quotationMeta.remarks} onChange={e => setQuotationMeta(p => ({ ...p, remarks: e.target.value }))} />
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title={
                <Space>
                  <CalculatorOutlined className="text-indigo-500" />
                  <span>Price Calculation Summary</span>
                </Space>
              }
              className="rounded-xl shadow-sm border-gray-100 h-full"
              style={{ background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)' }}
            >
              <div className="space-y-2 text-sm">
                <Collapse defaultActiveKey={['global']} ghost size="small">
                  <Panel header={<Text strong className="text-indigo-700">Per-Item Breakdown</Text>} key="items">
                    <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
                      {itemCalculations.map((item, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-1">
                            <Text strong className="text-xs text-gray-800">{item.itemName}</Text>
                            <Tag color={item.vendorSource === 'LOG' ? 'green' : 'orange'} className="!text-[9px]">
                              {item.vendorSource || 'LOG'}
                            </Tag>
                          </div>
                          <div className="mt-1 space-y-1">
                            {[
                              { label: `Base Price`, value: item.basePrice, color: 'text-gray-700' },
                              { label: `+ Handling (${item.handlingPct}%)`, value: item.nomHandling, color: 'text-blue-600' },
                              { label: `+ Overhead (${item.overheadPct}%)`, value: item.nomOverhead, color: 'text-sky-600' },
                              { label: `+ Freight (${item.freightPct}%)`, value: item.nomFreight, color: 'text-orange-500' },
                              { label: `+ Custom (${item.customPct}%)`, value: item.nomCustom, color: 'text-orange-600' },
                              { label: `Sub Total`, value: item.subTotal, color: 'text-gray-900 font-bold', dividerBefore: true },
                              { label: `+ Canon (${item.canonPct}%)`, value: item.nomCanon, color: 'text-blue-600', dividerBefore: true },
                              { label: `+ Commission (${item.commissionPct}%)`, value: item.nomComm, color: 'text-purple-600' },
                            ].map((step, sIdx) => (
                              <div
                                key={sIdx}
                                className={`flex justify-between items-center ${step.dividerBefore ? 'border-t border-gray-200 mt-2 pt-2' : ''}`}
                              >
                                <Text type={!step.color.includes('font-bold') ? 'secondary' : ''} className="text-[10px]">
                                  {step.label}
                                </Text>
                                <Text className={`text-[10px] ${step.color}`}>
                                  {step.value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                </Text>
                              </div>
                            ))}
                            {/* Grand Total sebelum diskon per-item */}
                            <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-100">
                              <Text strong className="text-[10px] text-indigo-700">Grand Total</Text>
                              <Text strong className="text-[11px] text-indigo-700">
                                {item.sellPriceBeforeDiscount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                              </Text>
                            </div>
                            {/* Input Diskon Per-Item (Nominal) */}
                            <div className={`flex justify-between items-center mt-1 pt-1 border-t border-dashed border-red-200 ${hasGlobalDiscount ? 'opacity-50' : ''}`}>
                              <Text type="secondary" className="text-[10px] text-red-500">- Discount (Nominal):</Text>
                              <InputNumber
                                controls={false}
                                size="small"
                                min={0}
                                precision={2}
                                step={0.01}
                                className="!w-28"
                                disabled={isViewOnly || hasGlobalDiscount}
                                value={mappings[item.inquiryDetailId]?.discount || 0}
                                onChange={v => handleMappingChange(item.inquiryDetailId, 'discount', v || 0)}
                                formatter={value => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0'}
                                parser={value => value ? value.replace(/,/g, '') : ''}
                              />
                            </div>
                            {/* Sell Price Akhir setelah diskon per-item */}
                            {(mappings[item.inquiryDetailId]?.discount || 0) > 0 && (
                              <div className="flex justify-between items-center mt-1 pt-1 border-t-2 border-red-300">
                                <Text strong className="text-[10px] text-red-700">Net Price (after discount)</Text>
                                <Text strong className="text-[11px] text-red-700">
                                  {item.sellPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                </Text>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel header={<Text strong className="text-indigo-700">Grand Total Summary</Text>} key="global">
                    {[
                      { label: `Total Base Price`, value: basePrice, color: 'text-gray-700' },
                      { label: `+ Total Handling`, value: globalNomHandling, color: 'text-blue-600' },
                      { label: `+ Total Overhead`, value: globalNomOverhead, color: 'text-sky-600' },
                      { label: `+ Total Freight`, value: globalNomFreight, color: 'text-orange-500' },
                      { label: `+ Total Custom`, value: globalNomCustom, color: 'text-orange-600' },
                      { label: `Sub Total`, value: globalSubTotal, color: 'text-gray-900 font-bold', dividerBefore: true },
                      { label: `+ Total Canon`, value: globalNomCanon, color: 'text-blue-600', dividerBefore: true },
                      { label: `+ Total Commission`, value: globalNomComm, color: 'text-purple-600' },
                      { label: `Grand Total (${quotationMeta.currency})`, value: sellPrice, color: 'text-indigo-700 font-bold', dividerBefore: true },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex justify-between items-center py-1 ${item.dividerBefore ? 'border-t-2 border-indigo-200 mt-2 pt-2' : 'border-t border-gray-100'}`}
                      >
                        <Text
                          type={!item.color.includes('font-bold') ? 'secondary' : ''}
                          className={item.color.includes('font-bold') ? 'text-xs font-bold' : 'text-xs'}
                        >
                          {item.label}
                        </Text>
                        <Text className={`text-xs font-semibold ${item.color}`}>
                          {item.value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </Text>
                      </div>
                    ))}
                    {/* Global Discount Input — disabled jika ada diskon per-item */}
                    <div className={`flex justify-between items-center py-1 border-t-2 border-dashed border-red-200 mt-2 pt-2 ${hasPerItemDiscount ? 'opacity-50' : ''}`}>
                      <Text type="secondary" className="text-xs text-red-500">- Global Discount (Nominal):</Text>
                      <InputNumber
                        controls={false}
                        size="small"
                        min={0}
                        precision={2}
                        step={0.01}
                        className="!w-32"
                        disabled={isViewOnly || hasPerItemDiscount}
                        value={quotationMeta.globalDiscount || 0}
                        onChange={v => setQuotationMeta(p => ({ ...p, globalDiscount: v || 0 }))}
                        formatter={value => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0'}
                        parser={value => value ? value.replace(/,/g, '') : ''}
                      />
                    </div>
                    {/* Net Grand Total setelah global discount */}
                    {(quotationMeta.globalDiscount || 0) > 0 && (
                      <div className="flex justify-between items-center py-1 border-t-2 border-red-300 mt-1 pt-2">
                        <Text strong className="text-xs text-red-700">Net Grand Total (after discount)</Text>
                        <Text strong className="text-xs text-red-700">
                          {grandSellPriceAfterGlobal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </Text>
                      </div>
                    )}
                  </Panel>
                </Collapse>

                {/* Sell Price highlight */}
                <div className="mt-3 pt-3 border-t-2 border-indigo-200 flex justify-between items-center">
                  <Text strong className="text-indigo-700">Sell Price ({quotationMeta.currency}):</Text>
                  <Text strong className="text-indigo-700 text-base">
                    {grandSellPriceAfterGlobal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </Text>
                </div>

                {/* Final Total (if conversion needed) */}
                {quotationMeta.currency !== finalCurrency && (
                  <div className="flex justify-between items-center bg-indigo-50 rounded-lg px-3 py-2 mt-2">
                    <Title level={5} style={{ margin: 0, color: '#4338ca' }}>Final Total (IDR):</Title>
                    <Title level={5} style={{ margin: 0, color: '#4338ca' }}>
                      Rp {finalTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </Title>
                  </div>
                )}
                {quotationMeta.currency === finalCurrency && (
                  <div className="flex justify-between items-center bg-indigo-50 rounded-lg px-3 py-2 mt-2">
                    <Title level={5} style={{ margin: 0, color: '#4338ca' }}>Final Total ({finalCurrency}):</Title>
                    <Title level={5} style={{ margin: 0, color: '#4338ca' }}>
                      {finalCurrency === 'IDR'
                        ? `Rp ${finalTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
                        : `${finalTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${finalCurrency}`}
                    </Title>
                  </div>
                )}

                {sparePartDetail.hasDp && (
                  <div className="mt-3 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex justify-between items-center text-xs text-amber-900 font-semibold mb-1">
                      <span>Down Payment ({sparePartDetail.dpPercent || 20}%):</span>
                      <span>{quotationMeta.currency} {dpAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-amber-700">
                      <span>Remaining Balance ({100 - (sparePartDetail.dpPercent || 20)}%):</span>
                      <span>{quotationMeta.currency} {balanceAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                )}

                <div className="mt-3 p-2 bg-gray-100 rounded-lg text-[10px] text-gray-400">
                  <strong>Note:</strong> Local client → Final offer in IDR. Foreign client → in {quotationMeta.currency}.
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Spare Part Quotation Details — Extension fields for template */}
        <Card
          title={<span>Spare Part Quotation Details <span className="text-xs font-normal text-gray-400 ml-2">(used for PDF template)</span></span>}
          className="rounded-xl shadow-sm border-gray-100"
        >
          <Row gutter={[24, 16]}>
            {/* --- Reference --- */}
            <Col span={24}>
              <Divider orientation="left" plain><span className="text-xs text-gray-500 font-semibold">Reference</span></Divider>
            </Col>
            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Location</span>
              <Input
                placeholder="e.g. CITEUREUP P14 CL"
                disabled={isViewOnly}
                value={sparePartDetail.location}
                onChange={e => handleSparepartDetailChange('location', e.target.value)}
              />
            </Col>
            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Project No.</span>
              <Input
                placeholder="e.g. 12105"
                disabled={isViewOnly}
                value={sparePartDetail.projectNo}
                onChange={e => handleSparepartDetailChange('projectNo', e.target.value)}
              />
            </Col>

            {/* --- End Customer / Ship-to-Party --- */}
            <Col span={24}>
              <Divider orientation="left" plain><span className="text-xs text-gray-500 font-semibold">Ship-to-Party (End Customer)</span></Divider>
            </Col>
            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">End Customer</span>
              <Select
                showSearch
                allowClear
                disabled={isViewOnly}
                className="w-full"
                placeholder="Select end customer / plant owner..."
                optionFilterProp="label"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                value={sparePartDetail.endCustomerId}
                onChange={v => handleSparepartDetailChange('endCustomerId', v)}
              >
                {customers.map(c => <Option key={c.id} value={c.id} label={c.name}>{c.name}</Option>)}
              </Select>
            </Col>
            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Attention (PIC Name)</span>
              <Input.Group compact>
                <Select
                  style={{ width: '28%' }}
                  disabled={isViewOnly}
                  value={sparePartDetail.attentionTitle}
                  onChange={v => handleSparepartDetailChange('attentionTitle', v)}
                >
                  {ATTENTION_TITLES.map(t => <Option key={t} value={t}>{t}</Option>)}
                </Select>
                <Input
                  style={{ width: '72%' }}
                  placeholder="e.g. Riana"
                  disabled={isViewOnly}
                  value={sparePartDetail.attention}
                  onChange={e => handleSparepartDetailChange('attention', e.target.value)}
                />
              </Input.Group>
            </Col>
            <Col span={24}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Additional Information</span>
              <Input.TextArea
                rows={3}
                placeholder="additional information..."
                disabled={isViewOnly}
                value={sparePartDetail.additionalInformation || ''}
                onChange={e => handleSparepartDetailChange('additionalInformation', e.target.value)}
              />
            </Col>


            {/* --- Validity --- */}
            <Col span={24}>
              <Divider orientation="left" plain><span className="text-xs text-gray-500 font-semibold">Validity</span></Divider>
            </Col>
            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Validity Period (Days)</span>
              <InputNumber
                className="!w-full"
                min={1}
                disabled={isViewOnly}
                value={sparePartDetail.validityDays}
                onChange={v => handleSparepartDetailChange('validityDays', v)}
                addonAfter="days"
              />
              <div className="text-xs text-gray-400 mt-1">
                Expires on: <span className="font-semibold text-gray-600">{getValidityExpiry()}</span>
              </div>
            </Col>

            {/* --- Commercial Terms --- */}
            <Col span={24}>
              <Divider orientation="left" plain><span className="text-xs text-gray-500 font-semibold">Commercial Terms & Payment</span></Divider>
            </Col>

            {/* Down Payment (DP) Option */}
            <Col span={24}>
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={Boolean(sparePartDetail.hasDp)}
                      onChange={handleDpToggle}
                      disabled={isViewOnly}
                    />
                    <div>
                      <span className="font-semibold text-gray-800 text-sm">Require Down Payment (DP)</span>
                      <span className="text-xs text-gray-500 block">
                        If enabled, an invoice for DP will be generated upon PO confirmation, and the remaining balance upon delivery.
                      </span>
                    </div>
                  </div>
                  {sparePartDetail.hasDp && (
                    <Tag color="gold" className="font-semibold text-xs px-2.5 py-0.5">
                      DP {sparePartDetail.dpPercent || 20}% Active
                    </Tag>
                  )}
                </div>

                {sparePartDetail.hasDp && (
                  <div className="mt-3 pt-3 border-t border-amber-200/70">
                    <Row gutter={[16, 16]} align="middle">
                      <Col xs={24} md={8}>
                        <span className="block text-xs font-semibold text-gray-700 mb-1">DP Percentage (%)</span>
                        <Space wrap orientation="horizontal">
                          <InputNumber
                            min={1}
                            max={99}
                            precision={0}
                            disabled={isViewOnly}
                            value={sparePartDetail.dpPercent || 20}
                            onChange={handleDpPercentChange}
                            addonAfter="%"
                            className="!w-28"
                          />
                          <Space size="small">
                            {[10, 20, 30, 50].map(pct => (
                              <Button
                                key={pct}
                                size="small"
                                type={sparePartDetail.dpPercent === pct ? 'primary' : 'default'}
                                disabled={isViewOnly}
                                onClick={() => handleDpPercentChange(pct)}
                                className={sparePartDetail.dpPercent === pct ? '!bg-amber-600 !border-amber-600' : ''}
                              >
                                {pct}%
                              </Button>
                            ))}
                          </Space>
                        </Space>
                      </Col>

                      <Col xs={24} md={8}>
                        <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                          <div className="text-xs text-gray-500">Calculated DP Amount:</div>
                          <div className="text-sm font-bold text-amber-700">
                            {quotationMeta.currency} {dpAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </Col>

                      <Col xs={24} md={8}>
                        <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                          <div className="text-xs text-gray-500">Remaining Balance ({100 - (sparePartDetail.dpPercent || 20)}%):</div>
                          <div className="text-sm font-bold text-gray-700">
                            {quotationMeta.currency} {balanceAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                )}
              </div>
            </Col>

            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">
                Delivery Date Description <span className="text-red-500">*</span>
              </span>
              <Input.TextArea
                rows={2}
                placeholder="e.g. approx 5 months upon receipt of order confirmation"
                disabled={isViewOnly}
                value={sparePartDetail.deliveryDateDesc}
                onChange={e => handleSparepartDetailChange('deliveryDateDesc', e.target.value)}
              />
            </Col>
            <Col span={12}>
              <div className="flex justify-between items-center mb-1">
                <span className="block text-sm font-semibold text-gray-700">
                  Payment Terms <span className="text-red-500">*</span>
                </span>
                {sparePartDetail.hasDp && !isViewOnly && (
                  <Button
                    type="link"
                    size="small"
                    className="p-0 h-auto text-xs text-amber-600 hover:text-amber-700"
                    onClick={applyDpPaymentTermsTemplate}
                  >
                    Use DP Template
                  </Button>
                )}
              </div>
              <Input.TextArea
                rows={2}
                placeholder="e.g. Nett by T/T within 30 days upon the delivery and receipt of invoice"
                disabled={isViewOnly}
                value={sparePartDetail.paymentTerms}
                onChange={e => handleSparepartDetailChange('paymentTerms', e.target.value)}
              />
            </Col>
            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">
                Payment Conditions <span className="text-red-500">*</span>
              </span>
              <Input.TextArea
                rows={2}
                placeholder="e.g. Payment is settled within 90 days upon receipt of complete document"
                disabled={isViewOnly}
                value={sparePartDetail.paymentConditions}
                onChange={e => handleSparepartDetailChange('paymentConditions', e.target.value)}
              />
            </Col>
            <Col span={24}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">
                Delivery Terms <span className="text-red-500">*</span>
              </span>
              <Input
                placeholder="e.g. DDP Citereup, Indonesia (Incoterms 2010®)"
                disabled={isViewOnly}
                value={sparePartDetail.deliveryTerms}
                onChange={e => {
                  const val = e.target.value;
                  setSparepartDetail(prev => ({
                    ...prev,
                    deliveryTerms: val,
                    deliveryTermsShort: val,
                  }));
                }}
              />
            </Col>
            <Col span={24}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">
                Bank Details <span className="text-red-500">*</span>
              </span>

              <Select
                showSearch
                allowClear
                disabled={isViewOnly}
                className="w-full"
                placeholder="Select bank details..."
                value={sparePartDetail.bankDetails || undefined}
                onChange={v => handleSparepartDetailChange('bankDetails', v || '')}
                optionFilterProp="label"
              >
                {BANK_DETAILS_OPTIONS.map(bank => (
                  <Option key={bank.value} value={bank.value} label={bank.label}>
                    <Text>
                      <span className="font-semibold">{bank.label}</span> : {bank.value}
                    </Text>
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>
      </div>
    </>
  );
};

export default CreateFromInquiry;
