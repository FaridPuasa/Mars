// One-off manual script, not part of the running app. Run with
// `node migration-scripts/backfill_to_postgres.js` from the project root.
// Pass --dry-run to log what would be created/updated without writing to
// Postgres.
//
// Two backfill strategies, matched to data shape:
//  - User/Consignee/Declaration3 (small, live-edited via the app): row-by-
//    row upsert keyed on mongoId, idempotent/safe to re-run. Declaration3
//    also replaces its 3 child tables per document, same as
//    syncDeclarationToPostgres() in dualWriteSync.js.
//  - Hscode2/Port_Code/ISO_CountryCodes/Unlocode_port_list2 (large, static
//    reference tables - up to ~112K rows): batched createMany in chunks,
//    NOT idempotent upsert-per-row (would take hours at this volume). Only
//    safe to run against empty tables - checks each table's count first
//    and skips with a warning if it already has rows, rather than
//    duplicating data.
require('dotenv').config();
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 2000;

const User = require('../models/user');
const Consignee = require('../models/consignee');
const Declaration3 = require('../models/declaration3');
const Hscode2 = require('../models/hscode2');
const Port_Code = require('../models/port_code');
const ISO_CountryCodes = require('../models/iso_countrycodes');
const Unlocode_port_list2 = require('../models/unlocode_port_list2');

function n(v) {
    if (v === undefined || v === null || v === '') return null;
    const num = Number(v);
    return Number.isNaN(num) ? null : num;
}

async function backfillUsers() {
    const docs = await User.find({}).select('+password').lean();
    console.log(`\nUser: ${docs.length} documents in Mongo`);
    let upserted = 0;
    for (const doc of docs) {
        const mongoId = doc._id.toString();
        const data = {
            name: doc.name ?? null,
            email: doc.email ?? null,
            password: doc.password ?? null,
            phone: doc.phone ?? null,
            idType: doc.idType ?? null,
            icNo: doc.icNo ?? null,
            icColor: doc.icColor ?? null,
            address: doc.address ?? null,
            registration: doc.registration ?? null,
            postcode: doc.postcode ?? null,
            designation: doc.designation ?? null,
            company: doc.company ?? null,
        };
        if (!DRY_RUN) {
            await prisma.marsUser.upsert({ where: { mongoId }, create: { mongoId, ...data }, update: data });
        }
        upserted++;
    }
    console.log(`  ${DRY_RUN ? 'wouldUpsert' : 'upserted'}=${upserted}`);
}

async function backfillConsignees() {
    const docs = await Consignee.find({}).lean();
    console.log(`\nConsignee: ${docs.length} documents in Mongo`);
    let upserted = 0;
    for (const doc of docs) {
        const mongoId = doc._id.toString();
        const data = {
            name: doc.name ?? null,
            address: doc.address ?? null,
            country: doc.country ?? null,
            reg: doc.reg ?? null,
            ic: doc.ic ?? null,
            icColor: doc.icColor ?? null,
            telephone: doc.telephone ?? null,
            postal: doc.postal ?? null,
        };
        if (!DRY_RUN) {
            await prisma.marsConsignee.upsert({ where: { mongoId }, create: { mongoId, ...data }, update: data });
        }
        upserted++;
    }
    console.log(`  ${DRY_RUN ? 'wouldUpsert' : 'upserted'}=${upserted}`);
}

