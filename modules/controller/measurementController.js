const User = require('../model/userModel');
const Measurement = require('../model/measurementModel');

// 1. Add measurement
const addMeasurement = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { weight, waist, chest, biceps, thighs, glutes } = req.body;

    const missing = [];
    if (weight == null || weight === '') missing.push('Weight');
    if (waist == null || waist === '') missing.push('Waist');
    if (chest == null || chest === '') missing.push('Chest');
    if (biceps == null || biceps === '') missing.push('Biceps');
    if (thighs == null || thighs === '') missing.push('Thighs');
    if (glutes == null || glutes === '') missing.push('Glutes');

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required`,
      });
    }

    const measurement = await Measurement.create({
      userId: user_id,
      weight: Number(weight),
      waist: Number(waist),
      chest: Number(chest),
      biceps: Number(biceps),
      thighs: Number(thighs),
      glutes: Number(glutes),
    });

    return res.json({
      success: true,
      message: 'Measurement added successfully',
      result: measurement,
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

// 2. Get all measurements (for logged-in user, non-deleted)
const getAllMeasurements = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const measurements = await Measurement.find({
      userId: user_id,
      status: { $ne: 'Deleted' },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Measurements fetched successfully',
      result: measurements,
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

// 3. Get measurement by id (same user, non-deleted)
const getMeasurementById = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const measurement = await Measurement.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    }).lean();

    if (!measurement) {
      return res.status(404).json({
        success: false,
        message: 'Measurement not found',
      });
    }

    return res.json({
      success: true,
      message: 'Measurement fetched successfully',
      result: measurement,
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

// 4. Update measurement (edit)
const updateMeasurement = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const { weight, waist, chest, biceps, thighs, glutes } = req.body;

    const measurement = await Measurement.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    });

    if (!measurement) {
      return res.status(404).json({
        success: false,
        message: 'Measurement not found',
      });
    }

    if (weight != null && weight !== '') measurement.weight = Number(weight);
    if (waist != null && waist !== '') measurement.waist = Number(waist);
    if (chest != null && chest !== '') measurement.chest = Number(chest);
    if (biceps != null && biceps !== '') measurement.biceps = Number(biceps);
    if (thighs != null && thighs !== '') measurement.thighs = Number(thighs);
    if (glutes != null && glutes !== '') measurement.glutes = Number(glutes);

    await measurement.save();

    return res.json({
      success: true,
      message: 'Measurement updated successfully',
      result: measurement,
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

// 5. Soft delete measurement
const deleteMeasurement = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const measurement = await Measurement.findOneAndUpdate(
      { _id: id, userId: user_id },
      { status: 'Deleted' },
      { new: true }
    ).lean();

    if (!measurement) {
      return res.status(404).json({
        success: false,
        message: 'Measurement not found',
      });
    }

    return res.json({
      success: true,
      message: 'Measurement deleted successfully',
      result: measurement,
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
  addMeasurement,
  getAllMeasurements,
  getMeasurementById,
  updateMeasurement,
  deleteMeasurement,
};
