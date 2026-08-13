const express = require("express")
const passport = require("passport");
const initializePassport = require("./passport");
const session = require("express-session");
const flash = require("express-flash");
const override = require("method-override");
const MongoStore = require("connect-mongo");
var builder = require('xmlbuilder');
let fs = require('fs');

initializePassport(passport);
const app = express()


const mongoose = require("mongoose");
require("dotenv").config();

const bcrypt = require("bcryptjs");

//models
const User = require("./models/user");
const Bdnsw = require("./models/bdnswdata"); //accounts
const Declaration3 = require("./models/declaration3");
const Consignee = require("./models/consignee");
const Hscode2 = require("./models/hscode2");
const Port_Code = require("./models/port_code");
const ISO_CountryCodes = require("./models/iso_countrycodes");
//port2 cleaned from unnecessary headers e.g. location, name2, coordinates
const Unlocode_port_list2 = require("./models/unlocode_port_list2");

app.set("view-engine", "ejs")
app.use(express.urlencoded({ extended: false }))

app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] !== "https" && process.env.NODE_ENV === "production") {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("mongoDB is connected"))
  .catch((e) => console.log(e.message));


app.use(flash());
app.use(
  session({
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      //ttl: 365 * 24 * 60 * 60, // = 365 days.
    }),
    secret: process.env.SECRET,
    resave: false, // if nothing is changed dont resave
    saveUninitialized: false, // dont save empty value in session
    //proxy: true,
    cookie: { secure: false }
  })
);
app.use(passport.initialize());
app.use(passport.session());

//using files in public folder
app.use(express.static(__dirname + '/public'));

//set name into session post login
app.use(function(req, res, next) {
  if (req.user){
    res.locals.username = req.user;
  }
  else{
    console.log("Not logged in")
  }
  next(); 
});

function requireLogin(req, res, next) {
      if (req.isAuthenticated()) {
        return next();
      }
      res.redirect("/login");
}   

function requireAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.designation === "Admin") {
    return next();
  }
  req.flash("error", "Only an Admin can do that.");
  res.redirect("back");
}

function requireLogout(req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}  

app.use(override("_method"));




app.get("/", requireLogin, (req, res) => {
  res.render("index.ejs")
})

app.get("/register", (req, res) => {
    res.render("register.ejs")
})

app.post("/register", async (req, res) => {
    const { 
      name, 
      email, 
      password, 
      phone,
      idType,
      icNo,
      icColor,
      designation,
    } = req.body;
    try {
      let user = await User.findOne({ email: req.body.email });
      if (user) {
        return res.status(400).json({ error: "User already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({ 
        name, 
        email, 
        password: hashedPassword, 
        phone,
        idType,
        icNo,
        icColor,
        designation,
       });
      await user.save();
      res.redirect("/login");
    } catch (error) {
      console.log(error);
    }
});

app.get("/login", requireLogout, (req, res) => {
    res.render("login.ejs")
})

app.post("/login",
    passport.authenticate("local", {
      successRedirect: "/",
      failureRedirect: "/login",
      failureFlash: true,
    }),
);

app.get("/bdnsw", requireLogin, async (req, res) => {
  const user = await User.find({});
  const { invoiceNo, importer, vessel, country, agent, dateFrom, dateTo } = req.query;

  const filter = {};
  if (invoiceNo?.trim()) {
    filter["Goods.goodsInvoiceNo"] = { $regex: invoiceNo.trim(), $options: "i" };
  }
  if (importer?.trim()) {
    filter["Importer.importerName"] = { $regex: importer.trim(), $options: "i" };
  }
  if (vessel?.trim()) {
    filter["Transport.vesselName"] = { $regex: vessel.trim(), $options: "i" };
  }
  if (country?.trim()) {
    filter["Transport.countryShipment"] = { $regex: country.trim(), $options: "i" };
  }
  if (agent?.trim()) {
    filter["Agent.agentName"] = { $regex: agent.trim(), $options: "i" };
  }
  if (dateFrom?.trim() || dateTo?.trim()) {
    filter.declarationDate = {};
    if (dateFrom?.trim()) filter.declarationDate.$gte = dateFrom.trim();
    if (dateTo?.trim()) filter.declarationDate.$lte = dateTo.trim();
  }

  const declaration3 = await Declaration3.find(filter).sort({Transport:-1});
  res.render("bdnsw.ejs", {
    user: user,
    declaration3: declaration3,
    filters: { invoiceNo: invoiceNo || "", importer: importer || "", vessel: vessel || "", country: country || "", agent: agent || "", dateFrom: dateFrom || "", dateTo: dateTo || "" }
  })
})

app.get("/bdnswadd", requireLogin, async (req, res) => {
  const declaration3 = await Declaration3.find({});
  const port_code = await Port_Code.find({}).sort({country: 1});
  const consignee = await Consignee.find({}).sort({name: 1});
  const iso_countrycodes = await ISO_CountryCodes.find({}).sort({name: 1});
  res.render("bdnswadd.ejs", {declaration3: declaration3, port_code: port_code, consignee: consignee, iso_countrycodes: iso_countrycodes})
})


app.get("/bdnswedit/(:id)", requireLogin, async (req, res) => {
  const user = await User.find({});
  const declaration3 = await Declaration3.findOne({_id : req.params.id});
  const port_code = await Port_Code.find({}).sort({country: 1});
  const consignee = await Consignee.find({}).sort({name: 1});
  const iso_countrycodes = await ISO_CountryCodes.find({}).sort({name: 1});
  res.render("bdnswedit.ejs", {user: user, declaration3: declaration3, port_code: port_code, consignee: consignee, iso_countrycodes: iso_countrycodes});
});

//edit profile
app.get("/profile", requireLogin, async (req, res) => {
  const user = await User.find({});
  const bdnsw = await Bdnsw.find({});
  res.render("profile.ejs", {user: user, bdnsw: bdnsw})
})

app.post("/profileupdate", requireLogin, async (req, res) => {
  const { name, phone, idType, icNo, icColor, designation, currentPassword, newPassword, confirmNewPassword } = req.body;

  if (!name?.trim() || !idType?.trim() || !icNo?.trim() || !icColor?.trim() || !designation?.trim()) {
    req.flash("error", "Name, ID Type, IC Number, IC Color and Designation are required.");
    return res.redirect("/profile");
  }

  if (designation.trim() === "Admin" && req.user.designation !== "Admin") {
    req.flash("error", "You cannot set your own designation to Admin.");
    return res.redirect("/profile");
  }

  const update = { name, idType, icNo, icColor, phone, designation };

  if (currentPassword || newPassword || confirmNewPassword) {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      req.flash("error", "To change your password, fill in current password, new password and confirmation.");
      return res.redirect("/profile");
    }
    if (newPassword !== confirmNewPassword) {
      req.flash("error", "New password and confirmation do not match.");
      return res.redirect("/profile");
    }
    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      req.flash("error", "Current password is incorrect.");
      return res.redirect("/profile");
    }
    update.password = await bcrypt.hash(newPassword, 10);
  }

  await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true });
  res.redirect("/profile");
});