function declarationToPgData(d) {
    const Procedure = d.Procedure || {};
    const Exporter = d.Exporter || {};
    const Importer = d.Importer || {};
    const Agent = d.Agent || {};
    const Transport = d.Transport || {};
    const SupportingDocuments = d.SupportingDocuments || {};
    const TemporaryImport = d.TemporaryImport || {};
    const Transit = d.Transit || {};
    const SecurityDeposit = d.SecurityDeposit || {};
    const DeclarationGoods = d.DeclarationGoods || {};
    const Declarant = d.Declarant || {};
    return {
        dateGranted: d.dateGranted ?? null,
        departureDate: d.departureDate ?? null,
        cept: d.cept ?? null,
        declarationDate: d.declarationDate ?? null,
        shippingMark: d.shippingMark ?? null,
        postedBy: d.postedBy ?? null,
        customsProcedure: Procedure.customsProcedure ?? null,
        customsProcedureCode: Procedure.customsProcedureCode ?? null,
        prevProcedure: Procedure.prevProcedure ?? null,
        prevProcedureCode: Procedure.prevProcedureCode ?? null,
        dutiableIndicator: Procedure.dutiableIndicator ?? null,
        dutiableIndicatorCode: Procedure.dutiableIndicatorCode ?? null,
        clearanceStation: Procedure.clearanceStation ?? null,
        clearanceStationCode: Procedure.clearanceStationCode ?? null,
        exporterName: Exporter.exporterName ?? null,
        exporterAddress: Exporter.exporterAddress ?? null,
        exporterRegistration: Exporter.exporterRegistration ?? null,
        exporterCountry: Exporter.exporterCountry ?? null,
        exporterPhone: Exporter.exporterPhone ?? null,
        exporterPostal: Exporter.exporterPostal ?? null,
        exporterTransport: Exporter.exporterTransport ?? null,
        importerType: Importer.importerType ?? null,
        importerName: Importer.importerName ?? null,
        importerAddress: Importer.importerAddress ?? null,
        regTraderCoyRegNo: Importer.regTraderCoyRegNo ?? null,
        importerRegistration: Importer.importerRegistration ?? null,
        importerICColor: Importer.importerICColor ?? null,
        importerPhone: Importer.importerPhone ?? null,
        importerPostal: Importer.importerPostal ?? null,
        agentName: Agent.agentName ?? null,
        agentAddress: Agent.agentAddress ?? null,
        agentRegistration: Agent.agentRegistration ?? null,
        agentPhone: Agent.agentPhone ?? null,
        agentPostal: Agent.agentPostal ?? null,
        arrivalDate: Transport.arrivalDate ?? null,
        containerNo: Transport.containerNo ?? null,
        vesselNo: Transport.vesselNo ?? null,
        vesselName: Transport.vesselName ?? null,
        bldoawb: Transport.bldoawb ?? null,
        hbhawb: Transport.hbhawb ?? null,
        countryShipment: Transport.countryShipment ?? null,
        countryShipmentCode: Transport.countryShipmentCode ?? null,
        countryDestination: Transport.countryDestination ?? null,
        countryDestinationCode: Transport.countryDestinationCode ?? null,
        portOfEntry: Transport.portOfEntry ?? null,
        portOfEntryCode: Transport.portOfEntryCode ?? null,
        portOfDischarge: Transport.portOfDischarge ?? null,
        portOfDischargeCode: Transport.portOfDischargeCode ?? null,
        placeRelease: Transport.placeRelease ?? null,
        placeReleaseCode: Transport.placeReleaseCode ?? null,
        placeReceipt: Transport.placeReceipt ?? null,
        placeReceiptCode: Transport.placeReceiptCode ?? null,
        exchangeCurrency: SupportingDocuments.exchangeCurrency ?? null,
        exchangeRate: SupportingDocuments.exchangeRate ?? null,
        prevDeclarationNo: SupportingDocuments.prevDeclarationNo ?? null,
        dutyExem: SupportingDocuments.dutyExem ?? null,
        portOfExit: SupportingDocuments.portOfExit ?? null,
        portOfExitCode: SupportingDocuments.portOfExitCode ?? null,
        typeOfApplication: TemporaryImport.typeOfApplication ?? null,
        grantedPeriod: TemporaryImport.grantedPeriod ?? null,
        estDateOfExport: TemporaryImport.estDateOfExport ?? null,
        placeExport: TemporaryImport.placeExport ?? null,
        projectName: TemporaryImport.projectName ?? null,
        projectDateFrom: TemporaryImport.projectDateFrom ?? null,
        projectDateTo: TemporaryImport.projectDateTo ?? null,
        modeTransport: Transit.modeTransport ?? null,
        meanTransport: Transit.meanTransport ?? null,
        officeDeptFirst: Transit.officeDeptFirst ?? null,
        officeDeptFirstCode: Transit.officeDeptFirstCode ?? null,
        officeDeptLast: Transit.officeDeptLast ?? null,
        officeDeptLastCode: Transit.officeDeptLastCode ?? null,
        officeDeptSecond: Transit.officeDeptSecond ?? null,
        officeDeptSecondCode: Transit.officeDeptSecondCode ?? null,
        officeDeptThird: Transit.officeDeptThird ?? null,
        officeDeptThirdCode: Transit.officeDeptThirdCode ?? null,
        depositType: SecurityDeposit.depositType ?? null,
        depositAmount: n(SecurityDeposit.depositAmount),
        bankGuaranteeAmount: n(SecurityDeposit.bankGuaranteeAmount),
        bankGuaranteeNo: SecurityDeposit.bankGuaranteeNo ?? null,
        bankName: SecurityDeposit.bankName ?? null,
        bankCode: SecurityDeposit.bankCode ?? null,
        totalGrossWeight: n(DeclarationGoods.totalGrossWeight),
        grossWeightUnit: DeclarationGoods.grossWeightUnit ?? null,
        totalPackagesNo: DeclarationGoods.totalPackagesNo != null ? Math.trunc(Number(DeclarationGoods.totalPackagesNo)) : null,
        packageNoUnit: DeclarationGoods.packageNoUnit ?? null,
        totalInvoiceAmount: n(DeclarationGoods.totalInvoiceAmount),
        invoiceCurrency: DeclarationGoods.invoiceCurrency ?? null,
        invoiceRate: n(DeclarationGoods.invoiceRate),
        invoiceInsuranceType: DeclarationGoods.invoiceInsuranceType ?? null,
        insuranceAmount: n(DeclarationGoods.insuranceAmount),
        insuranceCurrency: DeclarationGoods.insuranceCurrency ?? null,
        insuranceRate: n(DeclarationGoods.insuranceRate),
        freightType: DeclarationGoods.freightType ?? null,
        freightCharge: n(DeclarationGoods.freightCharge),
        freightCurrency: DeclarationGoods.freightCurrency ?? null,
        freightRate: n(DeclarationGoods.freightRate),
        otherCharges: n(DeclarationGoods.otherCharges),
        otherChargesType: DeclarationGoods.otherChargesType ?? null,
        remarks: DeclarationGoods.remarks ?? null,
        declarantName: Declarant.declarantName ?? null,
        declarantID: Declarant.declarantID ?? null,
        declarantICNo: Declarant.declarantICNo ?? null,
        declarantICColor: Declarant.declarantICColor ?? null,
        declarantDesignation: Declarant.declarantDesignation ?? null,
    };
}

