import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Space, Button, message, Select, Input, InputNumber, Row, Col, Tag, Divider, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { CheckOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  prepareQuotationFromInquiry,
  createQuotationFromInquiry,
  getQuotationById,
  updateQuotation
} from '../../../services/quotation.service';
import { getServices, getSpareParts } from '../../../services/master.service';
import useUnsavedChangesWarning from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';

const { Title, Text } = Typography;
const { Option } = Select;

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

  // Data structure for quotation mappings and inputs
  const [mappings, setMappings] = useState({});
  const [quotationMeta, setQuotationMeta] = useState({
    leadTimeDays: 0,
    remarks: '',
    margin: 0,
    currency: 'IDR',
    exchangeRate: 1,
    clientInquiryDate: null
  });

  const [saving, setSaving] = useState(false);
  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();
  const [isLoaded, setIsLoaded] = useState(false);

  // Project-specific detail fields for PDF template
  const [projectDetail, setProjectDetail] = useState({
    location: '',
    projectNo: '',
    projectTitle: '',
    projectSiteName: '',
    projectSiteAddress: '',
    projectDuration: '',
    attentionTitle: 'Mr.',
    attention: '',
    validityDays: 30,
    paymentTerms: '',
  });

  useEffect(() => {
    if (isLoaded) {
      setIsDirty(true);
    }
  }, [projectDetail, quotationMeta, mappings, isLoaded]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [srvData, sppData] = await Promise.all([
          getServices({ active: true }),
          getSpareParts({ active: true })
        ]);

        setServices(srvData);
        setSpareParts(sppData);

        if (isEdit) {
          const quoData = await getQuotationById(id);
          setQuotation(quoData);
          setInquiry(quoData.inquiry);

          // Map basic meta
          setQuotationMeta({
            leadTimeDays: quoData.leadTimeDays,
            remarks: quoData.remarks,
            margin: parseFloat(quoData.margin) || 0,
            currency: quoData.currency,
            exchangeRate: parseFloat(quoData.exchangeRate) || 1,
            clientInquiryDate: quoData.clientInquiryDate ? dayjs(quoData.clientInquiryDate) : (quoData.inquiry?.inquiryDate ? dayjs(quoData.inquiry.inquiryDate) : dayjs(quoData.inquiry?.createdAt))
          });

          // Map project-specific meta
          if (quoData.projectDetail) {
            setProjectDetail({
              location: quoData.projectDetail.location || '',
              projectNo: quoData.projectDetail.projectNo || '',
              projectTitle: quoData.projectDetail.projectTitle || '',
              projectSiteName: quoData.projectDetail.projectSiteName || '',
              projectSiteAddress: quoData.projectDetail.projectSiteAddress || '',
              projectDuration: quoData.projectDetail.projectDuration || '',
              attentionTitle: quoData.projectDetail.attentionTitle || 'Mr.',
              attention: quoData.projectDetail.attention || '',
              validityDays: quoData.projectDetail.validityDays,
              paymentTerms: quoData.projectDetail.paymentTerms || '',
            });
          }

          // Map details
          const initialMap = {};
          (quoData.details || []).forEach(d => {
            initialMap[d.inquiryDetailId] = {
              inquiryDetailId: d.inquiryDetailId,
              itemType: d.itemType,
              mappedServiceId: d.mappedServiceId,
              mappedSparePartId: d.mappedSparePartId,
              unitPrice: parseFloat(d.unitPrice) || 0,
              qty: parseFloat(d.qty) || 1,
              discount: parseFloat(d.discount) || 0,
              leadTimeDays: d.leadTimeDays,
              note: d.note || ''
            };
          });
          setMappings(initialMap);

        } else {
          const inqData = await prepareQuotationFromInquiry(id);
          setInquiry(inqData);

          const preQuo = inqData.prefilledQuotation;

          const initialCurrency = preQuo?.currency || (inqData.customer?.customerType === 'FOREIGN' ? 'EUR' : 'IDR');
          setQuotationMeta(prev => ({
            ...prev,
            remarks: preQuo?.remarks || prev.remarks,
            margin: preQuo?.margin ? parseFloat(preQuo.margin) : prev.margin,
            currency: initialCurrency,
            exchangeRate: preQuo?.exchangeRate ? parseFloat(preQuo.exchangeRate) : prev.exchangeRate,
            globalDiscount: preQuo?.globalDiscount ? parseFloat(preQuo.globalDiscount) : prev.globalDiscount,
            clientInquiryDate: inqData.inquiryDate ? dayjs(inqData.inquiryDate) : dayjs(inqData.createdAt)
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
            initialMap[d.id] = {
              inquiryDetailId: d.id,
              itemType: d.itemType,
              mappedServiceId: matchedPd?.mappedServiceId ? String(matchedPd.mappedServiceId) : null,
              mappedSparePartId: matchedPd?.mappedSparePartId ? String(matchedPd.mappedSparePartId) : null,
              unitPrice: matchedPd ? parseFloat(matchedPd.unitPrice) || 0 : 0,
              qty: matchedPd?.qty ? parseFloat(matchedPd.qty) : (parseFloat(d.qty) || 1),
              discount: matchedPd ? parseFloat(matchedPd.discount) || 0 : 0,
              leadTimeDays: matchedPd?.leadTimeDays || 0,
              note: matchedPd?.note || ''
            };
          });
          setMappings(initialMap);
        }
      } catch (err) {
        message.error('Failed to load data for project quotation');
        console.error(err);
      } finally {
        setLoading(false);
        setTimeout(() => setIsLoaded(true), 100);
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleMappingChange = (detailId, field, value) => {
    setMappings(prev => ({
      ...prev,
      [detailId]: {
        ...prev[detailId],
        [field]: value
      }
    }));
  };

  const getSelectedService = (detailId) => {
    const selectedId = mappings[detailId]?.mappedServiceId;
    if (!selectedId) return null;
    return services.find(s => s.id === selectedId || String(s.id) === String(selectedId)) || null;
  };

  const getSelectedSparePart = (detailId) => {
    const selectedId = mappings[detailId]?.mappedSparePartId;
    if (!selectedId) return null;
    return spareParts.find(s => s.id === selectedId || String(s.id) === String(selectedId)) || null;
  };

  const calculateTotal = () => {
    let baseTotal = 0;
    Object.values(mappings).forEach(row => {
      const lineTotal = Math.round((row.qty * row.unitPrice) - (row.discount || 0));
      baseTotal += (lineTotal > 0 ? lineTotal : 0);
    });

    const marginNominal = Math.round(baseTotal * ((quotationMeta.margin || 0) / 100));
    const finalTotalInInputCurrency = baseTotal + marginNominal;
    const isLokal = inquiry?.customer?.customerType !== 'FOREIGN';

    let targetTotal = finalTotalInInputCurrency;
    let targetCurrency = quotationMeta.currency;

    if (isLokal && quotationMeta.currency !== 'IDR') {
      targetTotal = Math.round(finalTotalInInputCurrency * (quotationMeta.exchangeRate || 1));
      targetCurrency = 'IDR';
    }

    return {
      basePrice: baseTotal,
      totalPrice: targetTotal,
      finalCurrency: targetCurrency,
      inputTotal: finalTotalInInputCurrency
    };
  };

  const handleSaveQuotation = async () => {
    if (!quotationMeta.clientInquiryDate) {
      return message.error('Please select the Client Inquiry Date / Reference Date');
    }
    setSaving(true);
    try {
      const { basePrice, totalPrice, finalCurrency, inputTotal } = calculateTotal();

      const payload = {
        details: Object.values(mappings).map(m => ({
          ...m,
          totalPrice: Math.round((m.qty * m.unitPrice) - (m.discount || 0))
        })),
        basePrice,
        margin: quotationMeta.margin,
        totalPrice: inputTotal,
        currency: quotationMeta.currency,
        exchangeRate: quotationMeta.exchangeRate,
        leadTimeDays: quotationMeta.leadTimeDays,
        remarks: quotationMeta.remarks,
        clientInquiryDate: quotationMeta.clientInquiryDate.format('YYYY-MM-DD'),
        quotationType: 'PROJECT',
        projectDetail,
      };

      if (isEdit) {
        await updateQuotation(id, payload);
        setIsDirty(false);
        message.success('Project Quotation Updated Successfully!');
        navigate(`/project/quotations/${id}`);
      } else {
        const response = await createQuotationFromInquiry(id, payload);
        setIsDirty(false);
        message.success('Project Quotation Created Successfully!');
        navigate(`/project/quotations/${response.id}`);
      }
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !inquiry) return null;

  const { basePrice, totalPrice, finalCurrency, inputTotal } = calculateTotal();

  const itemColumns = [
    {
      title: 'Requested Item/Desc', dataIndex: 'requestedItemName', width: 200, key: 'req',
      render: (t, r) => (
        <div>
          <span className="inline-block px-2 py-1 bg-gray-100 text-xs font-semibold rounded-md mb-1">{r.itemType}</span><br />
          <Text strong>{t || r.requestDescription}</Text>
          <div className="text-xs text-gray-500 mt-1">Req Qty: {r.qty} {r.uom}</div>
        </div>
      )
    },
    {
      title: 'Map Data', key: 'map', width: 300,
      render: (_, r) => {
        const selectedService = getSelectedService(r.id);
        const selectedSparePart = getSelectedSparePart(r.id);

        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              showSearch
              allowClear
              disabled={isViewOnly}
              className="w-full"
              placeholder="Map to Master Service (Optional)"
              optionFilterProp="label"
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              value={mappings[r.id]?.mappedServiceId}
              onChange={(v) => {
                handleMappingChange(r.id, 'mappedServiceId', v);
              }}
            >
              {services.map(s => <Option key={s.id} value={s.id} label={`[${s.serviceCode}] ${s.serviceName}`}>[{s.serviceCode}] {s.serviceName}</Option>)}
            </Select>

            {selectedService && (
              <div className="bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. Price:</span>
                  <span className="font-semibold text-blue-700">Rp {Number(selectedService.estimatedPrice || 0).toLocaleString('en-US')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Std. Price:</span>
                  <span className="font-medium text-gray-600">Rp {Number(selectedService.standardPrice || 0).toLocaleString('en-US')}</span>
                </div>
              </div>
            )}

            <Select
              showSearch
              allowClear
              disabled={isViewOnly}
              className="w-full"
              placeholder="Map to Master Spare Part (Optional)"
              optionFilterProp="label"
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              value={mappings[r.id]?.mappedSparePartId}
              onChange={(v) => {
                handleMappingChange(r.id, 'mappedSparePartId', v);
              }}
            >
              {spareParts.map(s => <Option key={s.id} value={s.id} label={`[${s.partCode}] ${s.partName}`}>[{s.partCode}] {s.partName}</Option>)}
            </Select>

            {selectedSparePart && (
              <div className="bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Stock:</span>
                  <span className={`font-semibold ${parseFloat(selectedSparePart.stockQty ?? 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {parseFloat(selectedSparePart.stockQty ?? 0).toLocaleString('en-US')} {selectedSparePart.uom}
                  </span>
                </div>
                {selectedSparePart.estimatedPrice !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Est. Price:</span>
                    <span className="font-semibold text-blue-700">
                      {selectedSparePart.currency || 'IDR'} {parseFloat(selectedSparePart.estimatedPrice || 0).toLocaleString('en-US')}
                    </span>
                  </div>
                )}
                {selectedSparePart.standardPrice !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Std. Price:</span>
                    <span className="font-medium text-gray-600">
                      {selectedSparePart.currency || 'IDR'} {parseFloat(selectedSparePart.standardPrice || 0).toLocaleString('en-US')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Pricing & Qty', key: 'price', width: 280,
      render: (_, r) => (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div className="flex justify-between items-center">
            <span className="text-xs">Qty:</span>
            <InputNumber className="!w-40" controls={false} size="small" min={1} disabled={isViewOnly} value={mappings[r.id]?.qty} onChange={(v) => handleMappingChange(r.id, 'qty', v)} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Unit Price:</span>
            <InputNumber className="!w-40" controls={false} size="small" min={0} disabled={isViewOnly} value={mappings[r.id]?.unitPrice} onChange={(v) => handleMappingChange(r.id, 'unitPrice', v)} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Discount:</span>
            <InputNumber className="!w-40" controls={false} size="small" min={0} disabled={isViewOnly} value={mappings[r.id]?.discount} onChange={(v) => handleMappingChange(r.id, 'discount', v)} />
          </div>
        </Space>
      )
    },
    {
      title: 'Note', key: 'note', width: 250,
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
        <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? `/project/quotations/${id}` : `/project/inquiries/${id}`)} />
            <div>
              <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
                {isViewOnly ? `View Project Quotation Details: ${quotation?.quotationNumber}` : (isEdit ? `Edit Project Quotation: ${quotation?.quotationNumber}` : `Prepare Quotation for: ${inquiry?.inquiryNumber}`)}
              </Title>
              <Text type="secondary">
                {isViewOnly ? 'Viewing pricing, items, and project commercial terms in read-only mode.' : (isEdit ? 'Update pricing, items, and project commercial terms.' : 'Input pricing details for project quotation.')}
              </Text>
            </div>
          </Space>
          {!isViewOnly && (
            <Space>
              <Button type="primary" className="bg-blue-600" disabled={saving} onClick={handleSaveQuotation} icon={<CheckOutlined />}>
                {saving ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Quotation' : 'Create Quotation')}
              </Button>
            </Space>
          )}
        </div>

        <Card title="Customer Inquiry Items" className="rounded-xl shadow-sm border-gray-100">
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
          />
        </Card>

        {/* Project Quotation Details Card */}
        <Card
          title="Project Quotation Details"
          className="rounded-xl shadow-sm border-gray-100 !mt-4"
        >
          <Row gutter={[16, 12]}>
            <Col span={12}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Project Title <span className="text-red-400">*</span></span>
                <Input
                  placeholder="e.g. Supply & Installation of Raw Mill System"
                  disabled={isViewOnly}
                  value={projectDetail.projectTitle}
                  onChange={e => setProjectDetail(p => ({ ...p, projectTitle: e.target.value }))}
                />
              </div>
            </Col>
            <Col span={6}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Location / Code</span>
                <Input
                  placeholder="e.g. JKT, SBY"
                  disabled={isViewOnly}
                  value={projectDetail.location}
                  onChange={e => setProjectDetail(p => ({ ...p, location: e.target.value }))}
                />
              </div>
            </Col>
            <Col span={6}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Project No.</span>
                <Input
                  placeholder="e.g. PRJ-2025-001"
                  disabled={isViewOnly}
                  value={projectDetail.projectNo}
                  onChange={e => setProjectDetail(p => ({ ...p, projectNo: e.target.value }))}
                />
              </div>
            </Col>

            <Col span={12}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Project Site Name</span>
                <Input
                  placeholder="e.g. PT Semen Padang Plant"
                  disabled={isViewOnly}
                  value={projectDetail.projectSiteName}
                  onChange={e => setProjectDetail(p => ({ ...p, projectSiteName: e.target.value }))}
                />
              </div>
            </Col>
            <Col span={6}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Project Duration</span>
                <Input
                  placeholder="e.g. 6 Months"
                  disabled={isViewOnly}
                  value={projectDetail.projectDuration}
                  onChange={e => setProjectDetail(p => ({ ...p, projectDuration: e.target.value }))}
                />
              </div>
            </Col>
            <Col span={6}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Validity (Days)</span>
                <InputNumber
                  min={1}
                  disabled={isViewOnly}
                  className="!w-full"
                  value={projectDetail.validityDays}
                  onChange={v => setProjectDetail(p => ({ ...p, validityDays: v }))}
                />
              </div>
            </Col>

            <Col span={24}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Project Site Address</span>
                <Input.TextArea
                  rows={2}
                  disabled={isViewOnly}
                  placeholder="Alamat lengkap site proyek"
                  value={projectDetail.projectSiteAddress}
                  onChange={e => setProjectDetail(p => ({ ...p, projectSiteAddress: e.target.value }))}
                />
              </div>
            </Col>

            <Col span={24}>
              <Divider className="my-1" />
            </Col>

            <Col span={4}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Attn. Title</span>
                <Select
                  className="w-full"
                  disabled={isViewOnly}
                  value={projectDetail.attentionTitle}
                  onChange={v => setProjectDetail(p => ({ ...p, attentionTitle: v }))}
                >
                  <Option value="Mr.">Mr.</Option>
                  <Option value="Ms.">Ms.</Option>
                </Select>
              </div>
            </Col>
            <Col span={8}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Attention (Contact Name)</span>
                <Input
                  placeholder="Nama kontak tujuan quotation"
                  disabled={isViewOnly}
                  value={projectDetail.attention}
                  onChange={e => setProjectDetail(p => ({ ...p, attention: e.target.value }))}
                />
              </div>
            </Col>
            <Col span={12}>
              <div>
                <span className="block text-sm mb-1 font-semibold text-gray-700">Payment Terms</span>
                <Input.TextArea
                  rows={2}
                  disabled={isViewOnly}
                  placeholder="e.g. 30% Down Payment, 70% upon completion"
                  value={projectDetail.paymentTerms}
                  onChange={e => setProjectDetail(p => ({ ...p, paymentTerms: e.target.value }))}
                />
              </div>
            </Col>
          </Row>
        </Card>

        <Row gutter={16} className="mt-4">
          <Col span={12}>
            <Card title="Quotation Metadata" className="rounded-xl shadow-sm border-gray-100 h-full">
              <Space direction="vertical" className="w-full">
                <div>
                  <span className="block text-sm mb-1 font-semibold text-gray-700">Lead Time (Days):</span>
                  <InputNumber min={0} disabled={isViewOnly} className="!w-full" value={quotationMeta.leadTimeDays} onChange={v => setQuotationMeta(p => ({ ...p, leadTimeDays: v }))} />
                </div>
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
                        parser={value => value.replace(/Rp\s?|(,*)/g, '')}
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
          <Col span={12} >
            <Card title="Summary & Totals" className="rounded-xl shadow-sm border-gray-100 h-full bg-gray-50">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Text>Base Price ({quotationMeta.currency}):</Text>
                  <Text strong>{basePrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</Text>
                </div>
                <div className="flex justify-between items-center">
                  <Text>Margin (%):</Text>
                  <InputNumber controls={false} min={0} max={100} disabled={isViewOnly} value={quotationMeta.margin} onChange={v => setQuotationMeta(p => ({ ...p, margin: v }))} />
                </div>

                <div className="pt-4 border-t border-gray-200">
                  {quotationMeta.currency !== finalCurrency ? (
                    <>
                      <div className="flex justify-between items-center mb-1">
                        <Text type="secondary" className="text-sm">Total In {quotationMeta.currency}:</Text>
                        <Text type="secondary" className="text-sm">{inputTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</Text>
                      </div>
                      <div className="flex justify-between items-center">
                        <Title level={4} style={{ margin: 0, color: '#1677ff' }}>Final Total ({finalCurrency}):</Title>
                        <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
                          {finalCurrency === 'IDR' ? `Rp ${totalPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : `${totalPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })} ${finalCurrency}`}
                        </Title>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <Title level={4} style={{ margin: 0, color: '#1677ff' }}>Total ({finalCurrency}):</Title>
                      <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
                        {finalCurrency === 'IDR' ? `Rp ${totalPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : `${totalPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })} ${finalCurrency}`}
                      </Title>
                    </div>
                  )}
                </div>

                <div className="mt-4 p-3 bg-gray-100 rounded-lg text-[11px] text-gray-500">
                  <strong>Billing Rules:</strong>
                  <ul className="pl-4 mt-1 space-y-1">
                    <li><strong>Local Customer:</strong> Final Quotation will be issued in **IDR** (Auto-conversion if input is EUR).</li>
                    <li><strong>Foreign Customer:</strong> Final Quotation issued in selected currency (**{quotationMeta.currency}**).</li>
                  </ul>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </>
  );
};

export default CreateFromInquiry;
