const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
    accesstoken: {
      type: String,
      default: '',
    },
    refreshtoken: {
      type: String,
      default: '',
    },
    otp: {
      otpValue: { type: String, default: '' },
      otpExpiry: { type: Date, default: null },
    },
    securityToken: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Admin = mongoose.model('Admin', adminSchema);

const createDefaultAdmin = async () => {
  try {
    const email = 'abhinandan@jewarinternational.com';
    const admin = await Admin.findOne({ email });
    if (admin) {
      console.log('✅ Admin already exists');
      return;
    }

    const password = 'Admin@123';
    const enc_password = await bcrypt.hash(password, 10);

    await Admin.create({
      fullName: 'Abhinandan daksh',
      email,
      password: enc_password,
    });

    console.log('✅ Default Admin created successfully');
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  }
};

module.exports = { Admin, createDefaultAdmin };