//declaration3 POST

//bdnswadd's post
app.post("/declaration3", requireLogin, async (req, res) => {

  const { 
    dateGranted,
    departureDate,
    cept,

    //Procedure
    customsProcedure,
    customsProcedureCode,
    prevProcedure,
    prevProcedureCode,
    dutiableIndicator,
    dutiableIndicatorCode,
    clearanceStation,
    clearanceStationCode,

    //Exporter
    exporterName,
    exporterAddress,
    exporterRegistration,
    exporterCountry,
    exporterPhone,
    exporterPostal,
    exporterTransport,
    
    //Importer
    importerType,
    regTraderCoyRegNo,
    importerName,
    importerAddress,
    importerRegistration,
    importerICColor,
    importerPhone,
    importerPostal,

    //Agent
    agentName,
    agentAddress,
    agentRegistration,
    agentPhone,
    agentPostal,

    //Transport
    arrivalDate,
    containerNo,
    vesselNo,
    vesselName,
    bldoawb,
    hbhawb,
    countryShipment,
    countryShipmentCode,
    countryDestination,
    countryDestinationCode,
    portOfEntry,
    portOfEntryCode,
    portOfDischarge,
    portOfDischargeCode,
    placeRelease,
    placeReleaseCode,
    placeReceipt,
    placeReceiptCode,

    //SupportingDocuments
    exchangeCurrency,
    exchangeRate,
    prevDeclarationNo,
    dutyExem,
    portOfExit,
    portOfExitCode,

    //TemporaryImport
    typeOfApplication,
    grantedPeriod,
    estDateOfExport,
    placeExport,
    projectName,
    projectDateFrom,
    projectDateTo,
  
    //Transit
    modeTransport,
    meanTransport,
    officeDeptFirst,
    officeDeptFirstCode,
    officeDeptLast,
    officeDeptLastCode,
    officeDeptSecond,
    officeDeptSecondCode,
    officeDeptThird,
    officeDeptThirdCode,

    //SecurityDeposit
    depositType,
    depositAmount,
    bankGuaranteeAmount,
    bankGuaranteeNo,
    bankName,
    bankCode,

    //DeclarationGoods
    totalGrossWeight,
    grossWeightUnit,
    totalPackagesNo,
    packageNoUnit,
    totalInvoiceAmount,
    invoiceCurrency,
    invoiceRate,
    invoiceInsuranceType,
    insuranceAmount,
    insuranceCurrency,
    insuranceRate,
    freightType,
    freightCharge,
    freightCurrency,
    freightRate,
    otherCharges,
    otherChargesType,
    remarks,

    //Declarant
    declarantName,
    declarantID,
    declarantICNo,
    declarantICColor,
    declarantDesignation,

    //Other
    declarationDate,
    shippingMark,
    postedBy,
    
    //Invoice
    invoiceNo,
    invoiceDate,
    invoiceTerm,
    invoiceCCY,
    invoiceAmount,
    invoiceFreightCCY,
    invoiceFreightAmount,
    invoiceInsuranceCCY,
    invoiceInsuranceAmount,
    invoiceOtherCharges,

    //Goods
    goodsSerialNo,
    goodsPackageNo,
    goodsPackageUnit,
    countryOrigin,
    countryCode,
    hsCode,
    subCode,
    goodsDescription,
    goodsC,
    goodsUnit,
    goodsCode,
    goodsQuantity,
    goodsWeight,
    goodsAmount,
    goodsCIF,
    goodsDuty,
    goodsDutyAmount,
    goodsLNo,
    goodsShippingMark,
    goodsContainerNo,
    goodsInvoiceNo,
    goodsControl,
    goodsImportDuty,
    goodsExciseDuty,
    

  } = req.body;
  
  var declarationInvoice = [];
  if(typeof(invoiceNo)=="string"){
    declarationInvoice.push({
      invoiceNo: invoiceNo,
      invoiceDate : invoiceDate,
      invoiceTerm : invoiceTerm,
      invoiceCCY : invoiceCCY,
      invoiceAmount : invoiceAmount,
      invoiceFreightCCY : invoiceFreightCCY,
      invoiceFreightAmount : invoiceFreightAmount,
      invoiceInsuranceCCY : invoiceInsuranceCCY,
      invoiceInsuranceAmount : invoiceInsuranceAmount,
      invoiceOtherCharges : invoiceOtherCharges,

    });
  } else {
    for (var i = 0; i < invoiceNo.length; i++){
      if(invoiceNo[i]) {
        declarationInvoice.push({
          invoiceNo: invoiceNo[i],
          invoiceDate : invoiceDate[i],
          invoiceTerm : invoiceTerm[i],
          invoiceCCY : invoiceCCY[i],
          invoiceAmount : invoiceAmount[i],
          invoiceFreightCCY : invoiceFreightCCY[i],
          invoiceFreightAmount : invoiceFreightAmount[i],
          invoiceInsuranceCCY : invoiceInsuranceCCY[i],
          invoiceInsuranceAmount : invoiceInsuranceAmount[i],
          invoiceOtherCharges : invoiceOtherCharges[i],
    
        });
      }
      
    }
  }
  
  
  

  var declarationGoods = [];
  if(typeof(goodsSerialNo)=="string"){
    declarationGoods.push({
      goodsSerialNo: goodsSerialNo[i],
      goodsPackageNo: goodsPackageNo[i],
      goodsPackageUnit: goodsPackageUnit[i],
      countryOrigin: countryOrigin[i],
      countryCode: countryCode[i],
      hsCode: hsCode[i],
      subCode: subCode[i],
      goodsDescription: goodsDescription[i],
      goodsC: goodsC[i],
      goodsUnit: goodsUnit[i],
      goodsCode: goodsCode[i],
      goodsQuantity: goodsQuantity[i],
      goodsWeight: goodsWeight[i],
      goodsAmount: goodsAmount[i],
      goodsCIF: goodsCIF[i],
      goodsDuty: goodsDuty[i],
      goodsDutyAmount: goodsDutyAmount[i],
      goodsLNo: goodsLNo[i],
      goodsShippingMark: goodsShippingMark[i],
      goodsContainerNo: goodsContainerNo[i],
      goodsInvoiceNo: goodsInvoiceNo[i],
      goodsControl: goodsControl[i],
      goodsImportDuty: goodsImportDuty[i],
      goodsExciseDuty: goodsExciseDuty[i],

    });
  } else {
    for (var i = 0; i < goodsSerialNo.length; i++){
      if(goodsSerialNo[i]) {
        declarationGoods.push({
          goodsSerialNo: goodsSerialNo[i],
          goodsPackageNo: goodsPackageNo[i],
          goodsPackageUnit: goodsPackageUnit[i],
          countryOrigin: countryOrigin[i],
          countryCode: countryCode[i],
          hsCode: hsCode[i],
          subCode: subCode[i],
          goodsDescription: goodsDescription[i],
          goodsC: goodsC[i],
          goodsUnit: goodsUnit[i],
          goodsCode: goodsCode[i],
          goodsQuantity: goodsQuantity[i],
          goodsWeight: goodsWeight[i],
          goodsAmount: goodsAmount[i],
          goodsCIF: goodsCIF[i],
          goodsDuty: goodsDuty[i],
          goodsDutyAmount: goodsDutyAmount[i],
          goodsLNo: goodsLNo[i],
          goodsShippingMark: goodsShippingMark[i],
          goodsContainerNo: goodsContainerNo[i],
          goodsInvoiceNo: goodsInvoiceNo[i],
          goodsControl: goodsControl[i],
          goodsImportDuty: goodsImportDuty[i],
          goodsExciseDuty: goodsExciseDuty[i],
    
        });
      }
      
    }
  }

  const declaration3 = new Declaration3 ({ 
    dateGranted,
    departureDate,
    cept,

    Procedure: {
      customsProcedure,
      customsProcedureCode,
      prevProcedure,
      prevProcedureCode,
      dutiableIndicator,
      dutiableIndicatorCode,
      clearanceStation,
      clearanceStationCode,
    },

    Exporter: {
      exporterName,
      exporterAddress,
      exporterRegistration,
      exporterCountry,
      exporterPhone,
      exporterPostal,
      exporterTransport,
    },

    Importer: {
      importerType,
      regTraderCoyRegNo,
      importerName,
      importerAddress,
      importerRegistration,
      importerICColor,
      importerPhone,
      importerPostal,
    },

    Agent: {
      agentName,
      agentAddress,
      agentRegistration,
      agentPhone,
      agentPostal,
    },


    Transport: {
      arrivalDate,
      containerNo,
      vesselNo,
      vesselName,
      bldoawb,
      hbhawb,
      countryShipment,
      countryShipmentCode,
      countryDestination,
      countryDestinationCode,
      portOfEntry,
      portOfEntryCode,
      portOfDischarge,
      portOfDischargeCode,
      placeRelease,
      placeReleaseCode,
      placeReceipt,
      placeReceiptCode,
    },

    SupportingDocuments: {
      exchangeCurrency,
      exchangeRate,
      prevDeclarationNo,
      dutyExem,
      portOfExit,
      portOfExitCode,
    },

    TemporaryImport: {
      typeOfApplication,
      grantedPeriod,
      estDateOfExport,
      placeExport,
      projectName,
      projectDateFrom,
      projectDateTo,
    },
  
    Transit: {
      modeTransport,
      meanTransport,
      officeDeptFirst,
      officeDeptFirstCode,
      officeDeptLast,
      officeDeptLastCode,
      officeDeptSecond,
      officeDeptSecondCode,
      officeDeptThird,
      officeDeptThirdCode,
    },

    SecurityDeposit: {
      depositType,
      depositAmount,
      bankGuaranteeAmount,
      bankGuaranteeNo,
      bankName,
      bankCode,
    },

    DeclarationGoods: {
      totalGrossWeight,
      grossWeightUnit,
      totalPackagesNo,
      packageNoUnit,
      totalInvoiceAmount,
      invoiceCurrency,
      invoiceRate,
      invoiceInsuranceType,
      insuranceAmount,
      insuranceCurrency,
      insuranceRate,
      freightType,
      freightCharge,
      freightCurrency,
      freightRate,
      otherCharges,
      otherChargesType,
      remarks,
    },

    Declarant: {
      declarantName,
      declarantID,
      declarantICNo,
      declarantICColor,
      declarantDesignation,
    },

    declarationDate,
    shippingMark,
    postedBy,

    Invoice: declarationInvoice,
    Goods: declarationGoods,
    
    
  });

  const checkConsignee = await Consignee.findOne({ 'name' : importerName })
  if (checkConsignee) {
    await Consignee.updateMany ({ name: importerName},
      {$set: {

        name: importerName,
        address: importerAddress,
        reg: regTraderCoyRegNo,
        ic: importerRegistration,
        icColor: importerICColor,
        telephone: importerPhone,
        postal: importerPostal,

      }
      },
      {
        new: true,
      }
    )
  }
  else {
    const consignee = new Consignee ({

      name: importerName,
      address: importerAddress,
      reg: regTraderCoyRegNo,
      ic: importerRegistration,
      icColor: importerICColor,
      telephone: importerPhone,
      postal: importerPostal,

    });
    await consignee.save();
  }

  if (exporterName?.trim()) {
    await Consignee.updateOne(
      { name: exporterName },
      { $setOnInsert: { name: exporterName },
        $set: { address: exporterAddress, reg: exporterRegistration, country: exporterCountry, telephone: exporterPhone, postal: exporterPostal } },
      { upsert: true }
    );
  }

  if (agentName?.trim()) {
    await Consignee.updateOne(
      { name: agentName },
      { $setOnInsert: { name: agentName },
        $set: { address: agentAddress, reg: agentRegistration, telephone: agentPhone, postal: agentPostal } },
      { upsert: true }
    );
  }


  
  await declaration3.save();
  
  

  res.redirect("/bdnsw");
  
});

