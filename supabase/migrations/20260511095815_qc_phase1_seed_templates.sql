-- QC Module — Phase 1 step 3: seed the two checklist templates from the
-- Excel file (QC_and_Order_Checklist.xlsx). Both seeded as global templates
-- (factory_id NULL) so every factory inherits them.

-- Create the two templates
WITH inserted AS (
  INSERT INTO public.qc_checklist_templates (factory_id, kind, name, version)
  VALUES
    (NULL, 'order_manager', 'Pre-Shipment Checklist v1', 1),
    (NULL, 'daily_qc',      'Daily QC Checklist v1',    1)
  RETURNING id, kind
)
INSERT INTO public.qc_checklist_template_items
  (template_id, section_label, section_order, item_code, item_label, item_guidance, item_order)
SELECT i.id, v.section_label, v.section_order, v.item_code, v.item_label, v.item_guidance, v.item_order
FROM inserted i
JOIN (
  -- ── ORDER MANAGER TRACKER ─────────────────────────────────────
  VALUES
    -- Phase 1 — Order Confirmation & Planning
    ('order_manager','PHASE 1 — ORDER CONFIRMATION & PLANNING',1,'1.1','PO received and acknowledged','Confirm PO details match quotation — qty, price, delivery',1),
    ('order_manager','PHASE 1 — ORDER CONFIRMATION & PLANNING',1,'1.2','Size ratio and colour breakdown confirmed','Signed off with buyer — no verbal agreements only',2),
    ('order_manager','PHASE 1 — ORDER CONFIRMATION & PLANNING',1,'1.3','Delivery date confirmed and production slot booked','Check factory capacity — no overloading',3),
    ('order_manager','PHASE 1 — ORDER CONFIRMATION & PLANNING',1,'1.4','Fabric and trims lead time planned','Ensure fabric arrives in time for pilot run',4),
    ('order_manager','PHASE 1 — ORDER CONFIRMATION & PLANNING',1,'1.5','Tech pack and approved sample received','All pages present — measurement spec, construction detail',5),
    -- Phase 2 — Pre-Production
    ('order_manager','PHASE 2 — PRE-PRODUCTION',2,'2.1','Fabric bulk received and inspected (4-point system)','10% of rolls inspected — shade, width, defects',1),
    ('order_manager','PHASE 2 — PRE-PRODUCTION',2,'2.2','Shrinkage test completed and recorded','Warp and weft % recorded and within tolerance',2),
    ('order_manager','PHASE 2 — PRE-PRODUCTION',2,'2.3','Size set samples made and approved by buyer','Written approval received — not verbal',3),
    ('order_manager','PHASE 2 — PRE-PRODUCTION',2,'2.4','Trims received and checked vs spec','Labels, buttons, zippers, thread — all match approval',4),
    ('order_manager','PHASE 2 — PRE-PRODUCTION',2,'2.5','PP (Pre-Production) meeting held','IE, cutting, sewing, QC, and finishing all briefed',5),
    ('order_manager','PHASE 2 — PRE-PRODUCTION',2,'2.6','Pilot run completed — issues resolved','Minimum 50 pcs run — all QC issues corrected before bulk',6),
    -- Phase 3 — Production Monitoring
    ('order_manager','PHASE 3 — PRODUCTION MONITORING',3,'3.1','Daily output vs target tracked','Report shared with order manager every morning',1),
    ('order_manager','PHASE 3 — PRODUCTION MONITORING',3,'3.2','Inline QC reports reviewed daily','DHU % per line reviewed — action taken if >5%',2),
    ('order_manager','PHASE 3 — PRODUCTION MONITORING',3,'3.3','Fabric consumption vs allowance tracked','Cutting ratio monitored — excess flagged immediately',3),
    ('order_manager','PHASE 3 — PRODUCTION MONITORING',3,'3.4','Alteration and rejection tracked by defect type','Top 3 defects identified and root cause addressed',4),
    ('order_manager','PHASE 3 — PRODUCTION MONITORING',3,'3.5','Buyer''s QC visit / inline inspection passed','Written inspection report filed',5),
    -- Phase 4 — Finishing & Final Inspection
    ('order_manager','PHASE 4 — FINISHING & FINAL INSPECTION',4,'4.1','All labels and trims correctly attached','See Daily QC Checklist Section 4 — 100% check',1),
    ('order_manager','PHASE 4 — FINISHING & FINAL INSPECTION',4,'4.2','Measurements checked on finished garments','Minimum 3 pcs per size — within buyer tolerance',2),
    ('order_manager','PHASE 4 — FINISHING & FINAL INSPECTION',4,'4.3','Final inspection (internal) passed','DHU below 2.5% — zero critical defects',3),
    ('order_manager','PHASE 4 — FINISHING & FINAL INSPECTION',4,'4.4','AQL inspection booked with buyer','Inspection date confirmed — garments ready 2 days prior',4),
    ('order_manager','PHASE 4 — FINISHING & FINAL INSPECTION',4,'4.5','AQL inspection passed — report received','Pass certificate filed — any conditional pass actioned',5),
    ('order_manager','PHASE 4 — FINISHING & FINAL INSPECTION',4,'4.6','Third party inspection passed (if required)','SGS / Intertek / Bureau Veritas — report filed',6),
    -- Phase 5 — Packing & Shipment
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.1','Packing done as per buyer packing instruction','Fold, poly bag, carton — all per spec',1),
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.2','Packing list prepared and verified','Style, colour, size, qty per carton — all correct',2),
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.3','Cartons marked correctly','All required info on carton — PO, destination, country',3),
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.4','Shipping marks approved by buyer','Send photo to buyer before packing if first order',4),
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.5','Commercial invoice prepared','All details match PO — price, qty, description, terms',5),
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.6','Packing list matches commercial invoice','Zero discrepancy — customs will reject if mismatch',6),
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.7','Certificate of origin obtained','Form A / GSP / back-to-back LC — as buyer requires',7),
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.8','Test reports available (chemical / safety)','REACH, Oeko-Tex, CPSC — as required by destination',8),
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.9','Booking confirmation from freight forwarder','Vessel / airline booked — ETD confirmed',9),
    ('order_manager','PHASE 5 — PACKING & SHIPMENT',5,'5.10','Shipment documents sent to buyer','BL / AWB, invoice, packing list, COO — on time',10),

  -- ── DAILY QC CHECKLIST ────────────────────────────────────────
    -- Section 1 — Sewing Quality
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.1','Stitch density (SPI) correct','Check per OB. Denim: 10–12 SPI. Woven shirts: 12–14 SPI',1),
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.2','No skipped stitches','Sample minimum 10 pcs per line per hour',2),
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.3','Seam allowance consistent','Check side seams, inseams, yoke — measure with ruler',3),
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.4','No open seams or loose threads','Check at inline station after each operation',4),
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.5','Stitch tension correct — no puckering','Pull seam gently — should not pucker or open',5),
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.6','Bartacks and rivets correctly placed','Pocket corners, fly — compare to approved sample',6),
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.7','Zipper functioning correctly','Pull test — slider must not be loose or misaligned',7),
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.8','Buttonhole size and placement correct','Check all buttonholes — must match spec sheet',8),
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.9','Symmetry — left vs right side match','Pocket height, pleat position, dart placement',9),
    ('daily_qc','SECTION 1 — SEWING QUALITY',1,'1.10','No oil stains, dirty marks, or damage','Hold against light — check both sides of fabric',10),
    -- Section 2 — Fabric & Denim Shrinkage
    ('daily_qc','SECTION 2 — FABRIC & DENIM SHRINKAGE',2,'2.1','Shrinkage test done before cutting','Warp and weft tested — record % in notes',1),
    ('daily_qc','SECTION 2 — FABRIC & DENIM SHRINKAGE',2,'2.2','Warp shrinkage within buyer tolerance','Typical denim tolerance: ≤5%. Record actual %',2),
    ('daily_qc','SECTION 2 — FABRIC & DENIM SHRINKAGE',2,'2.3','Weft shrinkage within buyer tolerance','Typical denim tolerance: ≤3%. Record actual %',3),
    ('daily_qc','SECTION 2 — FABRIC & DENIM SHRINKAGE',2,'2.4','Wash shrinkage tested on bulk fabric lot','Test at least 1 pc per fabric roll / dye lot',4),
    ('daily_qc','SECTION 2 — FABRIC & DENIM SHRINKAGE',2,'2.5','Lot-to-lot shrinkage variation checked','Different dye lots must be tested separately',5),
    ('daily_qc','SECTION 2 — FABRIC & DENIM SHRINKAGE',2,'2.6','Fabric shade consistent across lots','Compare rolls side by side in daylight',6),
    ('daily_qc','SECTION 2 — FABRIC & DENIM SHRINKAGE',2,'2.7','No fabric defects in cut panels','Holes, slubs, broken yarns, weaving faults',7),
    -- Section 3 — Pattern & Measurements
    ('daily_qc','SECTION 3 — PATTERN & MEASUREMENTS',3,'3.1','Pattern graded correctly for shrinkage','Pattern must add shrinkage allowance before cutting',1),
    ('daily_qc','SECTION 3 — PATTERN & MEASUREMENTS',3,'3.2','Pre-wash measurements taken and recorded','Waist, hip, inseam, front rise, back rise, thigh',2),
    ('daily_qc','SECTION 3 — PATTERN & MEASUREMENTS',3,'3.3','Post-wash measurements within spec','Compare to buyer measurement chart with tolerance',3),
    ('daily_qc','SECTION 3 — PATTERN & MEASUREMENTS',3,'3.4','Pocket placement measurements correct','Check symmetry — measure from seam reference points',4),
    ('daily_qc','SECTION 3 — PATTERN & MEASUREMENTS',3,'3.5','Fly length and rise consistent across sizes','Check minimum 3 pcs per size after sewing',5),
    ('daily_qc','SECTION 3 — PATTERN & MEASUREMENTS',3,'3.6','All sizes in size set measured and approved','Do not bulk cut until full size set is approved',6),
    ('daily_qc','SECTION 3 — PATTERN & MEASUREMENTS',3,'3.7','Measurements recorded on size set report','File report with QC manager before production start',7),
    -- Section 4 — Finishing: Tags & Labels
    ('daily_qc','SECTION 4 — FINISHING: TAGS & LABELS',4,'4.1','Main label stitched correctly — straight, centred','No slanted stitching. Position per buyer spec',1),
    ('daily_qc','SECTION 4 — FINISHING: TAGS & LABELS',4,'4.2','Care label attached and content correct','Washing symbols correct for buyer market (EU/US/UK)',2),
    ('daily_qc','SECTION 4 — FINISHING: TAGS & LABELS',4,'4.3','Size label correct and matches garment size','Cross-check label size vs actual garment measurement',3),
    ('daily_qc','SECTION 4 — FINISHING: TAGS & LABELS',4,'4.4','Country of origin label present','''Made in Bangladesh'' required on all export garments',4),
    ('daily_qc','SECTION 4 — FINISHING: TAGS & LABELS',4,'4.5','Composition label present and correct','Fibre content % must match fabric test certificate',5),
    ('daily_qc','SECTION 4 — FINISHING: TAGS & LABELS',4,'4.6','Hangtag attached correctly','Thread colour, position, knot type per buyer spec',6),
    ('daily_qc','SECTION 4 — FINISHING: TAGS & LABELS',4,'4.7','Barcode / price ticket scannable','Scan test minimum 5 pcs per batch — record results',7),
    ('daily_qc','SECTION 4 — FINISHING: TAGS & LABELS',4,'4.8','No wrong labels or mixed sizes in batch','Check every pc — mixed labels cause buyer rejection',8),
    -- Section 5 — Steaming & Packing
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.1','Garment fully pressed — no creases or shine','Check collar, fly, pocket area, inseam, waistband',1),
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.2','No steam marks or water spots','Hold garment against light to check entire surface',2),
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.3','Buttons and snaps closed before folding','All buttons done up — prevents crease marks',3),
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.4','Fold dimensions correct per buyer spec','Measure fold — buyers often specify exact cm',4),
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.5','Tissue / board insert used if required','Check buyer packing instruction for inserts',5),
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.6','Poly bag correct size — sealed properly','No excess air. Sealed end must face bottom',6),
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.7','Correct assortment per carton ratio','Check size ratio and colour mix per packing list',7),
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.8','Carton gross weight within shipping limit','Weigh 5% of cartons randomly — record on carton',8),
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.9','Carton marked correctly — all required info','PO, style, size, qty, destination, country of origin',9),
    ('daily_qc','SECTION 5 — STEAMING & PACKING',5,'5.10','Shipping marks and stickers per buyer spec','Check buyer requirements — some have strict specs',10)
) AS v(kind, section_label, section_order, item_code, item_label, item_guidance, item_order)
  ON i.kind = v.kind;
