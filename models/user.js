const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
        type: String,
    },
    email: {
        type: String,
    },
    password: {
        type: String,
        minLength: 6,
        select: false
    },
    phone: {
        type: String,
    },
    idType: {
      type: String,
    },
    icNo: {
      type: String,
    },
    icColor: {
      type: String,
    },
    address: {
      type: String,
    },
    registration: {
      type: String,
    },
    postcode: {
      type: String,
    },
    designation: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);