//bdnswedit
app.post("/recordsEdit", requireLogin, async (req, res) => {

  const { 
    dateGranted,
    departureDate,
    cept,

    //Procedure
    customsProcedure,
    customsProcedureCode,
    prevProcedure,
    prevProcedureCode,
    dutiableIndicator,
    dutiableIndicatorCode,
    clearanceStation,
    clearanceStationCode,

    //Exporter
    exporterName,
    exporterAddress,
    exporterRegistration,
    exporterCountry,
    exporterPhone,
    exporterPostal,
    exporterTransport,
    
    //Importer
    importerType,
    regTraderCoyRegNo,
    importerName,
    importerAddress,
    importerRegistration,
    importerICColor,
    importerPhone,
    importerPostal,

    //Agent
    agentName,
    agentAddress,
    agentRegistration,
    agentPhone,
    agentPostal,

    //Transport
    arrivalDate,
    containerNo,
    vesselNo,
    vesselName,
    bldoawb,
    hbhawb,
    countryShipment,
    countryShipmentCode,
    countryDestination,
    countryDestinationCode,
    portOfEntry,
    portOfEntryCode,
    portOfDischarge,
    portOfDischargeCode,
    placeRelease,
    placeReleaseCode,
    placeReceipt,
    placeReceiptCode,

    //SupportingDocuments
    exchangeCurrency,
    exchangeRate,
    prevDeclarationNo,
    dutyExem,
    portOfExit,
    portOfExitCode,

    //TemporaryImport
    typeOfApplication,
    grantedPeriod,
    estDateOfExport,
    placeExport,
    projectName,
    projectDateFrom,
    projectDateTo,
  
    //Transit
    modeTransport,
    meanTransport,
    officeDeptFirst,
    officeDeptFirstCode,
    officeDeptLast,
    officeDeptLastCode,
    officeDeptSecond,
    officeDeptSecondCode,
    officeDeptThird,
    officeDeptThirdCode,

    //SecurityDeposit
    depositType,
    depositAmount,
    bankGuaranteeAmount,
    bankGuaranteeNo,
    bankName,
    bankCode,

    //DeclarationGoods
    totalGrossWeight,
    grossWeightUnit,
    totalPackagesNo,
    packageNoUnit,
    totalInvoiceAmount,
    invoiceCurrency,
    invoiceRate,
    invoiceInsuranceType,
    insuranceAmount,
    insuranceCurrency,
    insuranceRate,
    freightType,
    freightCharge,
    freightCurrency,
    freightRate,
    otherCharges,
    otherChargesType,
    remarks,

    //Declarant
    declarantName,
    declarantID,
    declarantICNo,
    declarantICColor,
    declarantDesignation,

    //Other
    declarationDate,
    shippingMark,
    postedBy,
    
    //Invoice
    invoiceNo,
    invoiceDate,
    invoiceTerm,
    invoiceCCY,
    invoiceAmount,
    invoiceFreightCCY,
    invoiceFreightAmount,
    invoiceInsuranceCCY,
    invoiceInsuranceAmount,
    invoiceOtherCharges,

    //Goods
    goodsSerialNo,
    goodsPackageNo,
    goodsPackageUnit,
    countryOrigin,
    countryCode,
    hsCode,
    subCode,
    goodsDescription,
    goodsC,
    goodsUnit,
    goodsCode,
    goodsQuantity,
    goodsWeight,
    goodsAmount,
    goodsCIF,
    goodsDuty,
    goodsDutyAmount,
    goodsLNo,
    goodsShippingMark,
    goodsContainerNo,
    goodsInvoiceNo,
    goodsControl,
    goodsImportDuty,
    goodsExciseDuty,
    

  } = req.body;
  
  var declarationInvoice = [];
  if(typeof(invoiceNo)=="string"){
    declarationInvoice.push({
      invoiceNo: invoiceNo,
      invoiceDate : invoiceDate,
      invoiceTerm : invoiceTerm,
      invoiceCCY : invoiceCCY,
      invoiceAmount : invoiceAmount,
      invoiceFreightCCY : invoiceFreightCCY,
      invoiceFreightAmount : invoiceFreightAmount,
      invoiceInsuranceCCY : invoiceInsuranceCCY,
      invoiceInsuranceAmount : invoiceInsuranceAmount,
      invoiceOtherCharges : invoiceOtherCharges,

    });
  } else {
    for (var i = 0; i < invoiceNo.length; i++){
      if(invoiceNo[i]) {
        declarationInvoice.push({
          invoiceNo: invoiceNo[i],
          invoiceDate : invoiceDate[i],
          invoiceTerm : invoiceTerm[i],
          invoiceCCY : invoiceCCY[i],
          invoiceAmount : invoiceAmount[i],
          invoiceFreightCCY : invoiceFreightCCY[i],
          invoiceFreightAmount : invoiceFreightAmount[i],
          invoiceInsuranceCCY : invoiceInsuranceCCY[i],
          invoiceInsuranceAmount : invoiceInsuranceAmount[i],
          invoiceOtherCharges : invoiceOtherCharges[i],
    
        });
      }
      
    }
  }
  
  
  

  var declarationGoods = [];
  if(typeof(goodsSerialNo)=="string"){
    declarationGoods.push({
      goodsSerialNo: goodsSerialNo[i],
      goodsPackageNo: goodsPackageNo[i],
      goodsPackageUnit: goodsPackageUnit[i],
      countryOrigin: countryOrigin[i],
      countryCode: countryCode[i],
      hsCode: hsCode[i],
      subCode: subCode[i],
      goodsDescription: goodsDescription[i],
      goodsC: goodsC[i],
      goodsUnit: goodsUnit[i],
      goodsCode: goodsCode[i],
      goodsQuantity: goodsQuantity[i],
      goodsWeight: goodsWeight[i],
      goodsAmount: goodsAmount[i],
      goodsCIF: goodsCIF[i],
      goodsDuty: goodsDuty[i],
      goodsDutyAmount: goodsDutyAmount[i],
      goodsLNo: goodsLNo[i],
      goodsShippingMark: goodsShippingMark[i],
      goodsContainerNo: goodsContainerNo[i],
      goodsInvoiceNo: goodsInvoiceNo[i],
      goodsControl: goodsControl[i],
      goodsImportDuty: goodsImportDuty[i],
      goodsExciseDuty: goodsExciseDuty[i],

    });
  } else {
    for (var i = 0; i < goodsSerialNo.length; i++){
      if(goodsSerialNo[i]) {
        declarationGoods.push({
          goodsSerialNo: goodsSerialNo[i],
          goodsPackageNo: goodsPackageNo[i],
          goodsPackageUnit: goodsPackageUnit[i],
          countryOrigin: countryOrigin[i],
          countryCode: countryCode[i],
          hsCode: hsCode[i],
          subCode: subCode[i],
          goodsDescription: goodsDescription[i],
          goodsC: goodsC[i],
          goodsUnit: goodsUnit[i],
          goodsCode: goodsCode[i],
          goodsQuantity: goodsQuantity[i],
          goodsWeight: goodsWeight[i],
          goodsAmount: goodsAmount[i],
          goodsCIF: goodsCIF[i],
          goodsDuty: goodsDuty[i],
          goodsDutyAmount: goodsDutyAmount[i],
          goodsLNo: goodsLNo[i],
          goodsShippingMark: goodsShippingMark[i],
          goodsContainerNo: goodsContainerNo[i],
          goodsInvoiceNo: goodsInvoiceNo[i],
          goodsControl: goodsControl[i],
          goodsImportDuty: goodsImportDuty[i],
          goodsExciseDuty: goodsExciseDuty[i],
    
        });
      }
      
    }
  }
  

  await Declaration3.updateMany ({ _id:req.body._id},
    {$set: {
      dateGranted : dateGranted,
      departureDate : departureDate,
      cept : cept,

      Procedure: {
        customsProcedure : customsProcedure,
        customsProcedureCode : customsProcedureCode,
        prevProcedure : prevProcedure,
        prevProcedureCode,
        dutiableIndicator,
        dutiableIndicatorCode,
        clearanceStation,
        clearanceStationCode,
      },

      Exporter: {
        exporterName,
        exporterAddress,
        exporterRegistration,
        exporterCountry,
        exporterPhone,
        exporterPostal,
        exporterTransport,
      },
  
      Importer: {
        importerType : importerType,
        importerName : importerName,
        importerAddress : importerAddress,
        regTraderCoyRegNo : regTraderCoyRegNo,
        importerRegistration : importerRegistration,
        importerICColor : importerICColor,
        importerPhone : importerPhone,
        importerPostal : importerPostal,
      },
  
      Agent: {
        agentName,
        agentAddress,
        agentRegistration,
        agentPhone,
        agentPostal,
      },
  
  
      Transport: {
        arrivalDate,
        containerNo,
        vesselNo,
        vesselName,
        bldoawb,
        hbhawb,
        countryShipment,
        countryShipmentCode,
        countryDestination,
        countryDestinationCode,
        portOfEntry,
        portOfEntryCode,
        portOfDischarge,
        portOfDischargeCode,
        placeRelease,
        placeReleaseCode,
        placeReceipt,
        placeReceiptCode,
      },
  
      SupportingDocuments: {
        exchangeCurrency,
        exchangeRate,
        prevDeclarationNo,
        dutyExem,
        portOfExit,
        portOfExitCode,
      },
  
      TemporaryImport: {
        typeOfApplication,
        grantedPeriod,
        estDateOfExport,
        placeExport,
        projectName,
        projectDateFrom,
        projectDateTo,
      },
    
      Transit: {
        modeTransport,
        meanTransport,
        officeDeptFirst,
        officeDeptFirstCode,
        officeDeptLast,
        officeDeptLastCode,
        officeDeptSecond,
        officeDeptSecondCode,
        officeDeptThird,
        officeDeptThirdCode,
      },
  
      SecurityDeposit: {
        depositType,
        depositAmount,
        bankGuaranteeAmount,
        bankGuaranteeNo,
        bankName,
        bankCode,
      },
  
      DeclarationGoods: {
        totalGrossWeight,
        grossWeightUnit,
        totalPackagesNo,
        packageNoUnit,
        totalInvoiceAmount,
        invoiceCurrency,
        invoiceRate,
        invoiceInsuranceType,
        insuranceAmount,
        insuranceCurrency,
        insuranceRate,
        freightType,
        freightCharge,
        freightCurrency,
        freightRate,
        otherCharges,
        otherChargesType,
        remarks,
      },
  
      Declarant: {
        declarantName,
        declarantID,
        declarantICNo,
        declarantICColor,
        declarantDesignation,
      },
  
      declarationDate,
      shippingMark,
      postedBy,
  
      Invoice: declarationInvoice,
      Goods: declarationGoods,

    }
    },
    {
      new: true,
    }
    
  )

  const checkConsignee = await Consignee.findOne({ 'name' : importerName })
  if (checkConsignee) {
    await Consignee.updateMany ({ name: importerName},
      {$set: {

        name: importerName,
        address: importerAddress,
        reg: regTraderCoyRegNo,
        ic: importerRegistration,
        icColor: importerICColor,
        telephone: importerPhone,
        postal: importerPostal,

      }
      },
      {
        new: true,
      }
    )
  }
  else {
    const consignee = new Consignee ({
      name: importerName,
      address: importerAddress,
      reg: regTraderCoyRegNo,
      ic: importerRegistration,
      icColor: importerICColor,
      telephone: importerPhone,
      postal: importerPostal,

    });
    await consignee.save();
  }

  if (exporterName?.trim()) {
    await Consignee.updateOne(
      { name: exporterName },
      { $setOnInsert: { name: exporterName },
        $set: { address: exporterAddress, reg: exporterRegistration, country: exporterCountry, telephone: exporterPhone, postal: exporterPostal } },
      { upsert: true }
    );
  }

  if (agentName?.trim()) {
    await Consignee.updateOne(
      { name: agentName },
      { $setOnInsert: { name: agentName },
        $set: { address: agentAddress, reg: agentRegistration, telephone: agentPhone, postal: agentPostal } },
      { upsert: true }
    );
  }

  res.redirect("/bdnsw");
});

