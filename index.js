const express = require("express")
const passport = require("passport");
const initializePassport = require("./passport");
const session = require("express-session");
const flash = require("express-flash");
const override = require("method-override");
const MongoStore = require("connect-mongo");
var xml = require('xml');
var builder = require('xmlbuilder');
const { create } = require('xmlbuilder2');
const { DOMParser } = require("@oozcitak/dom");
let fs = require('fs');

initializePassport(passport);
const app = express()


const mongoose = require("mongoose");
require("dotenv").config();

const bcrypt = require("bcryptjs");

//models
const User = require("./models/user");
const Bdnsw = require("./models/bdnswdata"); //accounts
//const Declaration = require("./models/declaration"); //unused
//const Invoices = require("./models/invoices"); //unused
//const Goods = require("./models/goods");
//const Declaration2 = require("./models/declaration2");
const Declaration3 = require("./models/declaration3");
const Hscode = require("./models/hscode"); //ignoreblank
const Hscode2 = require("./models/hscode2"); //no ignoreblank
const Port_Code = require("./models/port_code");
const ISO_CountryCodes = require("./models/iso_countrycodes");
//port2 cleaned from unnecessary headers e.g. location, name2, coordinates
const Unlocode_port_list2 = require("./models/unlocode_port_list2");

app.set("view-engine", "ejs")
app.use(express.urlencoded({ extended: false }))

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
    console.log("req.user.name = " + req.user.name + " & req.user.email = " + req.user.email);
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

function requireLogout(req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}  

app.use(override("_method"));




app.get("/", requireLogin, (req, res) => {
  //console.log("requser " + req.user.name)
  res.render("index.ejs", 
  //{ user: req.user}
  )
})

