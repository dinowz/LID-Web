import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Typography,
  Space,
  Button,
  message,
  Select,
  Input,
  InputNumber,
  Row,
  Col,
  Tag,
  Collapse,
  DatePicker,
  Checkbox
} from 'antd';
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

const STANDARD_PRICING_TEXT = `- The above rates are for a normal working time for 48 hours per week
- Equivalent to 8 hours / day from monday to saturday
- Travel time is considered as working time`;

const DEFAULT_TC_ITEMS = [
  { id: 1, no: "1", checked: false, text: "Scope of Application", originalText: "" },
  { id: 2, no: "1.1.", checked: false, text: "Unless otherwise agreed in each individual case, the following Terms and Conditions shall exclusively apply to all assembly, assembly supervision, commissioning and external service work taken on by us. The Terms and Conditions shall apply accordingly to repair work which we take on. Any deviating terms and conditions or counter-confirmations of the Customer shall only commit us, if, and to the extent that we have expressly consented thereto in writing. In particular our silence to such deviating terms and conditions shall not be considered acknowledgement or consent. We hereby expressly object to such deviating terms and conditions or counter-confirmations of the Customer.", originalText: "" },

  { id: 3, no: "2", checked: false, text: "Price", originalText: "" },
  { id: 4, no: "2.1.", checked: false, text: "Unless otherwise expressly agreed upon in writing, we shall charge for our services by time and expense pursuant to our cost rates (attached hereto) prevailing at the time of execution.", originalText: "" },
  { id: 5, no: "2.2.", checked: false, text: "Our prices are net exclusive of any statutory turnover tax.\n\nAny withholding tax required by the applicable laws and regulations of Indonesia shall be withheld by the Client and remitted to the relevant tax authority. The Client shall provide the corresponding tax withholding certificate promptly after such remittance.", originalText: "" },
  { id: 6, no: "2.3.", checked: false, text: "Any agreement on a flat-rate price instead of a fee pursuant to Subcondition 2.2 must be made expressly. Our flat-rate price quotations are calculated on the following basis:\n- timely commencement of assembly work,\n- normal and uninterrupted course of assembly work and\n- assembly work during normal working hours and on working days, but the Client shall enable services taken on by us to also be rendered outside of or in addition to normal working hours.\n\nIf the aforementioned bases of our price calculation do not materialise or exist for reasons attributable to the Client or if the Client requests changes to services taken on by us, the Client shall be separately invoiced for additional expenses incurred as a result thereof pursuant to our assembly rates.\n\nThis also applies to assembly work requested by the Client outside of normal working hours and working days.", originalText: "" },
  { id: 7, no: "2.4.", checked: false, text: "Working time sheets presented to the Client for signing from time to time shall serve as proof of services rendered.\n\nWe shall charge for our services once assembly work is completed or (if assembly work takes longer than one month) at the end of each month. Invoices shall be due and payable immediately.\n\nSpecial formalities regarding invoicing shall be communicated by the Client in good time upon requesting our staff.\n\nVoluntary services agreed upon with us may not be deducted.", originalText: "" },

  { id: 8, no: "3", checked: false, text: "Duties of our Assembly Supervisor and Commissioning Engineer", originalText: "" },
  { id: 9, no: "3.1.", checked: false, text: "Upon arrival at the building site our assembly supervisor shall inspect all dimensions of buildings and foundations. The Client shall name a contact person. The assembly supervisor shall draw up a record together with this contact person.", originalText: "" },
  { id: 10, no: "3.2.", checked: false, text: "With the aid of package lists and drawings our assembly supervisor shall check all machine and pipe parts delivered by us. Possible transport damage, losses during transportation or non-deliveries shall be recorded and immediately reported to us. We or the Client shall inform the insurance company without delay.", originalText: "" },
  { id: 11, no: "3.3.", checked: false, text: "Our assembly supervisor shall be entitled to give the Client's staff all instructions necessary in connection with our deliveries for proper assembly. For this purpose, our assembly supervisor shall make available to the Client's staff all information of a technical nature. Furthermore, the assembly supervisor shall be obliged to instruct operating and maintenance staff during his supervisory work.", originalText: "" },
  { id: 12, no: "3.4.", checked: false, text: "Together with the Client's contact person our assembly supervisor shall draw up records of each completed assembly of machine deliveries and subsequent mechanical test runs.", originalText: "" },
  { id: 13, no: "3.5.", checked: false, text: "Our assembly supervisor shall be present at the commencement of commissioning and shall support the commissioning engineer by supervising the machines.", originalText: "" },
  { id: 14, no: "3.6.", checked: false, text: "Our commissioning engineer shall take over responsibility for the plant from the assembly supervisory upon commencement of idle running tests and the technical function test of the entire plant. The Client shall name a contact person. Together with these two a record of proper execution of these idle running tests and the function test shall be drawn up.", originalText: "" },
  { id: 15, no: "3.7.", checked: false, text: "Thereafter our commissioning engineer shall commission the grinding mill along with charging material. Commissioning shall be carried out under his responsibility (i.e. the instructions he gives to the Client's operating staff for maintaining and optimising grinding operations or also for protecting the machines delivered must be accepted and followed by the Client's staff).", originalText: "" },
  { id: 16, no: "3.8.", checked: false, text: "Our commissioning engineer together with the Client's staff shall agree upon a date for plant performance runs. The record drawn up in this connection (including entries of performance data attained) shall be countersigned by the Client's employee responsible. This applies, even if the performance parameters mentioned in the technical conditions are not attained. In this case the reasons for non-attainment shall be entered under the point \"Complaints\".", originalText: "" },
  { id: 17, no: "3.9.", checked: false, text: "During the whole time whilst present our commissioning engineer shall be obliged to make all essential technical information available to the Client's staff and train this staff in how to operate the grinding mill.", originalText: "" },

  { id: 18, no: "4", checked: false, text: "Safety, Prevention of Accidents", originalText: "" },
  { id: 19, no: "4.1.", checked: false, text: "In good time prior to commencement of assembly work the Client shall inform us of safety regulations (particularly rules for the prevention of accidents) applicable to the place where assembly works is to be carried out.", originalText: "" },
  { id: 20, no: "4.2.", checked: false, text: "The Client shall take safety precautions (including any essential special measures) necessary for protecting persons and property at the place where assembly work is to be carried out.", originalText: "" },
  { id: 21, no: "4.3.", checked: false, text: "The Client shall inform our on-site assembly staff about existing safety regulations, in so far as these are relevant to the execution of assembly work. In so far as a building site manager or project manager is appointed by the Client, this person shall ensure that safety regulations (particularly rules for the prevention of accidents) are observed by our assembly staff. The Client shall immediately notify us of infringements of safety regulations by our assembly staff. In the case of gross infringements the Client may (in agreement with us) refuse to allow the infringing party access to the place of assembly.", originalText: "" },
  { id: 22, no: "4.4.", checked: false, text: "In the event of emergencies / accidents the Client shall be obliged to give our assembly staff appropriate assistance and immediately inform us.", originalText: "" },
  { id: 23, no: "4.5.", checked: false, text: "During assembly, commissioning and assembly supervision the Client shall effect at its expense corresponding assembly insurance which shall also cover us and our staff whilst working at the building site, whereby recourse to us shall be excluded.", originalText: "" },

  { id: 24, no: "5", checked: false, text: "Co-operation and Technical Assistance on the Part of the Client", originalText: "" },
  { id: 25, no: "5.1.", checked: false, text: "In good time prior to commencement of our services the Client shall be obliged to obtain all public permits and any essential private licenses necessary in this connection, to enable our services to commence on time and be carried out without interruption. This particularly applies to work permits, visas, special permits for overtime (work on Sundays and public holidays) and special emergencies.", originalText: "" },
  { id: 26, no: "5.2.", checked: false, text: "The Client undertakes to effectively assist the timely rendering of services taken on by us. In particular the Client shall at its expense and risk take on and provide in due time the following deliveries and services:", originalText: "" },
  { id: 27, no: "a)", checked: false, text: "Trained machine fitters, high-voltage electricians, arc welders and helpers along with respective tools. The Client's staff must be qualified for the respective work and be prepared to work in compliance with our assembly staff's instructions. We accept no liability for the Client's staff.", originalText: "" },
  { id: 28, no: "b)", checked: false, text: "All foundations including the sealing of anchoring holes, overground and underground buildings, fortified approach roads to the assembly site.", originalText: "" },
  { id: 29, no: "c)", checked: false, text: "Auxiliary equipment required for assembly and commissioning or repair work such as for example tools, hoisting gear, welding equipment (including all essential protective equipment stipulated by the mutual indemnity association and/or by law) as well as essential implements and materials such as lubricating and hydraulic oils, scaffolding, wedges, spacers for adjusting and aligning, cleaning materials and sealing agents, all energy such as electricity, water, compressed air, welding gases, supply of all consumables and fuels including essential connections at the assembly site. If auxiliary assembly equipment has to be supplied by our assembly staff, the cost thereof shall be charged.", originalText: "" },
  { id: 30, no: "d)", checked: false, text: "Adequate lighting of the assembly site.", originalText: "" },
  { id: 31, no: "e)", checked: false, text: "Suitable dry, illuminated and lockable rooms right next to the assembly site for storing switch cabinets (particularly machine parts, tools of our assembly staff etc.).", originalText: "" },
  { id: 32, no: "f)", checked: false, text: "For our assembly staff suitable well-illuminated recreation rooms fitted with all essential furnishings and fittings including heating/air conditioning, lighting, washing and sanitary facilities (including daily cleaning free of charge), a dry, lockable changing room with first aid equipment as well as a telephone fax machine and internet access (E-Mail) for our assembly manager. These premises must also have essential equipment for drawing up reports and records.", originalText: "" },
  { id: 33, no: "g)", checked: false, text: "Unloading assembly parts, tools and auxiliary equipment at the assembly site.", originalText: "" },
  { id: 34, no: "h)", checked: false, text: "Proper storage of assembly parts at the place of assembly (including protection against theft, damage and effects of the weather) and transportation thereof to the assembly site as well as loading and unloading, if it is not possible to store assembly parts right next to the assembly site.", originalText: "" },
  { id: 35, no: "i)", checked: false, text: "Protective clothing and protective devices necessary as a result of special circumstances at the assembly site.", originalText: "" },
  { id: 36, no: "j)", checked: false, text: "The provision of appropriate housing accommodation consistent with appropriate standards and located near to the assembly site for our assembly staff. If the Client fails to find such accommodation by the time our assembly staff arrive, the assembly staff themselves shall endeavour to find accommodation. The Client shall bear the resulting additional cost of lost time and expenditure in connection therewith.", originalText: "" },
  { id: 37, no: "k)", checked: false, text: "Appropriate standard shall mean:\n\nFor each person, at least one room (approx. 20 m²) with laundry service, WC and shower (warm and cold water) shall be provided. The room(s) shall be sufficiently equipped with furniture (bed, wardrobe, desk chair, table), be air conditioned (air condition/heating) and contain refrigerator, telephone and satellite television (min. one German or English program). In camps, there must be the possibility to prepare a meal individually inside the accommodation area.\n\nThe accommodation/room shall be cleaned daily free of charge and the towels shall be changed daily. The bed linen shall be changed every week.\n\nAdditional washing-, cleaning- and disinfection products and bottled drinking-water shall be provided free of charge by the Client. The same applies to electricity, water, gas etc.", originalText: "" },
  { id: 38, no: "l)", checked: false, text: "Suitable means of transportation (e.g. factory car, hired car, taxi) which shall be made available to our staff at all times during the period of assembly and commissioning. The Client shall organise and undertake to transport our personnel between airport and accommodation on arrival and at departure. If the Client provides a vehicle with driver, both vehicle and driver shall be available to us.\n\nThe effecting of insurance for the entire object of assembly (plant parts) and assembly equipment (tools and auxiliary machines) from the time of delivery up to the time of acceptance for covering against all unforeseen and sudden property damage and losses in the stages of formation and testing (assembly all-risk insurance).", originalText: "" },
  { id: 39, no: "m)", checked: false, text: "Ensuring proper working of the machines and equipment which are not part of our scope of supply.", originalText: "" },
  { id: 40, no: "5.3.", checked: false, text: "The Client's technical assistance must ensure that assembly work and subsequent commissioning are begun immediately after the assembly staff arrive and can be carried out without delay or interruption by the Client. In so far as special plans or instructions are necessary on our part, we shall make these available to the Client in good time. If the Client fails to meet its obligations referred to under Subcondition 5.2, we shall be entitled to set the Client a reasonable respite period for the performance thereof. Once this respite period has expired without effect, we shall be entitled (but not obliged) to carry out the Client's duties in its place and at its expense. This shall not affect any other legal rights and claims on our part.", originalText: "" },
  { id: 41, no: "5.4.", checked: false, text: "In the course of assembly work our assembly staff and the Client's skilled staff (under our instructions) shall carry out the mechanical assembly of the delivery item and immediately thereafter the commissioning (function test).", originalText: "" },

  { id: 42, no: "6", checked: false, text: "Works/Deliveries Carried Out by the Customer", originalText: "" },
  { id: 43, no: "6.1.", checked: false, text: "Rectification work and/or delivery of particular items or material provided by the Customer on our request shall be agreed upon between the parties prior to execution. Such agreement shall be made in writing by means of working time sheets, minutes of meeting, amendments to Contract or the like. Only signed documents by authorized representatives of the parties will be accepted as basis for remuneration.", originalText: "" },

  { id: 44, no: "7", checked: false, text: "Time of Delivery and Bearing of Risk", originalText: "" },
  { id: 45, no: "7.1.", checked: false, text: "Dates and periods for our performance shall be agreed upon expressly and in writing in order to be binding. In case of any dates and periods for our performance which are subject to change or only approximate indications (e.g. app., about, etc.), we shall use our best efforts to comply with them.", originalText: "" },
  { id: 46, no: "7.2.", checked: false, text: "Commencement of the performance time limits / periods quoted by us shall be subject to the conditions that all technical questions have been cleared up, all documents or essential permits to be supplied by the Client have been received in good time, any plans have been clarified and approved in good time and all other obligations of the Client have been properly fulfilled in good time.", originalText: "" },
  { id: 47, no: "7.3.", checked: false, text: "In case of non-delivery, incorrect or delayed delivery or non-performance, incorrect or delayed performance of any services by our suppliers for reasons beyond our responsibility or in any event of force majeure, we shall be entitled to delay the delivery for the period of such obstruction or withdraw from the contract, either in whole or in part, with respect to the part yet outstanding. Force majeure shall also be strikes, lock-outs, administrative orders and actions, shortage of energy and raw material, shortage of transport capacity, pandemics and epidemics, business obstacles beyond our responsibility, e.g. by fire, flood, destruction of machinery, and any other obstacles that, from an objective point of view, have not been caused by our fault. The above provisions shall also apply if any circumstances should arise which have been mentioned therein and led to a default on our part. The costs caused by the delay shall be borne by the Client.", originalText: "" },
  { id: 48, no: "7.4.", checked: false, text: "Loesche keeps an internal record, in which Loesche - based on its various contracts and agreed project time schedules with its different clients - schedules the allocation of its different supervisory personnel to the different projects.\n\nTherefore it is essential for Loesche that such project time schedules as agreed with the respective client, which also identify the time for allocation of Loesche's supervisory personnel (travel dates, start, duration of stay on site etc. with regard to the respective project) are strictly adhered to.\n\nWhere therefore due to reasons out of the Client's sphere (as for example without being limited thereto delay in the preparation of the site, foundations, delays of the Client's or third parties deliveries etc.) the allocation of the foreseen Loesche supervisory personnel to the site has to be delayed or interrupted in ratio to the agreed project time schedule, Loesche shall be entitled to claim from the Client the following flat rate as compensation for any period of delay and/or of interruption:\n\nDelay for allocation to site (and/or local manufacture)\ni) between 1 day up to 7 days: 60% from the daily rate for the supervisors.\nii) beyond 7 days: 40% from the daily rate for the supervisors plus cancellation cost for already booked travel and/or accommodation arrangement or additionally required travels.", originalText: "" },
  { id: 49, no: "7.5.", checked: false, text: "If waiting periods, extensions of the agreed assembly period and daily travelling times or repeated journeys ensue due to circumstances attributable to the Client, the Client shall bear the resulting additional costs calculated by time and expense pursuant to our delegation rates.", originalText: "" },
  { id: 50, no: "7.6.", checked: false, text: "If assembly work is interrupted due to circumstances attributable to the Client, the risk in respect of services already rendered shall be passed to the Client for the duration of the interruption.", originalText: "" },
  { id: 51, no: "7.7.", checked: false, text: "Any claims for damages because of default or non-performance - irrespective of the reason thereof - may be asserted in accordance with the provisions set out in Sec. 10 only.\n\nWe shall not be in default as long as the Client is in default with the performance of any of his obligations towards us, including obligations arising out of any other contracts.", originalText: "" },
  { id: 52, no: "7.8.", checked: false, text: "If assembly work is destroyed or adversely affected prior to acceptance for reasons attributable to the Client, we shall be entitled to charge the agreed price less expenses saved. The same applies in the event that it becomes impossible to carry out assembly work through the fault of the Client.\n\nThe Client may demand that assembly work be repeated, if and in so far as we can be reasonably expected to do so (particularly in consideration of our other contractual obligations). A fee for repeated assembly work shall again be payable to us based on contract prices.", originalText: "" },

  { id: 53, no: "8", checked: false, text: "Acceptance", originalText: "" },
  { id: 54, no: "8.1.", checked: false, text: "Upon our notification of completion of assembly work the Client shall be required to accept our services (i.e. including the delivery item) within 6 months, otherwise within 18 months as from the agreed date of delivery.", originalText: "" },
  { id: 55, no: "8.2.", checked: false, text: "The acceptance shall be effected by means of an acceptance run. The acceptance run shall take place under normal working conditions. Its duration is 12 hours of uninterrupted operation. At own cost the Client shall make material available in sufficient quantity and quality, likewise operating personnel, employees, auxiliary and working materials, electricity, heating material, water and other auxiliary materials which we can demand in an appropriate way and in suitable scope for the execution of the acceptance run. The result of the acceptance run shall be recorded in a log and shall be signed by representatives of the Clients and ourselves.", originalText: "" },
  { id: 56, no: "8.3.", checked: false, text: "With the termination of the acceptance run the acceptance is regarded as completed. This does not apply if the grinding mill, despite professional operation and conformity to all operating conditions, falls short of the performance parameters mentioned in the technical conditions, whilst taking into consideration the measurement tolerances.", originalText: "" },
  { id: 57, no: "8.4.", checked: false, text: "In such a case, the Client shall set us a reasonable respite period in which we are required to bring the supplied equipment into a contractually agreed state and to repeat the acceptance run.", originalText: "" },
  { id: 58, no: "8.5.", checked: false, text: "If the acceptance run is interrupted for reasons for which we are not responsible we are entitled to set a reasonable respite period in which the Client is required to create the preconditions for the carrying out of the acceptance run. If after expiry of such respite period an acceptance run has not taken place for reasons for which we are not responsible, then the acceptance is regarded as having been effected. The additional costs caused by interruptions shall be charged to the Client. The running period already achieved before an interruption for which we are not responsible will be added to the running period remaining after an interruption.", originalText: "" },
  { id: 59, no: "8.6.", checked: false, text: "The acceptance is also regarded as having been effected if, for grounds for which we are not responsible, the acceptance run has not taken place within the period specified in paragraph 8.1 of this section or if the Client goes into production with the use of the grinding mill.", originalText: "" },
  { id: 60, no: "8.7.", checked: false, text: "The Client will provide specialist trained personnel and factory laboratory items of equipment for conduct of the necessary analysis in respect of acceptance runs. Analysis must be swift and without delay in order that the adjustment work on the system is not held up. For analysis, test methods and equipment corresponding to the requirements of applicable standards (EN, ASTM etc.) must be made available. On our request, the Client is to provide proof that the equipment is supervised and if applicable calibrated in accordance with the stipulations of the standards documentation.\n\nWe are entitled to check the condition of items of equipment and their calibration by means of tests made available to us and if necessary to require re-calibration, replacement of items of equipment or procurement of items of equipment appropriate to the relevant standards. Should the Customer not meet this requirement, we will provide equipment and specialist personnel appropriate to the acceptance runs. In this event, costs will be borne by the Client.", originalText: "" },

  { id: 61, no: "9", checked: false, text: "Warranty", originalText: "" },
  { id: 62, no: "9.1.", checked: false, text: "If defects in respect of our assembly work emerge after acceptance, the Client shall immediately notify us thereof in writing. We shall be entitled and obliged to remedy the defect. The Client shall give us the time and opportunity necessary for determining and remedying the defect. The Client shall have the right to remedy the defect itself or to have the defect remedied by a third party and to demand from us the reimbursement of essential costs incurred only in urgent cases for maintaining operating safety or for averting a disproportionally large degree of damage (whereby we shall be notified immediately) or if we are default in remedying the defect.", originalText: "" },
  { id: 63, no: "9.2.", checked: false, text: "If we do not comply with the obligation to repair and the Client sets a reasonable respite period, the Client shall be entitled to reduce the agreed price after expiry of the period. The same shall apply if two attempts of repair have failed and further attempts are reasonably unacceptable to the Client, or if any repair and delivery are impossible. Any other claims for damages and reimbursement of expenses shall exist in accordance with the provisions laid down in Sec. 10 only.", originalText: "" },
  { id: 64, no: "9.3.", checked: false, text: "Our warranty shall not apply to natural wear and tear, and furthermore not to damage of any kind which has occurred after acceptance and has not been caused by our fault, particularly on the following grounds: unsuitable or unprofessional use, faulty fitting or maintenance by the Client or a third party, faulty or negligent handling, unsuitable operating materials, replacement parts, faulty construction work, unsuitable foundation, chemical or electrical influences which are not provided for in accordance with the contract.", originalText: "" },
  { id: 65, no: "9.4.", checked: false, text: "Warranty claims shall become barred after the expiry of 5 years from acceptance with regard to buildings, otherwise after the expiry of 12 months from acceptance. The period will be extended in accordance with the remedy work.", originalText: "" },
  { id: 66, no: "9.5.", checked: false, text: "In case of malicious concealment of a defect or the assumption of an express warranty of certain characteristics of the goods any claims of the Client shall exclusively be subject to the statutory provisions.", originalText: "" },

  { id: 67, no: "10", checked: false, text: "Exclusion and Limitation of Liability", originalText: "" },
  { id: 68, no: "10.1.", checked: false, text: "For any claims for damages and reimbursements of expenses directed against us and based upon breach of duty on the grounds of negligence, irrespective of the legal basis, we may be held liable in case of slight negligence only if major contractual duties are violated and, thus, the purpose of the contract is endangered. Otherwise, our liability for slight negligence shall be excluded.", originalText: "" },
  { id: 69, no: "10.2.", checked: false, text: "In the event of liability under Sec. 10.1 hereof and strict liability, we shall be liable for the typical and foreseeable damage only. Claims for vain expenses by the Client are excluded.", originalText: "" },
  { id: 70, no: "10.3.", checked: false, text: "For damages based upon delay we shall be liable in case of slight negligence only up to 5% of the net price of the delivery of the machine.", originalText: "" },
  { id: 71, no: "10.4.", checked: false, text: "The Client shall decide on the use of the goods supplied or other services rendered by us in his own responsibility. Unless we have confirmed in writing specific properties and suitabilities of the delivered good for a purpose stipulated by contract, any advice concerning the technical application shall not be binding in any case. We shall also be liable pursuant to Sec. 10.1 for any advice given or not given.", originalText: "" },
  { id: 72, no: "10.5.", checked: false, text: "The exclusion of liability under Secs. 10.1 to 10.4 shall also apply to the same extent with respect to our management, legal representatives, executives and non-executives, employees and other agents.", originalText: "" },
  { id: 73, no: "10.6.", checked: false, text: "The provisions laid down in Sec. 10.1 to 10.5 shall not be applicable if we are held liable under the Product Liability Act, if we are held liable for the injury of life, body or health, in case of an express warranty of certain characteristics or in case of a malicious concealment of a defect.", originalText: "" },
  { id: 74, no: "10.7.", checked: false, text: "We shall fundamentally not be liable, if the Client continues operating the plant despite the fact that we have (due to defects detected) given a written instruction not to operate the grinding mill until the defects have been remedied or to only operate the grinding mill at reduced capacity up until then.", originalText: "" },
  { id: 75, no: "10.8.", checked: false, text: "For additional work that our staff executes according to the Client's request and which is not included in the original services, we are only liable if we have explicitly confirmed the takeover of these works.", originalText: "" },
  { id: 76, no: "10.9.", checked: false, text: "All claims for damages and reimbursement of expenses against us are barred within 12 months following the delivery of the goods, in the case of a tort liability following the knowledge or grossly negligent ignorance of the circumstances which justify the claim or of the person liable. This does not apply to in case of wilful conduct and in cases pursuant of Sec. 10.6.", originalText: "" },

  { id: 77, no: "11", checked: false, text: "Assembly and Installation of Third-party Part", originalText: "" },
  { id: 78, no: "11.1.", checked: false, text: "Our assembly staff may only assemble and install third-party parts (i.e. parts not supplied by us) with our express written approval. We accept no responsibility whatsoever for the proper functioning of these parts. Third-party parts shall be assembled and installed to the best of our assembly staff's knowledge and belief.", originalText: "" },
  { id: 79, no: "11.2.", checked: false, text: "Unless otherwise expressly agreed in writing, we shall not effect assembly insurance. This shall be a matter for the Client. Should the Client expressly insist that we effect assembly insurance, we shall effect such insurance with appropriate cover at the Client's expense.", originalText: "" },
  { id: 80, no: "11.3.", checked: false, text: "Any taxes or other levies due in connection with the assembly work shall be chargeable solely to the Client or shall be immediately reimbursed to us, if they are imposed by the fiscal administration or any other authority.", originalText: "" },

  { id: 81, no: "12", checked: false, text: "Final Regulations", originalText: "" },
  { id: 82, no: "12.1.", checked: false, text: "All legal relations between the Customer and us shall be exclusively governed by the laws of Indonesia.", originalText: "" },
  { id: 83, no: "12.2.", checked: false, text: "Mutual Discussion\n\nThe Parties agree that if any dispute arises out of or in connection with this Services Agreement, including without limitation any question regarding its existence, validity, termination of rights or obligations of any Party, the Parties will attempt, for a period of 30 Days after the receipt by one Party of a notice from the other Party of the existence of the dispute, to settle such dispute in the first instance by mutual discussions between the Parties.", originalText: "" },
  { id: 84, no: "12.3.", checked: false, text: "Referral to Arbitration\n\nAny dispute that cannot be settled amicably by mutual discussion within the 30 Days period referred to in Sec. 7.3, will be settled by Badan Arbitrase Nasional Indonesia (“BANI”), to be conducted in the English language, in accordance with the rules of the BANI in force at the date of this Services Agreement (“Rules”).", originalText: "" },
  { id: 85, no: "12.4.", checked: false, text: "Venue and Appointment of Arbitrators\n\nThe arbitration will be conducted in Jakarta at the facilities of BANI by three arbitrators. Each Party may appoint one arbitrator, and the third arbitrator, who shall be the Chairman of the tribunal, shall be appointed by the two other arbitrators within 4 Weeks after their appointment, failing which the Chairman of the tribunal shall be appointed by BANI. Any notice of arbitration, response or other communication given to or by a Party to the arbitration will be given and deemed received as provided in the Rules. The costs of the arbitration will be determined and paid by the Parties to the arbitration as provided in the Rules.", originalText: "" },

  { id: 86, no: "13", checked: false, text: "Rates Charged of PT Loesche Indonesia\n(Valid for the year 2026)", originalText: "" },
  { id: 87, no: "13.1.", checked: false, text: "For overtime work the following additional rates will be charged on top of the hourly rates:\n\n25% - for work at night, if not performed as overtime work\n25% - for the first 2 hours of daily overtime work performed on workdays\n50% - for the 3rd and following hours of daily overtime work performed on workdays\n50% - for work at night, so far performed as overtime work\n70% - for work performed on Sundays\n100% - for work performed on any other legal holiday in Indonesia\n150% - for work performed on Islamic New Year’s Day, Idul Fitri and Eid-al-Adha holidays", originalText: "" },
  { id: 88, no: "13.2.", checked: false, text: "Lodging and Travelling Expenses, Special Cost\n\nLodging expenses, including lodging expenses during potential quarantine, will be charged as per the original bills paid.\n\nIf accommodation is provided by the Client, it must satisfy the standards usual in Western Europe as specified in sub clause 5.2 j.\n\nTravelling expenses and all incidental expenses occurring in this connection ex Düsseldorf or the respective domicile of the personnel will be charged as per the original bills paid.\n\nFor the duration of erection and start-up of the plant, a vehicle (car supplied by Client, rental car, taxi) should be provided for the LOESCHE personnel free of charge at any time. If the LOESCHE personnel travel to their destination with private vehicles, the transport costs incurred will be charged in the amount of € 0.60/km.\n\nAfter a six (6) months stay of our personnel at the erection site, the Client will bear the expenses of a return passage for our personnel, provided that the total time of stay will amount to a minimum of eight (8) months. If the period of erection and commissioning includes the time of Christmas, the LOESCHE personnel will be entitled to a passage on Christmas. Those expenses will also be charged to the Client. December 20th will be the last workday of the respective year.\n\nSpecial costs for necessary medical examinations, vaccinations, also in case of pandemics and/or epidemics, insurance costs and other special expenses (i.e. excess baggage, communication costs) will be charged at cost to the Customer.\n\nAny taxes for LOESCHE Field Personnel, social insurance, contribution or other levies due to the local authorities in the Client's country will be borne by the Customer.", originalText: "" }
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

  // Data structure for quotation mappings and inputs
  const [mappings, setMappings] = useState({});
  const [quotationMeta, setQuotationMeta] = useState({
    remarks: '',
    globalDiscount: 0,
    currency: 'IDR',
    exchangeRate: 1,
    clientInquiryDate: null,
    customerInquiryNumber: '',
  });

  const [serviceMeta, setServiceMeta] = useState({
    location: '',
    projectNo: '',
    millType: '',
    attentionTitle: 'Mr.',
    attention: '',
    validityDays: 30,
    scopeOfWork: '',
    paymentTerms: '30 days',
    engineerQtyDesc: '',
    pricingType: 'standard',
    pricingConditionText: STANDARD_PRICING_TEXT,
    paymentMethod: '',
    paymentRequirement: '',
    tcType: 'standard',
    tcItems: DEFAULT_TC_ITEMS.map(item => ({ ...item })),
  });

  const [saving, setSaving] = useState(false);
  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [srvData, sppData] = await Promise.all([
          getServices({ active: true }),
          getSpareParts({ active: true })
        ]);

        setServices(srvData);
        setSpareParts(sppData);

        if (isEdit || isViewOnly) {
          const quoData = await getQuotationById(id);
          setQuotation(quoData);
          setInquiry(quoData.inquiry);

          // Map basic meta
          setQuotationMeta({
            remarks: quoData.remarks,
            globalDiscount: parseFloat(quoData.globalDiscount) || 0,
            currency: quoData.currency,
            exchangeRate: parseFloat(quoData.exchangeRate) || 1,
            clientInquiryDate: quoData.clientInquiryDate ? dayjs(quoData.clientInquiryDate) : (quoData.inquiry?.inquiryDate ? dayjs(quoData.inquiry.inquiryDate) : dayjs(quoData.inquiry?.createdAt)),
            customerInquiryNumber: quoData.customerInquiryNumber || '',
          });

          // Map service-specific meta
          if (quoData.serviceDetail) {
            setServiceMeta({
              location: quoData.serviceDetail.location || quoData.inquiry?.codeWord?.code || '',
              projectNo: quoData.serviceDetail.projectNo || quoData.inquiry?.codeWord?.projectNo || '',
              millType: quoData.serviceDetail.millType || quoData.inquiry?.codeWord?.millType || '',
              attentionTitle: quoData.serviceDetail.attentionTitle || 'Mr.',
              attention: quoData.serviceDetail.attention || '',
              validityDays: quoData.serviceDetail.validityDays,
              scopeOfWork: quoData.serviceDetail.scopeOfWork || '',
              paymentTerms: quoData.serviceDetail.paymentTerms || '',
              engineerQtyDesc: quoData.serviceDetail.engineerQtyDesc || '',
              pricingType: quoData.serviceDetail.pricingType || 'standard',
              pricingConditionText: quoData.serviceDetail.pricingConditionText || STANDARD_PRICING_TEXT,
              paymentMethod: quoData.serviceDetail.paymentMethod || '',
              paymentRequirement: quoData.serviceDetail.paymentRequirement || '',
              tcType: quoData.serviceDetail.tcType || 'standard',
              tcItems: quoData.serviceDetail.tcItems || DEFAULT_TC_ITEMS.map(item => ({ ...item })),
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
              margin: parseFloat(d.margin) || 0,
              note: d.note || ''
            };
          });
          setMappings(initialMap);

        } else {
          const inqData = await prepareQuotationFromInquiry(id);
          setInquiry(inqData);

          const preQuo = inqData.prefilledQuotation;

          // Auto pre-fill location, projectNo, millType, and meta from codeWord or prefilled quotation
          setServiceMeta(prev => ({
            ...prev,
            location: preQuo?.serviceDetail?.location || inqData.codeWord?.code || '',
            projectNo: preQuo?.serviceDetail?.projectNo || inqData.codeWord?.projectNo || '',
            millType: preQuo?.serviceDetail?.millType || inqData.codeWord?.millType || '',
            attentionTitle: preQuo?.serviceDetail?.attentionTitle || 'Mr.',
            attention: preQuo?.serviceDetail?.attention || '',
            validityDays: preQuo?.serviceDetail?.validityDays || 30,
            scopeOfWork: preQuo?.serviceDetail?.scopeOfWork || '',
            paymentTerms: preQuo?.serviceDetail?.paymentTerms || '30 days',
            engineerQtyDesc: preQuo?.serviceDetail?.engineerQtyDesc || '',
            pricingType: preQuo?.serviceDetail?.pricingType || 'standard',
            pricingConditionText: preQuo?.serviceDetail?.pricingConditionText || STANDARD_PRICING_TEXT,
            paymentMethod: preQuo?.serviceDetail?.paymentMethod || '',
            paymentRequirement: preQuo?.serviceDetail?.paymentRequirement || '',
            tcType: preQuo?.serviceDetail?.tcType || 'standard',
            tcItems: preQuo?.serviceDetail?.tcItems || DEFAULT_TC_ITEMS.map(item => ({ ...item })),
          }));

          // Auto-initialize currency and meta based on customer type or prefilled quotation
          const initialCurrency = preQuo?.currency || (inqData.customer?.customerType === 'FOREIGN' ? 'EUR' : 'IDR');
          setQuotationMeta(prev => ({
            ...prev,
            remarks: preQuo?.remarks || prev.remarks,
            currency: initialCurrency,
            exchangeRate: preQuo?.exchangeRate ? parseFloat(preQuo.exchangeRate) : prev.exchangeRate,
            globalDiscount: preQuo?.globalDiscount ? parseFloat(preQuo.globalDiscount) : prev.globalDiscount,
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
            initialMap[d.id] = {
              inquiryDetailId: d.id,
              itemType: d.itemType,
              mappedServiceId: matchedPd?.mappedServiceId ? String(matchedPd.mappedServiceId) : null,
              mappedSparePartId: matchedPd?.mappedSparePartId ? String(matchedPd.mappedSparePartId) : null,
              unitPrice: matchedPd ? parseFloat(matchedPd.unitPrice) || 0 : 0,
              qty: matchedPd?.qty ? parseFloat(matchedPd.qty) : (parseFloat(d.qty) || 1),
              margin: matchedPd ? parseFloat(matchedPd.margin) || 0 : 0,
              note: matchedPd?.note || ''
            };
          });
          setMappings(initialMap);
        }
      } catch (err) {
        message.error('Failed to load data for service quotation');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleMappingChange = (detailId, field, value) => {
    setIsDirty(true);
    setMappings(prev => ({
      ...prev,
      [detailId]: {
        ...prev[detailId],
        [field]: value
      }
    }));
  };

  const handlePricingTypeChange = (value) => {
    setIsDirty(true);
    setServiceMeta(prev => ({
      ...prev,
      pricingType: value,
      pricingConditionText: STANDARD_PRICING_TEXT
    }));
  }

  // Handler untuk mengubah tipe (Standard / Customized)
  const handleTCTypeChange = (value) => {
    setIsDirty(true);
    setServiceMeta(prev => ({
      ...prev,
      tcType: value,
      // Kembalikan ke data standar setiap kali tipe diubah
      tcItems: DEFAULT_TC_ITEMS.map(item => ({ ...item }))
    }));
  };

  const handleTCNoChange = (index, value) => {
    setIsDirty(true);
    setServiceMeta(prev => {
      const newItems = prev.tcItems.map(item => ({ ...item }));
      newItems[index].no = value;
      return { ...prev, tcItems: newItems };
    });
  };

  // Handler untuk Checkbox N/A
  const handleTCCheckbox = (index, isChecked) => {
    setIsDirty(true);
    setServiceMeta(prev => {
      const newItems = prev.tcItems.map(item => ({ ...item }));

      if (isChecked) {
        // Simpan teks yang ada sebelum diubah menjadi N/A
        newItems[index].originalText = newItems[index].text;
        newItems[index].text = "N/A";
      } else {
        // Kembalikan teks asli jika checkbox di-uncheck
        newItems[index].text = newItems[index].originalText;
      }

      newItems[index].checked = isChecked;
      return { ...prev, tcItems: newItems };
    });
  };

  // Handler untuk input text (hanya bisa saat Customized dan tidak di-check)
  const handleTCTextChange = (index, value) => {
    setIsDirty(true);
    setServiceMeta(prev => {
      const newItems = prev.tcItems.map(item => ({ ...item }));
      newItems[index].text = value;
      return { ...prev, tcItems: newItems };
    });
  };

  const calculateTotal = () => {
    let baseTotal = 0;
    let sellPriceTotal = 0;
    const itemCalculations = [];

    Object.values(mappings).forEach(row => {
      const lineBasePrice = Math.round(row.qty * row.unitPrice);
      const marginAmount = Math.round(lineBasePrice * ((row.margin || 0) / 100));
      const lineSellPrice = lineBasePrice + marginAmount;

      baseTotal += (lineBasePrice > 0 ? lineBasePrice : 0);
      sellPriceTotal += (lineSellPrice > 0 ? lineSellPrice : 0);

      const inqDetail = inquiry?.details?.find(d => d.id === row.inquiryDetailId) || {};
      const itemName = inqDetail.requestedItemName || inqDetail.requestDescription || 'Unknown Item';

      itemCalculations.push({
        inquiryDetailId: row.inquiryDetailId,
        itemName,
        qty: row.qty,
        basePrice: lineBasePrice,
        marginPct: row.margin || 0,
        marginAmount,
        sellPrice: lineSellPrice,
      });
    });

    const discountAmount = Math.round(sellPriceTotal * ((quotationMeta.globalDiscount || 0) / 100));
    const finalTotalInInputCurrency = Math.max(sellPriceTotal - discountAmount, 0);

    const isLokal = inquiry?.customer?.customerType !== 'FOREIGN';

    let targetTotal = finalTotalInInputCurrency;
    let targetCurrency = quotationMeta.currency;

    if (isLokal && quotationMeta.currency !== 'IDR') {
      targetTotal = Math.round(finalTotalInInputCurrency * (quotationMeta.exchangeRate || 1));
      targetCurrency = 'IDR';
    }

    return {
      itemCalculations,
      basePrice: baseTotal,
      sellPriceTotal,
      discountAmount,
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
      const { basePrice, inputTotal } = calculateTotal();

      const payload = {
        details: Object.values(mappings).map(m => {
          const lineBasePrice = Math.round(m.qty * m.unitPrice);
          const marginAmount = Math.round(lineBasePrice * ((m.margin || 0) / 100));
          return {
            ...m,
            totalPrice: lineBasePrice + marginAmount
          };
        }),
        basePrice,
        globalDiscount: quotationMeta.globalDiscount,
        totalPrice: inputTotal,
        currency: quotationMeta.currency,
        exchangeRate: quotationMeta.exchangeRate,
        remarks: quotationMeta.remarks,
        clientInquiryDate: quotationMeta.clientInquiryDate.format('YYYY-MM-DD'),
        customerInquiryNumber: quotationMeta.customerInquiryNumber || null,
        quotationType: 'SERVICE',
        serviceDetail: serviceMeta
      };

      if (isEdit) {
        await updateQuotation(id, payload);
        setIsDirty(false);
        message.success('Service Quotation Updated Successfully!');
        navigate(`/service/quotations/${id}`);
      } else {
        const response = await createQuotationFromInquiry(id, payload);
        setIsDirty(false);
        message.success('Service Quotation Created Successfully!');
        navigate(`/service/quotations/${response.id}`);
      }
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !inquiry) return null;

  const { itemCalculations, basePrice, sellPriceTotal, discountAmount, totalPrice, finalCurrency, inputTotal } = calculateTotal();

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
        if (r.itemType === 'SERVICE') {
          const selectedServiceId = mappings[r.id]?.mappedServiceId;
          const selectedService = services.find(s => s.id === selectedServiceId || String(s.id) === String(selectedServiceId));
          return (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                showSearch
                allowClear
                disabled={isViewOnly}
                className="w-full"
                placeholder="Search Master Service..."
                optionFilterProp="label"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                value={selectedServiceId}
                onChange={(v) => handleMappingChange(r.id, 'mappedServiceId', v)}
              >
                {services.map(s => <Option key={s.id} value={s.id} label={`[${s.serviceCode}] ${s.serviceName}`}>[{s.serviceCode}] {s.serviceName}</Option>)}
              </Select>
              {selectedService && (
                <div className="text-[11px] text-gray-500 bg-blue-50 p-2 rounded-md border border-gray-100">
                  <div className="flex justify-between">
                    <span>Estimated Price:</span>
                    <strong className="text-blue-700">{selectedService.currency} {Number(selectedService.estimatedPrice || 0).toLocaleString('en-US')}</strong>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Standard Price:</span>
                    <strong className="text-green-700">{selectedService.currency} {Number(selectedService.standardPrice || 0).toLocaleString('en-US')}</strong>
                  </div>
                </div>
              )}
            </Space>
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
            <div className="flex items-center text-xs text-gray-400 italic">
              * Without Stock Check
            </div>
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
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs">
              Unit Price:
            </span>

            <InputNumber
              controls={false}
              size="small"
              min={0}
              precision={2}
              step={1000}
              className="!w-40"
              disabled={isViewOnly}
              value={mappings[r.id]?.unitPrice ?? 0}
              onChange={(value) =>
                handleMappingChange(
                  r.id,
                  'unitPrice',
                  value ?? 0
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

                const [integerPart, decimalPart] =
                  String(value).split('.');

                const formattedInteger =
                  integerPart.replace(
                    /\B(?=(\d{3})+(?!\d))/g,
                    '.'
                  );

                return decimalPart !== undefined
                  ? `${formattedInteger},${decimalPart}`
                  : formattedInteger;
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
          <div className="flex justify-between items-center">
            <span className="text-xs">Margin (%):</span>
            <InputNumber className="!w-40" controls={false} size="small" min={0} disabled={isViewOnly} value={mappings[r.id]?.margin} onChange={(v) => handleMappingChange(r.id, 'margin', v)} />
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

  const tcColumns = [
    {
      title: 'Check',
      dataIndex: 'checked',
      key: 'checked',
      width: 70,
      align: 'center',
      render: (_, record, index) => (
        <Checkbox
          checked={record.checked}
          onChange={(e) => handleTCCheckbox(index, e.target.checked)}
          // Disable checkbox jika tipenya standard atau viewOnly
          disabled={isViewOnly || serviceMeta.tcType === 'standard'}
        />
      )
    },
    {
      title: 'No',
      dataIndex: 'no', // Gunakan dataIndex 'no' dari state
      key: 'no',
      width: 80, // Sedikit dilebarkan agar input form muat
      align: 'center',
      render: (noValue, record, index) => {
        // Jika Standard atau Checkbox di-centang, tampilkan teks biasa
        if (serviceMeta.tcType === 'standard' || record.checked) {
          return <span className={record.checked ? "text-gray-400 italic" : ""}>{noValue}</span>;
        }

        // Jika Customized, tampilkan form Input
        return (
          <Input
            value={noValue}
            disabled={isViewOnly}
            onChange={(e) => handleTCNoChange(index, e.target.value)}
            className="text-center" // Memastikan ketikan ada di tengah
          />
        );
      }
    },
    {
      title: 'Items',
      dataIndex: 'text',
      key: 'text',
      render: (text, record, index) => {
        // Jika Standard ATAU Checkbox di-centang (N/A), tampilkan sebagai teks statis biasa
        if (serviceMeta.tcType === 'standard' || record.checked) {
          return <span className={record.checked ? "text-gray-400 italic" : ""}>{text}</span>;
        }
        // Jika Customized dan tidak dicentang, tampilkan Input agar bisa diedit
        return (
          <Input
            value={text}
            disabled
            onChange={(e) => handleTCTextChange(index, e.target.value)}
          />
        );
      }
    }
  ];

  return (
    <>
      <UnsavedChangesModal blocker={blocker} />
      <div className="space-y-6 max-w-7xl mx-auto mb-10">
        <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit || isViewOnly ? `/service/quotations/${id}` : `/service/inquiries/${id}`)} />
            <div>
              <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
                {isViewOnly ? `View Service Quotation: ${quotation?.quotationNumber}` : (isEdit ? `Edit Service Quotation: ${quotation?.quotationNumber}` : `Prepare Quotation for: ${inquiry?.inquiryNumber}`)}
              </Title>
              <Text type="secondary">
                {isViewOnly ? 'Read-only view of service pricing and terms.' : (isEdit ? 'Update pricing, services, and commercial terms.' : 'Input pricing details for service quotation.')}
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

        <Row gutter={16} className="mt-4">
          <Col span={12}>
            <Card title="Quotation Metadata" className="rounded-xl shadow-sm border-gray-100 h-full">
              <Space direction="vertical" className="w-full">
                <div>
                  <span className="block text-sm mb-1 font-semibold text-gray-700">
                    Client Inquiry Date <span className="text-red-500">*</span>
                  </span>
                  <DatePicker
                    className="!w-full"
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
                  <span className="block text-sm mb-1 font-semibold text-gray-700">Currency:</span>
                  <Row gutter={8}>
                    <Col span={8}>
                      <Select className="!w-full" disabled={isViewOnly} value={quotationMeta.currency} onChange={v => setQuotationMeta(p => ({ ...p, currency: v, exchangeRate: v === 'IDR' ? 1 : p.exchangeRate }))}>
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
                  <Input.TextArea disabled={isViewOnly} rows={4} value={quotationMeta.remarks} onChange={e => setQuotationMeta(p => ({ ...p, remarks: e.target.value }))} />
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={12} >
            <Card title="Summary & Totals" className="rounded-xl shadow-sm border-gray-100 h-full bg-gray-50">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Text>Base Price ({quotationMeta.currency}):</Text>
                  <Text strong>{basePrice.toLocaleString()}</Text>
                </div>
                <div className="flex justify-between items-center">
                  <Text>Global Discount :</Text>
                  <InputNumber controls={false} className="!w-40" disabled={isViewOnly} min={0} max={100} value={quotationMeta.globalDiscount} onChange={v => setQuotationMeta(p => ({ ...p, globalDiscount: v }))} />
                </div>

                <div className="pt-2 border-t border-gray-200 text-sm">
                  <Collapse defaultActiveKey={['global']} ghost size="small">
                    <Collapse.Panel header={<Text strong className="text-indigo-700">Per-Item Breakdown</Text>} key="items">
                      <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
                        {itemCalculations.map((item, idx) => (
                          <div key={idx} className="bg-white p-2 rounded-lg border border-gray-200">
                            <Text strong className="text-xs text-gray-800">{item.itemName}</Text>
                            <div className="mt-1 space-y-1">
                              <div className="flex justify-between items-center">
                                <Text type="secondary" className="text-[10px]">Base Price</Text>
                                <Text className="text-[10px] text-gray-700">{item.basePrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</Text>
                              </div>
                              <div className="flex justify-between items-center">
                                <Text type="secondary" className="text-[10px]">+ Margin ({item.marginPct}%)</Text>
                                <Text className="text-[10px] text-blue-600">{item.marginAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</Text>
                              </div>
                              <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                                <Text type="secondary" className="text-[10px] font-bold">Item Sell Price</Text>
                                <Text className="text-[10px] text-orange-600 font-bold">{item.sellPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</Text>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Collapse.Panel>

                    <Collapse.Panel header={<Text strong className="text-indigo-700">Grand Total Breakdown</Text>} key="global">
                      <div className="flex justify-between items-center py-1">
                        <Text type="secondary" className="text-xs">Sub Total (Sum of Sell Price)</Text>
                        <Text className="text-xs font-semibold text-gray-700">{sellPriceTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</Text>
                      </div>
                      <div className="flex justify-between items-center py-1 border-t border-gray-100">
                        <Text type="secondary" className="text-xs">- Global Discount ({quotationMeta.globalDiscount || 0}%)</Text>
                        <Text className="text-xs font-semibold text-red-600">-{discountAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</Text>
                      </div>
                      <div className="flex justify-between items-center py-1 border-t border-gray-100">
                        <Text type="secondary" className="text-xs">Total In {quotationMeta.currency}</Text>
                        <Text className="text-xs font-semibold text-blue-700">{inputTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</Text>
                      </div>
                    </Collapse.Panel>
                  </Collapse>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  {quotationMeta.currency !== finalCurrency ? (
                    <>
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
                    <li><strong>Foreign Customer:</strong> Final Quotation issued in the selected currency (**{quotationMeta.currency}**).</li>
                  </ul>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Card title="Service Quotation Details" className="rounded-xl shadow-sm border-gray-100 mt-4">
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Location:</span>
              <Input disabled={isViewOnly} value={serviceMeta.location} onChange={e => setServiceMeta(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Cebu, Philippines" />
            </Col>
            <Col span={8}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Project No:</span>
              <Input disabled={isViewOnly} value={serviceMeta.projectNo} onChange={e => setServiceMeta(p => ({ ...p, projectNo: e.target.value }))} placeholder="e.g. 12105" />
            </Col>
            <Col span={8}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Mill No:</span>
              <Input disabled={isViewOnly} value={serviceMeta.millType} onChange={e => setServiceMeta(p => ({ ...p, millType: e.target.value }))} placeholder="e.g. LM 56.3+3" />
            </Col>

            <Col span={6}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Attention Title:</span>
              <Select disabled={isViewOnly} value={serviceMeta.attentionTitle} onChange={v => setServiceMeta(p => ({ ...p, attentionTitle: v }))} className="w-full">
                <Option value="Mr.">Mr.</Option>
                <Option value="Ms.">Ms.</Option>
                <Option value="Mrs.">Mrs.</Option>
              </Select>
            </Col>
            <Col span={18}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Attention Name:</span>
              <Input disabled={isViewOnly} value={serviceMeta.attention} onChange={e => setServiceMeta(p => ({ ...p, attention: e.target.value }))} placeholder="e.g. Oscar Glenn Samillano" />
            </Col>

            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Engineer / Qty Desc:</span>
              <Input disabled={isViewOnly} value={serviceMeta.engineerQtyDesc} onChange={e => setServiceMeta(p => ({ ...p, engineerQtyDesc: e.target.value }))} placeholder="e.g. 1 Commissioning Engineer" />
            </Col>
            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Validity (Days):</span>
              <InputNumber disabled={isViewOnly} min={1} className="!w-full" value={serviceMeta.validityDays} onChange={v => setServiceMeta(p => ({ ...p, validityDays: v }))} />
            </Col>

            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Payment Terms:</span>
              <Input disabled={isViewOnly} value={serviceMeta.paymentTerms} onChange={e => setServiceMeta(p => ({ ...p, paymentTerms: e.target.value }))} placeholder="e.g. 30 days" />
            </Col>
            <Col span={12}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">
                Client Inquiry Date <span className="text-red-500">*</span>
              </span>
              <DatePicker
                disabled={isViewOnly}
                className="w-full"
                value={quotationMeta.clientInquiryDate}
                onChange={v => setQuotationMeta(p => ({ ...p, clientInquiryDate: v }))}
                format="DD MMM YYYY"
                allowClear={false}
              />
            </Col>

            <Col span={24}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">Scope of Work:</span>
              <Input.TextArea disabled={isViewOnly} rows={4} value={serviceMeta.scopeOfWork} onChange={e => setServiceMeta(p => ({ ...p, scopeOfWork: e.target.value }))} placeholder="Write scope of work, use dashes for bullets if needed" />
            </Col>

            {/* PRICING CONDITION SECTION */}
            <Col span={24}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">
                Pricing Condition:
              </span>

              {/* Dropdown Options */}
              <Select
                disabled={isViewOnly}
                className="w-full !mb-3"
                value={serviceMeta.pricingType || 'standard'}
                onChange={handlePricingTypeChange}
              >
                <Option value="standard">Standard</Option>
                <Option value="customized">Customized</Option>
              </Select>

              {/* Text Area */}
              <Input.TextArea
                rows={4}
                value={serviceMeta.pricingConditionText}
                onChange={e => setServiceMeta(p => ({ ...p, pricingConditionText: e.target.value }))}
                // Logic disable: jika tipenya 'standard', maka textarea tidak bisa diedit
                disabled={isViewOnly || serviceMeta.pricingType === 'standard'}
                placeholder="Enter pricing conditions..."
                className={serviceMeta.pricingType === 'standard' ? "bg-gray-50 text-gray-500" : ""}
              />
            </Col>

            <Col span={24}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">
                Payment Method
              </span>
              <Input.TextArea
                disabled={isViewOnly}
                rows={4}
                placeholder="Write the payment method"
                value={serviceMeta.paymentMethod}
                onChange={e => setServiceMeta(p => ({ ...p, paymentMethod: e.target.value }))}
              />
            </Col>

            <Col span={24}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">
                Payment Requirement
              </span>
              <Input.TextArea
                disabled={isViewOnly}
                rows={4}
                placeholder="Write the payment requirement"
                value={serviceMeta.paymentRequirement}
                onChange={e => setServiceMeta(p => ({ ...p, paymentRequirement: e.target.value }))}
              />
            </Col>

            {/* TERMS & CONDITION SECTION */}
            <Col span={24}>
              <span className="block text-sm mb-1 font-semibold text-gray-700">
                Terms & Conditions:
              </span>

              {/* Dropdown Options */}
              <Select
                disabled={isViewOnly}
                className="w-full !mb-3"
                value={serviceMeta.tcType || 'standard'}
                onChange={handleTCTypeChange}
              >
                <Option value="standard">Standard</Option>
                <Option value="customized">Customized</Option>
              </Select>

              {/* Table Terms & Conditions */}
              <Table
                dataSource={serviceMeta.tcItems}
                columns={tcColumns}
                rowKey="id" // Penting untuk Ant Design agar tidak error warning key
                pagination={false} // Matikan pagination agar semua tampil
                bordered
                size="small"
              />
            </Col>
          </Row>
        </Card>
      </div>
    </>
  );
};

export default CreateFromInquiry;