async function backfillDeclarations() {
    const docs = await Declaration3.find({}).lean();
    console.log(`\nDeclaration3: ${docs.length} documents in Mongo`);
    let upserted = 0;
    for (const d of docs) {
        const mongoId = d._id.toString();
        const data = declarationToPgData(d);
        if (DRY_RUN) { upserted++; continue; }

        const row = await prisma.marsDeclaration.upsert({
            where: { mongoId }, create: { mongoId, ...data }, update: data, select: { id: true },
        });

        await prisma.marsDeclarationInvoice.deleteMany({ where: { declarationId: row.id } });
        const invoices = d.Invoice || [];
        if (invoices.length > 0) {
            await prisma.marsDeclarationInvoice.createMany({
                data: invoices.map((inv) => ({
                    mongoId: inv._id ? inv._id.toString() : null,
                    declarationId: row.id,
                    invoiceNo: inv.invoiceNo ?? null,
                    invoiceDate: inv.invoiceDate ?? null,
                    invoiceTerm: inv.invoiceTerm ?? null,
                    invoiceCCY: inv.invoiceCCY ?? null,
                    invoiceAmount: inv.invoiceAmount ?? null,
                    invoiceFreightCCY: inv.invoiceFreightCCY ?? null,
                    invoiceFreightAmount: inv.invoiceFreightAmount ?? null,
                    invoiceInsuranceCCY: inv.invoiceInsuranceCCY ?? null,
                    invoiceInsuranceAmount: inv.invoiceInsuranceAmount ?? null,
                    invoiceOtherCharges: inv.invoiceOtherCharges ?? null,
                })),
            });
        }

        await prisma.marsDeclarationGoodsLine.deleteMany({ where: { declarationId: row.id } });
        const goods = d.Goods || [];
        if (goods.length > 0) {
            await prisma.marsDeclarationGoodsLine.createMany({
                data: goods.map((g) => ({
                    mongoId: g._id ? g._id.toString() : null,
                    declarationId: row.id,
                    goodsSerialNo: g.goodsSerialNo != null ? Math.trunc(Number(g.goodsSerialNo)) : null,
                    goodsPackageNo: g.goodsPackageNo != null ? Math.trunc(Number(g.goodsPackageNo)) : null,
                    goodsPackageUnit: g.goodsPackageUnit ?? null,
                    countryOrigin: g.countryOrigin ?? null,
                    countryCode: g.countryCode ?? null,
                    hsCode: g.hsCode ?? null,
                    subCode: g.subCode ?? null,
                    goodsDescription: g.goodsDescription ?? null,
                    goodsC: g.goodsC ?? null,
                    goodsUnit: g.goodsUnit ?? null,
                    goodsCode: g.goodsCode ?? null,
                    goodsQuantity: n(g.goodsQuantity),
                    goodsWeight: n(g.goodsWeight),
                    goodsAmount: n(g.goodsAmount),
                    goodsCIF: g.goodsCIF ?? null,
                    goodsDuty: g.goodsDuty ?? null,
                    goodsDutyAmount: n(g.goodsDutyAmount),
                    goodsLNo: g.goodsLNo ?? null,
                    goodsShippingMark: g.goodsShippingMark ?? null,
                    goodsContainerNo: g.goodsContainerNo ?? null,
                    goodsInvoiceNo: g.goodsInvoiceNo ?? null,
                    goodsControl: g.goodsControl ?? null,
                    goodsImportDuty: g.goodsImportDuty ?? null,
                    goodsExciseDuty: g.goodsExciseDuty ?? null,
                    permitApplicationType: g.permitApplicationType ?? null,
                    permitNo: g.permitNo ?? null,
                    permitExpiryDate: g.permitExpiryDate ?? null,
                    permitIssuedBy: g.permitIssuedBy ?? null,
                })),
            });
        }

        await prisma.marsDeclarationContainer.deleteMany({ where: { declarationId: row.id } });
        const containers = d.Containers || [];
        if (containers.length > 0) {
            await prisma.marsDeclarationContainer.createMany({
                data: containers.map((c) => ({
                    mongoId: c._id ? c._id.toString() : null,
                    declarationId: row.id,
                    containerNumber: c.containerNumber ?? null,
                    containerType: c.containerType ?? null,
                    cargoStatus: c.cargoStatus ?? null,
                    sealNumber: c.sealNumber ?? null,
                    containerWeight: n(c.containerWeight),
                    containerWeightUOM: c.containerWeightUOM ?? null,
                })),
            });
        }
        upserted++;
    }
    console.log(`  ${DRY_RUN ? 'wouldUpsert' : 'upserted'}=${upserted}`);
}