app.get("/downloadXML/:id/:invoice", requireLogin, async (req, res) => {
  const selectedInvoice = req.params.invoice;

  const declaration3 = await Declaration3.findOne({'_id' : req.params.id}, { _id: 0, __v: 0});
  // check country codes (e.g. Singapore. check with db, convert to "SG". Regex i for case insensitive as usually input as caps)
  const iso_countrycodes = await ISO_CountryCodes.findOne({'name' : { $regex : new RegExp(declaration3.Transport.countryShipment, "i") } } );
  const iso_countrycodes2 = await ISO_CountryCodes.findOne({'name' : { $regex : new RegExp(declaration3.Transport.countryDestination, "i") } } );

  const Goods = await Declaration3.find({'goodsInvoiceNo' : req.params.invoice}, { _id: 0, __v: 0});

  //incase of multiple invoices in one data, get more for XML
  var tempInvoice = [];
  var tempInvoiceAmount = [];
  tempInvoice[0] = declaration3.Goods[0].goodsInvoiceNo;
  tempInvoiceAmount[0] = Number(declaration3.Goods[0].goodsAmount);
  for(var k = 1; k < declaration3.Goods.length; k++){
    if(declaration3.Goods[k].goodsInvoiceNo === declaration3.Goods[k-1].goodsInvoiceNo){
      var a = tempInvoice.length;
      tempInvoiceAmount[a - 1] = tempInvoiceAmount[a - 1] + Number(declaration3.Goods[k].goodsAmount);
    } else {
      var a = tempInvoice.length;
      tempInvoice[a] = declaration3.Goods[k].goodsInvoiceNo;
      tempInvoiceAmount[a] = Number(declaration3.Goods[k].goodsAmount);
    }
  }

  //format XML
  //get goods's amount for remarks. goods.
  var totalAmount = 0;
  goodsEntry= '';
  for (var i = 0; i < declaration3.Goods.length; i++) {
    totalAmount = totalAmount + declaration3.Goods[i].goodsAmount;
    goodsEntry = goodsEntry + ".ele('goodsSerialNo').txt(declaration3.Goods[" +i+ "].goodsSerialNo).up() "
  }

  //dutiable indicator auto set to N
  //IF TRDR
  if(declaration3.Importer.regTraderCoyRegNo){
    var root = builder.create('Declaration', { encoding: 'utf-8' })
  
  
      .ele('General')
        .com(' Header Details ')
        .ele('declarationType').txt(declaration3.Procedure.customsProcedure).up()
        .ele('customsProcedure').txt(declaration3.Procedure.customsProcedureCode).up()
        .ele('dutiableIndicator').txt('N').up()
        .ele('transportMode').txt(declaration3.Procedure.dutiableIndicatorCode).up()
        .ele('countryShipment').txt(iso_countrycodes.alpha2).up()
        .ele('countryDestination').txt(iso_countrycodes2.alpha2).up()
        .ele('portDischarge').txt(declaration3.Transport.portOfDischargeCode).up()
        .ele('portEntry').txt(declaration3.Transport.portOfEntryCode).up()
        .ele('clearanceStationCode').txt(declaration3.Procedure.clearanceStationCode).up()
        .ele('remarks').txt(declaration3.DeclarationGoods.remarks).up()
        
        .com(' Party Details ')
        .ele('traderType').txt(declaration3.Importer.importerType).up()
        .ele('regTraderCoyRegNo').txt(declaration3.Importer.regTraderCoyRegNo).up()
        
        .ele('individualTraderICNo').txt(declaration3.Importer.importerRegistration).up()
        .ele('individualTraderIDType').txt('IC').up()
        .ele('individualTraderICColour').txt(declaration3.Importer.importerICColor).up()
        .ele('individualAddress').txt(declaration3.Importer.importerAddress).up()
        .ele('traderName').txt(declaration3.Importer.importerName).up()
        .ele('consigneeCompanyRegNo').txt(declaration3.Importer.regTraderCoyRegNo).up()
        .ele('consigneeName').txt(declaration3.Importer.importerName).up()
        .ele('dutyExemptIndicator').txt('N').up()
        .ele('ceptSchemeIndicator').txt('N').up()
        
        .com(' BillOfLadingDetails ')
        .ele('masterBillNo').txt(declaration3.Transport.bldoawb).up()
        .ele('vesselFlightVehicleNo').txt(declaration3.Transport.vesselNo).up()
        .ele('vesselName').txt(declaration3.Transport.vesselName).up()
        .ele('vesselFlightArrivalDate').txt(declaration3.Transport.arrivalDate).up()
        .ele('totalGrossWeight').txt(declaration3.DeclarationGoods.totalGrossWeight).up()
        .ele('totalGrossWeightUnit').txt(declaration3.DeclarationGoods.grossWeightUnit).up()
        .ele('totalNoPackages').txt(declaration3.DeclarationGoods.totalPackagesNo).up()
        .ele('totalNoPackagesUnit').txt(declaration3.DeclarationGoods.packageNoUnit).up()
        
        .com(' TransitDetails ')
        
        .com(' Guarantee Details ')
        .ele('bgAmount').txt(declaration3.SecurityDeposit.bankGuaranteeAmount).up()

      .up()    
      for(var j = 0; j < tempInvoice.length; j++){
        root.ele('invoices')
          .ele('invoiceNumber').txt(tempInvoice[j]).up()
          .ele('invoiceDate').txt(declaration3.dateGranted).up()
          .ele('termType').txt(declaration3.DeclarationGoods.otherChargesType).up()
          .ele('invoiceAmount').txt(tempInvoiceAmount[j].toFixed(2)).up()
          .ele('invoiceCurrency').txt(declaration3.DeclarationGoods.invoiceCurrency).up()
          .ele('freightAmount').txt(declaration3.DeclarationGoods.freightCharge).up()
          .ele('freightCurrency').txt(declaration3.DeclarationGoods.freightCurrency).up()
          .ele('insuranceAmount').txt(declaration3.DeclarationGoods.insuranceAmount).up()
          .ele('insuranceCurrency').txt(declaration3.DeclarationGoods.insuranceCurrency).up()
          .ele('otherAmount').txt(declaration3.DeclarationGoods.otherCharges).up()
          .ele('otherAmountCurrency').txt('BND').up()
        .up()
        
        
      }
  }
  // IF INDV
  else {
    var root = builder.create('Declaration', { encoding: 'utf-8' })
  
  
      .ele('General')
        .com(' Header Details ')
        .ele('declarationType').txt(declaration3.Procedure.customsProcedure).up()
        .ele('customsProcedure').txt(declaration3.Procedure.customsProcedureCode).up()
        .ele('dutiableIndicator').txt(declaration3.Procedure.dutiableIndicator).up()
        .ele('transportMode').txt(declaration3.Procedure.dutiableIndicatorCode).up()
        .ele('countryShipment').txt(iso_countrycodes.alpha2).up()
        .ele('countryDestination').txt(iso_countrycodes2.alpha2).up()
        .ele('portDischarge').txt(declaration3.Transport.portOfDischargeCode).up()
        .ele('portEntry').txt(declaration3.Transport.portOfEntryCode).up()
        .ele('clearanceStationCode').txt(declaration3.Procedure.clearanceStationCode).up()
        .ele('remarks').txt(declaration3.DeclarationGoods.remarks).up()
        
        .com(' Party Details ')
        .ele('traderType').txt(declaration3.Importer.importerType).up()
        .ele('individualTraderICNo').txt(declaration3.Importer.importerRegistration).up()
        .ele('individualTraderIDType').txt('IC').up()
        .ele('individualTraderICColour').txt(declaration3.Importer.importerICColor).up()
        .ele('individualAddress').txt(declaration3.Importer.importerAddress).up()
        .ele('traderName').txt(declaration3.Importer.importerName).up()
        .ele('consigneeCompanyRegNo').txt(declaration3.Importer.importerRegistration).up()
        .ele('consigneeName').txt(declaration3.Importer.importerName).up()
        .ele('dutyExemptIndicator').txt('N').up()
        .ele('ceptSchemeIndicator').txt('N').up()
        
        .com(' BillOfLadingDetails ')
        .ele('masterBillNo').txt(declaration3.Transport.bldoawb).up()
        .ele('vesselFlightVehicleNo').txt(declaration3.Transport.vesselNo).up()
        .ele('vesselName').txt(declaration3.Transport.vesselName).up()
        .ele('vesselFlightArrivalDate').txt(declaration3.Transport.arrivalDate).up()
        .ele('totalGrossWeight').txt(declaration3.DeclarationGoods.totalGrossWeight).up()
        .ele('totalGrossWeightUnit').txt(declaration3.DeclarationGoods.grossWeightUnit).up()
        .ele('totalNoPackages').txt(declaration3.DeclarationGoods.totalPackagesNo).up()
        .ele('totalNoPackagesUnit').txt(declaration3.DeclarationGoods.packageNoUnit).up()
        
        .com(' TransitDetails ')
        
        .com(' Guarantee Details ')
        .ele('bgAmount').txt(declaration3.SecurityDeposit.bankGuaranteeAmount.toFixed(2)).up()

      .up()    
      for(var j = 0; j < tempInvoice.length; j++){
        console.log("J is = " + j)
        root.ele('invoices')
          .ele('invoiceNumber').txt(tempInvoice[j]).up()
          .ele('invoiceDate').txt(declaration3.dateGranted).up()
          .ele('termType').txt(declaration3.DeclarationGoods.otherChargesType).up()
          .ele('invoiceAmount').txt(tempInvoiceAmount[j].toFixed(2)).up()
          .ele('invoiceCurrency').txt(declaration3.DeclarationGoods.invoiceCurrency).up()
          .ele('freightAmount').txt(declaration3.DeclarationGoods.freightCharge).up()
          .ele('freightCurrency').txt(declaration3.DeclarationGoods.freightCurrency).up()
          .ele('insuranceAmount').txt(declaration3.DeclarationGoods.insuranceAmount).up()
          .ele('insuranceCurrency').txt(declaration3.DeclarationGoods.insuranceCurrency).up()
          .ele('otherAmount').txt(declaration3.DeclarationGoods.otherCharges).up()
          .ele('otherAmountCurrency').txt('BND').up()
        .up()
        
        
      }
  }
  
      for(var i = 0; i < declaration3.Goods.length; i++){
        if(typeof declaration3.Goods[i].goodsSerialNo !== 'undefined') {
          root.ele('Goods')
              .ele('goodsSerialNo').txt(declaration3.Goods[i].goodsSerialNo).up()
              .ele('goodsDescription').txt(declaration3.Goods[i].goodsDescription).up()
              .ele('goodsHSCode').txt(declaration3.Goods[i].hsCode).up()
              .ele('shippingMarks').txt(declaration3.Goods[i].goodsShippingMark).up()
              .ele('countryOrigin').txt(declaration3.Goods[i].countryOrigin).up()
              .ele('quantity').txt(declaration3.Goods[i].goodsQuantity).up()
              .ele('quantityUOM').txt(declaration3.Goods[i].goodsUnit).up()
              .ele('noPackages').txt(declaration3.Goods[i].goodsPackageNo).up()
              .ele('noPackagesUnit').txt(declaration3.Goods[i].goodsPackageUnit).up()
              .ele('invoiceNo').txt(declaration3.Goods[i].goodsInvoiceNo).up()
              .ele('invoiceAmount').txt(declaration3.Goods[i].goodsAmount).up()
              .ele('goodsGrossWeight').txt(declaration3.Goods[i].goodsWeight).up()
              .ele('goodsGrossWeightUnit').txt(declaration3.DeclarationGoods.grossWeightUnit).up()
            .up()
        }
        
      }
  // convert the XML tree to string
  
  var xml = root.end({ pretty: true });

  let get3name = declaration3.Importer.importerName.slice(0, 3);
  let get10invoice = selectedInvoice.slice(0, 10);
  get10invoice = get10invoice.replace(/-/g, '_').replace(/\./g, '_').replace(/\//g, '_');
  let full_file_name = "./" + get3name + "_" + get10invoice +'.xml';
  fs.writeFileSync(full_file_name, xml, function(err) {
    if (err) throw err;
  });
  res.download(get3name + "_" + get10invoice.replace(/-/g, '_').replace(/\./g, '_').replace(/\//g, '_') +'.xml');
});

const PAGE_SIZE = 50;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//HSCODE PAGE TO LOOK UP HSCODE
// Only rows shaped like a real national tariff line (e.g. 0101.21.00) are actually
// declarable — the reference data also contains heading/sub-heading rows (e.g. "01.01",
// "0102.29") that exist purely to group codes, per the BDTTC tariff book layout, and are
// never themselves selected on a declaration.
const DECLARABLE_HSCODE_FILTER = { HSCode: { $regex: /^\d{4}\.\d{2}\.\d{2}$/ } };

app.get("/hscode", requireLogin, async (req, res) => {
  const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const q = (req.query.q || "").trim();

  let filter = DECLARABLE_HSCODE_FILTER;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter = { ...DECLARABLE_HSCODE_FILTER, $or: [{ HSCode: rx }, { Description: rx }, { category: rx }, { subCategory: rx }] };
  }

  const totalCount = await Hscode2.countDocuments(filter);
  const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);
  const currentPage = Math.min(requestedPage, totalPages);

  const hscode = await Hscode2.find(filter)
    .sort({ HSCode: 1 })
    .skip((currentPage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  res.render("hscode.ejs", { hscode, currentPage, totalPages, totalCount, q });
});

app.post("/hscode/create", requireLogin, async (req, res) => {
  const { HSCode, Description, category, subCategory, Quantity, ImportDutyRate, ExciseDutyRate, page, q } = req.body;
  const redirectUrl = `/hscode?page=${page || 1}&q=${encodeURIComponent(q || "")}`;
  if (!HSCode?.trim() || !Description?.trim()) {
    req.flash("error", "HSCode and Description are required.");
    return res.redirect(redirectUrl);
  }
  await Hscode2.create({
    HSCode: HSCode.trim(),
    Description: Description.trim(),
    category: (category || "").trim(),
    subCategory: (subCategory || "").trim(),
    Quantity: (Quantity || "").trim(),
    ImportDutyRate: (ImportDutyRate || "").trim(),
    ExciseDutyRate: (ExciseDutyRate || "").trim(),
  });
  res.redirect(redirectUrl);
});

app.post("/hscode/update", requireLogin, async (req, res) => {
  const { _id, HSCode, Description, category, subCategory, Quantity, ImportDutyRate, ExciseDutyRate, page, q } = req.body;
  const redirectUrl = `/hscode?page=${page || 1}&q=${encodeURIComponent(q || "")}`;
  if (!HSCode?.trim() || !Description?.trim()) {
    req.flash("error", "HSCode and Description are required.");
    return res.redirect(redirectUrl);
  }
  const updated = await Hscode2.findByIdAndUpdate(
    _id,
    {
      HSCode: HSCode.trim(),
      Description: Description.trim(),
      category: (category || "").trim(),
      subCategory: (subCategory || "").trim(),
      Quantity: (Quantity || "").trim(),
      ImportDutyRate: (ImportDutyRate || "").trim(),
      ExciseDutyRate: (ExciseDutyRate || "").trim(),
    },
    { new: true, runValidators: true }
  );
  if (!updated) req.flash("error", "HSCode record not found.");
  res.redirect(redirectUrl);
});

app.post("/hscode/delete/:id", requireLogin, requireAdmin, async (req, res) => {
  await Hscode2.findByIdAndDelete(req.params.id);
  const { page, q } = req.query;
  res.redirect(`/hscode?page=${page || 1}&q=${encodeURIComponent(q || "")}`);
});

app.get("/api/hscode/search", requireLogin, async (req, res) => {
  const q = (req.query.q || "").trim();
  let filter = DECLARABLE_HSCODE_FILTER;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter = { ...DECLARABLE_HSCODE_FILTER, $or: [{ HSCode: rx }, { Description: rx }, { category: rx }, { subCategory: rx }] };
  }
  const results = await Hscode2.find(filter).sort({ HSCode: 1 }).limit(50).lean();
  res.json(results);
});

//UNLOCODE PORT LIST PAGE
app.get("/unlocodeportlist", requireLogin, async (req, res) => {
  const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const q = (req.query.q || "").trim();

  let filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter = { $or: [{ Name: rx }, { Country: rx }, { Location: rx }] };
  }

  const totalCount = await Unlocode_port_list2.countDocuments(filter);
  const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);
  const currentPage = Math.min(requestedPage, totalPages);

  const unlocode_port_list = await Unlocode_port_list2.find(filter)
    .sort({ Name: 1 })
    .skip((currentPage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  res.render("unlocodeport.ejs", { unlocode_port_list, currentPage, totalPages, totalCount, q });
});

app.post("/unlocodeportlist/create", requireLogin, async (req, res) => {
  const { Country, Location, Name, page, q } = req.body;
  const redirectUrl = `/unlocodeportlist?page=${page || 1}&q=${encodeURIComponent(q || "")}`;
  if (!Country?.trim() || !Location?.trim() || !Name?.trim()) {
    req.flash("error", "Country, Location and Name are required.");
    return res.redirect(redirectUrl);
  }
  await Unlocode_port_list2.create({
    Country: Country.trim(),
    Location: Location.trim(),
    Name: Name.trim(),
  });
  res.redirect(redirectUrl);
});

app.post("/unlocodeportlist/update", requireLogin, async (req, res) => {
  const { _id, Country, Location, Name, page, q } = req.body;
  const redirectUrl = `/unlocodeportlist?page=${page || 1}&q=${encodeURIComponent(q || "")}`;
  if (!Country?.trim() || !Location?.trim() || !Name?.trim()) {
    req.flash("error", "Country, Location and Name are required.");
    return res.redirect(redirectUrl);
  }
  const updated = await Unlocode_port_list2.findByIdAndUpdate(
    _id,
    { Country: Country.trim(), Location: Location.trim(), Name: Name.trim() },
    { new: true, runValidators: true }
  );
  if (!updated) req.flash("error", "Unlocode record not found.");
  res.redirect(redirectUrl);
});

app.post("/unlocodeportlist/delete/:id", requireLogin, requireAdmin, async (req, res) => {
  await Unlocode_port_list2.findByIdAndDelete(req.params.id);
  const { page, q } = req.query;
  res.redirect(`/unlocodeportlist?page=${page || 1}&q=${encodeURIComponent(q || "")}`);
});

//CUSTOMERS PAGE
app.get("/customers", requireLogin, async (req, res) => {
  const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const q = (req.query.q || "").trim();

  let filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter = { $or: [{ name: rx }, { address: rx }, { country: rx }] };
  }

  const totalCount = await Consignee.countDocuments(filter);
  const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);
  const currentPage = Math.min(requestedPage, totalPages);

  const customers = await Consignee.find(filter)
    .sort({ name: 1 })
    .skip((currentPage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  res.render("customers.ejs", { customers, currentPage, totalPages, totalCount, q });
});

app.post("/customers/create", requireLogin, async (req, res) => {
  const { name, address, reg, country, telephone, postal, page, q } = req.body;
  const redirectUrl = `/customers?page=${page || 1}&q=${encodeURIComponent(q || "")}`;
  if (!name?.trim() || !address?.trim() || !reg?.trim() || !country?.trim() || !telephone?.trim() || !postal?.trim()) {
    req.flash("error", "Name, Address, Registration, Country, Telephone and Postal are required.");
    return res.redirect(redirectUrl);
  }
  await Consignee.create({
    name: name.trim(),
    address: address.trim(),
    reg: reg.trim(),
    country: country.trim(),
    telephone: telephone.trim(),
    postal: postal.trim(),
  });
  res.redirect(redirectUrl);
});

app.post("/customers/update", requireLogin, async (req, res) => {
  const { _id, name, address, reg, country, telephone, postal, page, q } = req.body;
  const redirectUrl = `/customers?page=${page || 1}&q=${encodeURIComponent(q || "")}`;
  if (!name?.trim() || !address?.trim() || !reg?.trim() || !country?.trim() || !telephone?.trim() || !postal?.trim()) {
    req.flash("error", "Name, Address, Registration, Country, Telephone and Postal are required.");
    return res.redirect(redirectUrl);
  }
  const updated = await Consignee.findByIdAndUpdate(
    _id,
    {
      name: name.trim(),
      address: address.trim(),
      reg: reg.trim(),
      country: country.trim(),
      telephone: telephone.trim(),
      postal: postal.trim(),
    },
    { new: true, runValidators: true }
  );
  if (!updated) req.flash("error", "Customer record not found.");
  res.redirect(redirectUrl);
});

app.post("/customers/delete/:id", requireLogin, requireAdmin, async (req, res) => {
  await Consignee.findByIdAndDelete(req.params.id);
  const { page, q } = req.query;
  res.redirect(`/customers?page=${page || 1}&q=${encodeURIComponent(q || "")}`);
});

/* USER MANAGEMENT (Admin only) */

app.get("/users", requireLogin, requireAdmin, async (req, res) => {
  const users = await User.find({}).sort({ name: 1 });
  res.render("users.ejs", { users });
});

app.post("/users/create", requireLogin, requireAdmin, async (req, res) => {
  const { name, email, password, phone, idType, icNo, icColor, designation } = req.body;
  if (!name?.trim() || !email?.trim() || !password?.trim() || !idType?.trim() || !icNo?.trim() || !icColor?.trim() || !designation?.trim()) {
    req.flash("error", "Name, Email, Password, ID Type, IC Number, IC Color and Designation are required.");
    return res.redirect("/users");
  }
  const existing = await User.findOne({ email: email.trim() });
  if (existing) {
    req.flash("error", "A user with that email already exists.");
    return res.redirect("/users");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({
    name: name.trim(),
    email: email.trim(),
    password: hashedPassword,
    phone: (phone || "").trim(),
    idType: idType.trim(),
    icNo: icNo.trim(),
    icColor: icColor.trim(),
    designation: designation.trim(),
  });
  req.flash("success", "User created.");
  res.redirect("/users");
});

app.post("/users/update", requireLogin, requireAdmin, async (req, res) => {
  const { _id, name, email, password, phone, idType, icNo, icColor, designation } = req.body;
  if (!name?.trim() || !email?.trim() || !idType?.trim() || !icNo?.trim() || !icColor?.trim() || !designation?.trim()) {
    req.flash("error", "Name, Email, ID Type, IC Number, IC Color and Designation are required.");
    return res.redirect("/users");
  }
  const existing = await User.findOne({ email: email.trim(), _id: { $ne: _id } });
  if (existing) {
    req.flash("error", "A user with that email already exists.");
    return res.redirect("/users");
  }
  const update = {
    name: name.trim(),
    email: email.trim(),
    phone: (phone || "").trim(),
    idType: idType.trim(),
    icNo: icNo.trim(),
    icColor: icColor.trim(),
    designation: designation.trim(),
  };
  if (password?.trim()) {
    update.password = await bcrypt.hash(password.trim(), 10);
  }
  const updated = await User.findByIdAndUpdate(_id, update, { new: true, runValidators: true });
  if (!updated) req.flash("error", "User not found.");
  else req.flash("success", "User updated.");
  res.redirect("/users");
});

app.post("/users/delete/:id", requireLogin, requireAdmin, async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    req.flash("error", "You cannot delete your own account.");
    return res.redirect("/users");
  }
  await User.findByIdAndDelete(req.params.id);
  req.flash("success", "User deleted.");
  res.redirect("/users");
});

/* HSCODE EDIT POST */

app.post("/addhscode", async (req, res) => {
  const { 
    heading,
    name,
    cat1,
    cat2,
    cat3,
    cat4,
    hscodeentry,
    unitOfQuantity,
    rateOfImportDuty,
    rateOfExciseDuty,
  } = req.body;

  const hscode = new Hscode ({ 
    heading,
    description : {
      name,
      category : {
        cat1,
        cat2,
        cat3,
        cat4,
      },
      hscodeentry,
      unitOfQuantity,
      rateOfImportDuty,
      rateOfExciseDuty,
    }
  });
  await hscode.save();
  console.log("HSCODE ENTRY SAVED")
  res.redirect("/hscodeedit");
  
});


//deleting bdnsw item
app.post("/delete/:id", requireLogin, requireAdmin, async (req, res) => {
  await Bdnsw.findByIdAndDelete(req.params.id);
  res.redirect("/bdnsw");
});

//unfinished pages
app.get("/wip", requireLogin, (req, res) => {
  res.render("wip.ejs")
})

//logging out
app.delete("/logout", (req, res) => {
  req.logout(function(err) {
    if (err) { 
      return next(err); 
    };})
  res.redirect("/login");
});


//app.listen(3000, () => console.log("Server is running"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, console.log(`Server start on ${PORT}`))
//