app.post("/", requireLogin, (req, res) => {
  //console.log("requser " + req.user.name)
  res.render("index.ejs", 
  //{ user: req.user}
  )
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

//SINGLEWINDOW PAGE -- WHERE ADD DECLARATION2, GOODS RESIDES. (INVOICE DEPRECIATED INTO DECLARATION2)
app.get("/singlewindow", requireLogin, async (req, res) => {
  const user = await User.find({});
  const bdnsw = await Bdnsw.find({});
  const declaration = await Declaration.find({});
  const invoices = await Invoices.find({});
  //const declaration2 = await Declaration2.find({});
  const goods = await Goods.find({});
  //res.render("singlewindow.ejs", {user: user, bdnsw: bdnsw, declaration: declaration, invoices: invoices, declaration2: declaration2, goods: goods})
})

app.get("/bdnsw", requireLogin, async (req, res) => {
  const user = await User.find({});
  const declaration3 = await Declaration3.find({}).sort({Transport:-1});
  res.render("bdnsw.ejs", {user: user, declaration3: declaration3})
})

app.get("/bdnswadd", requireLogin, async (req, res) => {
  //const user = await User.find({});
  const declaration3 = await Declaration3.find({});
  const hscode2 = await Hscode2.find({HSCode: {$exists: true, $ne: ""}});
  const port_code = await Port_Code.find({}).sort({country: 1});
  //const unlocode_port_list2 = await Unlocode_port_list2.find({});
  //const iso_countrycodes = await ISO_CountryCodes.find({});
  res.render("bdnswadd.ejs", {declaration3: declaration3, hscode2: hscode2, port_code: port_code})
  //user: user, unlocode_port_list2: unlocode_port_list2, iso_countrycodes: iso_countrycodes
})


app.get("/bdnswedit/(:id)", requireLogin, async (req, res) => {
  const user = await User.find({});
  //const hscode = await Hscode.find({HSCode: {$exists: true}});
  const hscode2 = await Hscode2.find({HSCode: {$exists: true, $ne: ""}});
  const declaration3 = await Declaration3.findOne({_id : req.params.id});
  const port_code = await Port_Code.find({}).sort({country: 1});
  // const unlocode_port_list2 = await Unlocode_port_list2.find({}); //not working yet
  // const iso_countrycodes = await ISO_CountryCodes.find({}); //not working yet
  res.render("bdnswedit.ejs", {user: user, declaration3: declaration3, hscode2: hscode2, port_code: port_code});
});



//edit profile
app.get("/profile", requireLogin, async (req, res) => {
  const user = await User.find({});
  const bdnsw = await Bdnsw.find({});
  res.render("profile.ejs", {user: user, bdnsw: bdnsw})
})

app.post("/profileupdate", async (req, res) => {
  const { name, email, phone, idType, icNo, icColor, designation, address, registration, postcode } = req.body;
  
    //let user = await User.findOne({ email: req.body.email });
    
    await User.updateMany({ 
      email:req.body.email
      },
      {
      $set: {
        name:name,
        idType:idType,
        icNo:icNo,
        icColor:icColor,
        address:address,
        phone:phone,
        designation:designation,
        registration:registration,
        postcode:postcode,
      },
      },
      {
        new: true,
      }
    )
    console.log("Email: " + email + " input IC: " + icNo)
    console.log("redirecting from updating profile")
    res.redirect("/profile");
});

//DECLARATION POST
// app.post("/declaration", async (req, res) => {
//   const { 
//     declarationDate,
//     //Header Details
//     declarationType,
//     customsProcedure, 
//     dutiableIndicator, 
//     transportMode, 
//     countryShipment,
//     countryDestination,
//     portDischarge,
//     portEntry,
//     clearanceStationCode,
//     remarks,
//     //Party Details
//     traderType,
//     regTraderCoyRegNo,
//     individualTraderICNo,
//     individualTraderIDType,
//     individualTraderICColour,
//     individualAddress,
//     traderName,
//     consigneeCompanyRegNo,
//     consigneeName,
//     dutyExemptIndicator,
//     ceptSchemeIndicator,
//     //Bill of Lading Details
//     masterBillNo,
//     vesselFlightVehicleNo,
//     vesselName,
//     vesselFlightArrivalDate,
//     containerTransportIndicator,
//     totalGrossWeight,
//     totalGrossWeightUnit,
//     totalNoPackages,
//     totalNoPackagesUnit,
//     //Transit Details
//     //Guarantee Details
//     bgAmount
//   } = req.body;
  
//   const declaration = new Declaration ({ 
//     declarationDate,
//     //Header Details
//     declarationType,
//     customsProcedure, 
//     dutiableIndicator, 
//     transportMode, 
//     countryShipment,
//     countryDestination,
//     portDischarge,
//     portEntry,
//     clearanceStationCode,
//     remarks,
//     //Party Details
//     traderType,
//     regTraderCoyRegNo,
//     individualTraderICNo,
//     individualTraderIDType,
//     individualTraderICColour,
//     individualAddress,
//     traderName,
//     consigneeCompanyRegNo,
//     consigneeName,
//     dutyExemptIndicator,
//     ceptSchemeIndicator,
//     //Bill of Lading Details
//     masterBillNo,
//     vesselFlightVehicleNo,
//     vesselName,
//     vesselFlightArrivalDate,
//     containerTransportIndicator,
//     totalGrossWeight,
//     totalGrossWeightUnit,
//     totalNoPackages,
//     totalNoPackagesUnit,
//     //Transit Details
//     //Guarantee Details
//     bgAmount
//   });
// });

//Invoices POST unused
// app.post("/invoices", async (req, res) => {
//     const { 
//       invoiceNumber,
//       invoiceDate,
//       termType, 
//       invoiceAmount, 
//       invoiceCurrency, 
//       freightAmount,
//       freightCurrency,
//       insuranceAmount,
//       insuranceCurrency,
//       otherAmount,
//       otherAmountCurrency
//     } = req.body;
    
//     const invoices = new Invoices ({ 
//       invoiceNumber,
//       invoiceDate,
//       termType, 
//       invoiceAmount, 
//       invoiceCurrency, 
//       freightAmount,
//       freightCurrency,
//       insuranceAmount,
//       insuranceCurrency,
//       otherAmount,
//       otherAmountCurrency
//     });

//   await invoices.save();
//   res.redirect("/singlewindow");
  
// });

//declaration3 POST

app.post("/declaration3", async (req, res) => {

  
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
  for (var i = 0; i < invoiceNo.length; i++){
    //console.log(goodsSerialNo[i]);
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
  
  var declarationGoods = [];
  for (var i = 0; i < goodsSerialNo.length; i++){
    console.log(goodsSerialNo[i]);
    if(goodsSerialNo[i]){
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

  
  
  
  await declaration3.save();
  

  res.redirect("/bdnsw");
  
});

//bdnswedit
app.post("/recordsEdit", async (req, res) => {

  
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
  for (var i = 0; i < invoiceNo.length; i++){
    //console.log(goodsSerialNo[i]);
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

  var declarationGoods = [];
  for (var i = 0; i < goodsSerialNo.length; i++){
    //console.log(goodsSerialNo[i]);
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

  await Declaration3.updateMany ({ _id:req.body._id},
    {$set: {
      //dateGranted:dateGranted,
      //departureDate:departureDate,
      //cept:cept,
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
  //console.log("redirecting from bdnswEdit, edited: " + req.body._id)

  res.redirect("/bdnsw");
  
});

//DOWNLOAD XML (BDNSW PAGE) CURRENTLY UNUSED. SWAPPED WITH XML BELOW
// app.post("/downloadXML", async (req, res) => {
//   const {
//     selectId,
//     selectedInvoice
//   } = req.body;

//   const declaration3 = await Declaration3.findOne({'_id' : req.body.selectId}, { _id: 0, __v: 0});

//   //countryshipment&destination change to alpha-2 code from full country name
//   const iso_countrycodes = await ISO_CountryCodes.findOne({'name' : { $regex : new RegExp(declaration3.Transport.countryShipment, "i") } } );
//   const iso_countrycodes2 = await ISO_CountryCodes.findOne({'name' : { $regex : new RegExp(declaration3.Transport.countryDestination, "i") } } );

//   //const iso_countrycodes = await ISO_CountryCodes.findOne({'name' : 'AFGHANSITAN'}, { _id: 0, __v: 0});

//   //console.log("Checking countrycode of: " + iso_countrycodes);
//   //console.log("Checking countrycode of: " + 'iso_countrycodes.name' + "/" + declaration3.Transport.countryShipment + " and " + 'iso_countrycodes.alpha_2');
//   //console.log("Checking item with invoice number: " + selectedInvoice);
//   //console.log("Dec3 Goods " + declaration3.Goods); //scrapped. make new array incase of multiple invoices
//   const Goods = await Declaration3.find({'goodsInvoiceNo' : req.body.selectedInvoice}, { _id: 0, __v: 0});

//   //countrySHipment & Destination to COUNTRY CODE





//   //incase of multiple invoices in one data, get more for XML
//   var tempInvoice = [];
//   var tempInvoiceAmount = [];
//   tempInvoice[0] = declaration3.Goods[0].goodsInvoiceNo;
//   tempInvoiceAmount[0] = Number(declaration3.Goods[0].goodsAmount);
//   //console.log("TEMPINVOICE @0 is " + tempInvoice[0] + ". TEMPAMOUNT @0 is " + tempInvoiceAmount[0]);
//   for(var k = 1; k < declaration3.Goods.length; k++){
//     if(declaration3.Goods[k].goodsInvoiceNo === declaration3.Goods[k-1].goodsInvoiceNo){
//       var a = tempInvoice.length;
//       tempInvoiceAmount[a - 1] = tempInvoiceAmount[a - 1] + Number(declaration3.Goods[k].goodsAmount);
//       //console.log("Count up invoiceAmount = " + (tempInvoiceAmount[a - 1]).toFixed(2) + ". Number @" + k + " is " + Number(declaration3.Goods[k].goodsAmount));
//     } else {
//       var a = tempInvoice.length;
//       tempInvoice[a] = declaration3.Goods[k].goodsInvoiceNo;
//       tempInvoiceAmount[a] = Number(declaration3.Goods[k].goodsAmount);
//       //console.log("TEMPINVOICE @" + (a) + " is " + tempInvoice[a]);
//     }
//   }

//   //format XML
//   //get goods's amount for remarks. goods.
//   //console.log("Invoice Amount at 0 is " + declaration3.Goods[0].goodsAmount);
//   var totalAmount = 0;
//   goodsEntry= '';
//   for (var i = 0; i < declaration3.Goods.length; i++) {
//     totalAmount = totalAmount + declaration3.Goods[i].goodsAmount;
//     goodsEntry = goodsEntry + ".ele('goodsSerialNo').txt(declaration3.Goods[" +i+ "].goodsSerialNo).up() "
//   }
//   //console.log("Total Amount is " + totalAmount);
//   //console.log(declaration3.Goods.length)
//   var goodsShenanigans = ".ele(declaration3.Goods[0]).up()"
//   //var root = create({})
//   var root = builder.create('Declaration', { encoding: 'utf-8' })
  
  
//       .ele('General')
//         .com(' Header Details ')
//         .ele('declarationType').txt(declaration3.Procedure.customsProcedure).up()
//         .ele('customsProcedure').txt(declaration3.Procedure.customsProcedureCode).up()
//         .ele('dutiableIndicator').txt(declaration3.Procedure.dutiableIndicator).up()
//         .ele('transportMode').txt(declaration3.Procedure.dutiableIndicatorCode).up()
//         .ele('countryShipment').txt(iso_countrycodes.alpha_2).up()
//         .ele('countryDestination').txt(iso_countrycodes2.alpha_2).up()
//         .ele('portDischarge').txt(declaration3.Transport.portOfDischargeCode).up()
//         .ele('portEntry').txt(declaration3.Transport.portOfEntryCode).up()
//         .ele('clearanceStationCode').txt(declaration3.Procedure.clearanceStationCode).up()
//         .ele('remarks').txt('FOB INV ' + declaration3.Importer.importerType + ' ( NON-DUTIABLE ' + declaration3.DeclarationGoods.invoiceCurrency + ' ' + totalAmount.toFixed(2) + ' / DUTIABLE- EXCISE )').up()
        
//         .com(' Party Details ')
//         .ele('traderType').txt(declaration3.Importer.importerType).up()
//         .ele('individualTraderICNo').txt(declaration3.Importer.importerRegistration).up()
//         .ele('indivdualTraderIDType').txt('IC').up()
//         .ele('individualTraderICColour').txt(declaration3.Importer.importerICColor).up()
//         .ele('individualAddress').txt(declaration3.Importer.importerAddress).up()
//         .ele('traderName').txt(declaration3.Importer.importerName).up()
//         .ele('consigneeCompanyRegNo').txt(declaration3.Importer.importerRegistration).up()
//         .ele('consigneeName').txt(declaration3.Importer.importerName).up()
//         .ele('dutyExemptIndicator').txt('N').up()
//         .ele('ceptSchemeIndicator').txt('N').up()
        
//         .com(' BillOfLadingDetails ')
//         .ele('masterBillNo').txt(declaration3.Transport.bldoawb).up()
//         .ele('vesselFlightVehicleNo').txt(declaration3.Transport.vesselNo).up()
//         .ele('vesselName').txt(declaration3.Transport.vesselName).up()
//         .ele('vesselFlightArrivalDate').txt(declaration3.Transport.arrivalDate).up()
//         .ele('totalGrossWeight').txt(declaration3.DeclarationGoods.totalGrossWeight).up()
//         .ele('totalGrossWeightUnit').txt(declaration3.DeclarationGoods.grossWeightUnit).up()
//         .ele('totalNoPackages').txt(declaration3.DeclarationGoods.totalPackagesNo).up()
//         .ele('totalNoPackagesUnit').txt(declaration3.DeclarationGoods.packageNoUnit).up()
        
//         .com(' TransitDetails ')
        
//         .com(' Guarantee Details ')
//         .ele('bgAmount').txt(declaration3.SecurityDeposit.bankGuaranteeAmount).up()

//       .up()    
//       for(var j = 0; j < tempInvoice.length; j++){
//         console.log("J is = " + j)
//         root.ele('invoices')
//           .ele('invoiceNumber').txt(tempInvoice[j]).up()
//           .ele('invoiceDate').txt(declaration3.dateGranted).up()
//           .ele('termType').txt(declaration3.DeclarationGoods.otherChargesType).up()
//           .ele('invoiceAmount').txt(tempInvoiceAmount[j].toFixed(2)).up()
//           .ele('invoiceCurrency').txt(declaration3.DeclarationGoods.invoiceCurrency).up()
//           .ele('freightAmount').txt(declaration3.DeclarationGoods.freightCharge).up()
//           .ele('freightCurrency').txt(declaration3.DeclarationGoods.freightCurrency).up()
//           .ele('insuranceAmount').txt(declaration3.DeclarationGoods.insuranceAmount).up()
//           .ele('insuranceCurrency').txt(declaration3.DeclarationGoods.insuranceCurrency).up()
//           .ele('otherAmount').txt(declaration3.DeclarationGoods.otherCharges).up()
//           .ele('otherAmountCurrency').txt('BND').up()
//         .up()
        
        
//       }
//       for(var i = 0; i < declaration3.Goods.length; i++){
//         root.ele('Goods')
//               .ele('goodsSerialNo').txt(declaration3.Goods[i].goodsSerialNo).up()
//               .ele('goodsDescription').txt(declaration3.Goods[i].goodsDescription).up()
//               .ele('goodsHSCode').txt(declaration3.Goods[i].hsCode).up()
//               .ele('shippingMarks').txt(declaration3.Goods[i].goodsShippingMark).up()
//               .ele('countryOrigin').txt(declaration3.Goods[i].countryOrigin).up()
//               .ele('quantity').txt(declaration3.Goods[i].goodsQuantity).up()
//               .ele('quantityUOM').txt(declaration3.Goods[i].goodsUnit).up()
//               .ele('noPackages').txt(declaration3.Goods[i].goodsPackageNo).up()
//               .ele('noPackagesUnit').txt(declaration3.Goods[i].goodsPackageUnit).up()
//               .ele('invoiceNo').txt(declaration3.Goods[i].goodsInvoiceNo).up()
//               .ele('invoiceAmount').txt(declaration3.Goods[i].goodsAmount).up()
//               .ele('goodsGrossWeight').txt(declaration3.Goods[i].goodsWeight).up()
//               .ele('goodsGrossWeightUnit').txt(declaration3.DeclarationGoods.grossWeightUnit).up()
//             .up()
//       }
//   // convert the XML tree to string
  
//   var xml = root.end({ prettyPrint: true });
//   //console.log(root.end({ prettyPrint: true }))
//   //removes
//   //<![CDATA[ [object Object] ]]>
//   //<![CDATA[ false ]]>
//   // xml = xml.replaceAll("<![CDATA[", "").replaceAll("[object Object]", "").replaceAll("false", "").replaceAll("]]>", "");
//   // xml = xml.replace("<declarationDate/>", " ");
//   // xml = xml.replace("<_doc>", " ").replace("</_doc>", " ");

//   // xml = xml.replaceAll("_doc", "Goods");

//   //console.log("Tradername is " + declaration2.General.traderName);
//   let get3name = declaration3.Importer.importerName.slice(0, 3);
//   //console.log("Tradername is " + get3name);
//   let get10invoice = selectedInvoice.slice(0, 10);
//   //console.log("Invoice is " + get10invoice);
//   get10invoice = get10invoice.replace(/-/g, '_').replace(/\./g, '_').replace(/\//g, '_');
//   //console.log("After .replace, invoice is " + get10invoice);
//   let full_file_name = "./" + get3name + "_" + get10invoice +'.xml';
//   fs.writeFileSync(full_file_name, xml, function(err) {
//     if (err) throw err;
//   });
//   console.log(selectedInvoice.replace(/-/g, '_'))  
//   console.log("FINAL NAME IS " + get3name + "_" + get10invoice.replace(/-/g, '_').replace(/\./g, '_').replace(/\//g, '_') +'.xml')  
//   res.download(get3name + "_" + get10invoice.replace(/-/g, '_').replace(/\./g, '_').replace(/\//g, '_') +'.xml');
// });

//copy for dashboard
app.get("/downloadXML/:id/:invoice", async (req, res) => {
  // const {
  //   selectId,
  //   selectedInvoice
  // } = req.body;
  const selectedInvoice = req.params.invoice;

  const declaration3 = await Declaration3.findOne({'_id' : req.params.id}, { _id: 0, __v: 0});
  const iso_countrycodes = await ISO_CountryCodes.findOne({'name' : { $regex : new RegExp(declaration3.Transport.countryShipment, "i") } } );
  const iso_countrycodes2 = await ISO_CountryCodes.findOne({'name' : { $regex : new RegExp(declaration3.Transport.countryDestination, "i") } } );

  //const iso_countrycodes = await ISO_CountryCodes.findOne({'name' : 'AFGHANSITAN'}, { _id: 0, __v: 0});

  //console.log("Checking countrycode of: " + iso_countrycodes);
  //console.log("Checking countrycode of: " + 'iso_countrycodes.name' + "/" + declaration3.Transport.countryShipment + " and " + 'iso_countrycodes.alpha_2');
  //console.log("Checking item with invoice number: " + selectedInvoice);
  //console.log("Dec3 Goods " + declaration3.Goods); //scrapped. make new array incase of multiple invoices
  const Goods = await Declaration3.find({'goodsInvoiceNo' : req.params.invoice}, { _id: 0, __v: 0});

  //countryShipment & Destination to COUNTRY CODE





  //incase of multiple invoices in one data, get more for XML
  var tempInvoice = [];
  var tempInvoiceAmount = [];
  tempInvoice[0] = declaration3.Goods[0].goodsInvoiceNo;
  tempInvoiceAmount[0] = Number(declaration3.Goods[0].goodsAmount);
  //console.log("TEMPINVOICE @0 is " + tempInvoice[0] + ". TEMPAMOUNT @0 is " + tempInvoiceAmount[0]);
  for(var k = 1; k < declaration3.Goods.length; k++){
    if(declaration3.Goods[k].goodsInvoiceNo === declaration3.Goods[k-1].goodsInvoiceNo){
      var a = tempInvoice.length;
      tempInvoiceAmount[a - 1] = tempInvoiceAmount[a - 1] + Number(declaration3.Goods[k].goodsAmount);
      //console.log("Count up invoiceAmount = " + (tempInvoiceAmount[a - 1]).toFixed(2) + ". Number @" + k + " is " + Number(declaration3.Goods[k].goodsAmount));
    } else {
      var a = tempInvoice.length;
      tempInvoice[a] = declaration3.Goods[k].goodsInvoiceNo;
      tempInvoiceAmount[a] = Number(declaration3.Goods[k].goodsAmount);
      //console.log("TEMPINVOICE @" + (a) + " is " + tempInvoice[a]);
    }
  }

  //format XML
  //get goods's amount for remarks. goods.
  //console.log("Invoice Amount at 0 is " + declaration3.Goods[0].goodsAmount);
  var totalAmount = 0;
  goodsEntry= '';
  for (var i = 0; i < declaration3.Goods.length; i++) {
    totalAmount = totalAmount + declaration3.Goods[i].goodsAmount;
    goodsEntry = goodsEntry + ".ele('goodsSerialNo').txt(declaration3.Goods[" +i+ "].goodsSerialNo).up() "
  }
  //console.log("Total Amount is " + totalAmount);
  //console.log(declaration3.Goods.length)
  //var root = create({})
  
  //***auto remarks need to be edited****
  //based on:
  // FOB INV USD 18,275.28 BND 24,691.73 ( DUTIABLE-EXCISE USD 18,275.28 BND 24,691.73 ) FRT B$60.80 OTHER CHARGES B$180.00 10
  // idk fob, idk inv, usd total invoice -- ccy to bnd, ( dutiable amount of items with duty, / non excise items without duty ) freight bnd other charges bnd


  //IF TRDR
  if(declaration3.Importer.regTraderCoyRegNo){
    var root = builder.create('Declaration', { encoding: 'utf-8' })
  
  
      .ele('General')
        .com(' Header Details ')
        .ele('declarationType').txt(declaration3.Procedure.customsProcedure).up()
        .ele('customsProcedure').txt(declaration3.Procedure.customsProcedureCode).up()
        .ele('dutiableIndicator').txt(declaration3.Procedure.dutiableIndicator).up()
        .ele('transportMode').txt(declaration3.Procedure.dutiableIndicatorCode).up()
        .ele('countryShipment').txt(iso_countrycodes.alpha_2).up()
        .ele('countryDestination').txt(iso_countrycodes2.alpha_2).up()
        .ele('portDischarge').txt(declaration3.Transport.portOfDischargeCode).up()
        .ele('portEntry').txt(declaration3.Transport.portOfEntryCode).up()
        .ele('clearanceStationCode').txt(declaration3.Procedure.clearanceStationCode).up()
        .ele('remarks').txt('FOB INV ' + declaration3.Importer.importerType + ' ( NON-DUTIABLE ' + declaration3.DeclarationGoods.invoiceCurrency + ' ' + totalAmount.toFixed(2) + ' / DUTIABLE- EXCISE )').up()
        
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
  // IF INDV
  else {
    var root = builder.create('Declaration', { encoding: 'utf-8' })
  
  
      .ele('General')
        .com(' Header Details ')
        .ele('declarationType').txt(declaration3.Procedure.customsProcedure).up()
        .ele('customsProcedure').txt(declaration3.Procedure.customsProcedureCode).up()
        .ele('dutiableIndicator').txt(declaration3.Procedure.dutiableIndicator).up()
        .ele('transportMode').txt(declaration3.Procedure.dutiableIndicatorCode).up()
        .ele('countryShipment').txt(iso_countrycodes.alpha_2).up()
        .ele('countryDestination').txt(iso_countrycodes2.alpha_2).up()
        .ele('portDischarge').txt(declaration3.Transport.portOfDischargeCode).up()
        .ele('portEntry').txt(declaration3.Transport.portOfEntryCode).up()
        .ele('clearanceStationCode').txt(declaration3.Procedure.clearanceStationCode).up()
        .ele('remarks').txt('FOB INV ' + declaration3.Importer.importerType + ' ( NON-DUTIABLE ' + declaration3.DeclarationGoods.invoiceCurrency + ' ' + totalAmount.toFixed(2) + ' / DUTIABLE- EXCISE )').up()
        
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
  //console.log(root.end({ prettyPrint: true }))
  //removes
  //<![CDATA[ [object Object] ]]>
  //<![CDATA[ false ]]>
  // xml = xml.replaceAll("<![CDATA[", "").replaceAll("[object Object]", "").replaceAll("false", "").replaceAll("]]>", "");
  // xml = xml.replace("<declarationDate/>", " ");
  // xml = xml.replace("<_doc>", " ").replace("</_doc>", " ");

  // xml = xml.replaceAll("_doc", "Goods");

  //console.log("Tradername is " + declaration2.General.traderName);
  let get3name = declaration3.Importer.importerName.slice(0, 3);
  //console.log("Tradername is " + get3name);
  let get10invoice = selectedInvoice.slice(0, 10);
  //console.log("Invoice is " + get10invoice);
  get10invoice = get10invoice.replace(/-/g, '_').replace(/\./g, '_').replace(/\//g, '_');
  //console.log("After .replace, invoice is " + get10invoice);
  let full_file_name = "./" + get3name + "_" + get10invoice +'.xml';
  fs.writeFileSync(full_file_name, xml, function(err) {
    if (err) throw err;
  });
  console.log(selectedInvoice.replace(/-/g, '_'))  
  console.log("FINAL NAME IS " + get3name + "_" + get10invoice.replace(/-/g, '_').replace(/\./g, '_').replace(/\//g, '_') +'.xml')  
  res.download(get3name + "_" + get10invoice.replace(/-/g, '_').replace(/\./g, '_').replace(/\//g, '_') +'.xml');
});

//HSCODE PAGE TO LOOK UP HSCODE
app.get("/hscode", requireLogin, async (req, res) => {
  const hscode = await Hscode2.find({});
  res.render("hscode.ejs", {hscode: hscode})
});

//HSCODE PAGE TO LOOK UP HSCODE
app.get("/unlocodeportlist", requireLogin, async (req, res) => {
  const unlocode_port_list2 = await Unlocode_port_list2.find({});
  res.render("unlocodeport.ejs", {unlocode_port_list: unlocode_port_list2})
});

//HSCODE EDIT PAGE TO ADD/EDIT HSCODE 
//NOT WORKING
// app.get("/hscodeedit", requireLogin, async (req, res) => {
//   const hscode = await Hscode.find({}).sort({Heading: 1, 'HSCode': 1});
//   res.render("hscodeedit.ejs", {hscode: hscode})
// });

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
app.get("/delete/:id", async (req, res) => {
  
    
    await Bdnsw.findByIdAndRemove({ 
      _id:req.params.id
      },
    )
    console.log("redirecting from deleting item")
    return res.redirect("/singlewindow");
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