// Batched createMany import for large static reference tables. Skips (with
// a warning) if the Postgres table already has rows, rather than
// duplicating - only intended to run once against an empty table.
async function backfillReferenceTable(label, MongoModel, prismaModel, mapDoc) {
    const existingCount = await prismaModel.count();
    if (existingCount > 0) {
        console.log(`\n${label}: SKIPPED - Postgres table already has ${existingCount} rows (this backfill is not idempotent for reference tables)`);
        return;
    }

    const totalCount = await MongoModel.countDocuments({});
    console.log(`\n${label}: ${totalCount} documents in Mongo`);
    if (DRY_RUN) {
        console.log(`  wouldInsert=${totalCount}`);
        return;
    }

    let batch = [];
    let inserted = 0;
    const cursor = MongoModel.find({}).lean().cursor();
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        batch.push(mapDoc(doc));
        if (batch.length >= BATCH_SIZE) {
            await prismaModel.createMany({ data: batch });
            inserted += batch.length;
            console.log(`  inserted=${inserted}/${totalCount}`);
            batch = [];
        }
    }
    if (batch.length > 0) {
        await prismaModel.createMany({ data: batch });
        inserted += batch.length;
    }
    console.log(`  DONE inserted=${inserted}`);
}

async function main() {
    if (DRY_RUN) console.log('DRY RUN - no Postgres writes will be made.');
    await mongoose.connect(process.env.MONGO_URI);

    await backfillUsers();
    await backfillConsignees();
    await backfillDeclarations();

    await backfillReferenceTable('Hscode2', Hscode2, prisma.marsHsCode, (doc) => ({
        mongoId: doc._id.toString(),
        heading: doc.Heading ?? null,
        hsCode: doc.HSCode ?? null,
        description: doc.Description ?? null,
        quantity: doc.Quantity ?? null,
        importDutyRate: doc.ImportDutyRate ?? null,
        exciseDutyRate: doc.ExciseDutyRate ?? null,
        category: doc.category ?? null,
        subCategory: doc.subCategory ?? null,
    }));

    await backfillReferenceTable('Port_Code', Port_Code, prisma.marsPortCode, (doc) => ({
        mongoId: doc._id.toString(),
        country: doc.country ?? null,
        portCode: doc.port_code ?? null,
    }));

    await backfillReferenceTable('ISO_CountryCodes', ISO_CountryCodes, prisma.marsCountryCode, (doc) => ({
        mongoId: doc._id.toString(),
        name: doc.name ?? null,
        alpha2: doc.alpha2 ?? null,
        alpha3: doc.alpha_3 ?? null,
        countryCode: doc.countrycode ?? null,
        iso31662: doc.iso_3166_2 ?? null,
        region: doc.region ?? null,
        subRegion: doc.sub_region ?? null,
        intermediateRegion: doc.intermediate_region ?? null,
        regionCode: doc.region_code ?? null,
        subRegionCode: doc.sub_region_code ?? null,
        intermediateRegionCode: doc.intermediate_region_code != null ? Math.trunc(Number(doc.intermediate_region_code)) : null,
    }));

    await backfillReferenceTable('Unlocode_port_list2', Unlocode_port_list2, prisma.marsUnlocodePort, (doc) => ({
        mongoId: doc._id.toString(),
        country: doc.Country ?? null,
        location: doc.Location ?? null,
        name: doc.Name ?? null,
    }));

    console.log('\nDONE.');
    await prisma.$disconnect();
    await mongoose.disconnect();
}

main().catch((e) => { console.error('FATAL ERROR:', e); process.exit(1); });
