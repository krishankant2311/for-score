const { Admin } = require('../model/adminModel');
const AppSettings = require('../model/appSettingsModel');

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

    let settings = await AppSettings.findOne({ status: { $ne: 'Deleted' } })
      .sort({ createdAt: -1 })
      .lean();

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

    let settings = await AppSettings.findOne({ status: { $ne: 'Deleted' } }).sort({ createdAt: -1 });
    const isUpdate = !!settings;

    if (!settings) {
      settings = new AppSettings();
    }

    if (appName != null && appName !== '') settings.appName = String(appName).trim();
    if (appDescription != null) settings.appDescription = String(appDescription || '').trim();
    if (supportEmail != null) settings.supportEmail = String(supportEmail || '').trim().toLowerCase();
    if (contactPhone != null) settings.contactPhone = String(contactPhone || '').trim();

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

module.exports = {
  getAppSettings,
  saveAppSettings,
};

