const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const AppSettings = require('../model/appSettingsModel');

async function findActiveAppSettingsLean() {
  return AppSettings.findOne({ status: { $ne: 'Deleted' } })
    .sort({ createdAt: -1 })
    .lean();
}

async function findActiveAppSettingsDoc() {
  return AppSettings.findOne({ status: { $ne: 'Deleted' } }).sort({ createdAt: -1 });
}

function shapeContactInfoForUser(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  return {
    appName: String(s.appName ?? 'FOUR Score').trim() || 'FOUR Score',
    supportEmail: String(s.supportEmail ?? '').trim(),
    contactPhone: String(s.contactPhone ?? '').trim(),
    email: String(s.supportEmail ?? '').trim(),
    phone: String(s.contactPhone ?? '').trim(),
  };
}

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;

  const admin = await Admin.findById(admin_id);
  if (!admin) return null;
  if (admin.status === 'Deleted') return null;
  return admin;
};

// Admin: Get current app settings
const getAppSettings = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    let settings = await findActiveAppSettingsLean();

    if (!settings) {
      settings = await AppSettings.create({
        appName: 'FOUR Score',
        appDescription: '',
        supportEmail: '',
        contactPhone: '',
      });
      settings = settings.toObject();
    }

    return res.json({
      success: true,
      message: 'App settings fetched successfully',
      result: settings,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// Admin: Save app settings (upsert single document)
const saveAppSettings = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const {
      appName,
      appDescription,
      supportEmail,
      contactPhone,
      security,
    } = req.body;

    let settings = await findActiveAppSettingsDoc();
    const isUpdate = !!settings;

    if (!settings) {
      settings = new AppSettings();
    }

    if (appName != null && appName !== '') settings.appName = String(appName).trim();
    if (appDescription != null) settings.appDescription = String(appDescription || '').trim();
    if (supportEmail != null) settings.supportEmail = String(supportEmail || '').trim().toLowerCase();
    if (contactPhone != null) {
      const phone = String(contactPhone || '').trim();
      if (phone && !/^[0-9+\s().-]+$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone may only contain numbers and + ( ) - space',
        });
      }
      settings.contactPhone = phone;
    }

    if (security != null) {
      let securityObj = security;
      if (typeof security === 'string') {
        try {
          securityObj = JSON.parse(security);
        } catch (_) {
          securityObj = {};
        }
      }
      if (typeof securityObj === 'object' && securityObj !== null) {
        if (securityObj.twoFactorEnabled != null) {
          settings.security.twoFactorEnabled = Boolean(securityObj.twoFactorEnabled);
        }
        if (securityObj.sessionTimeoutMinutes != null && !Number.isNaN(Number(securityObj.sessionTimeoutMinutes))) {
          settings.security.sessionTimeoutMinutes = Number(securityObj.sessionTimeoutMinutes);
        }
        if (securityObj.enforceStrongPasswords != null) {
          settings.security.enforceStrongPasswords = Boolean(securityObj.enforceStrongPasswords);
        }
      }
    }

    settings.status = 'Active';
    await settings.save();

    return res.json({
      success: true,
      message: isUpdate ? 'App settings updated successfully' : 'App settings saved successfully',
      result: settings,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// User: contact details saved by admin (Settings → General)
const getContactInfoForUser = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'This account has been deleted',
      });
    }

    let settings = await findActiveAppSettingsLean();
    if (!settings) {
      settings = {
        appName: 'FOUR Score',
        supportEmail: '',
        contactPhone: '',
      };
    }

    return res.json({
      success: true,
      message: 'Contact info fetched successfully',
      result: shapeContactInfoForUser(settings),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

module.exports = {
  getAppSettings,
  saveAppSettings,
  getContactInfoForUser,
};

