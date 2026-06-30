const STRETCH_PROGRAM_SEED_ID = 'default_recover_programs_v2';

const LEGACY_STRETCH_PROGRAM_SEED_IDS = ['default_recover_programs_v1'];

const STRETCH_PROGRAM_DEFAULT_ROWS = [
  {
    title: 'Morning Full Body Stretch',
    description: 'Gentle stretches for desk workers and early risers to wake up your body',
    category: 'Recover',
    durationMinutes: 20,
    level: 'All Levels',
    sortOrder: 1,
    intro:
      'This routine uses static stretching and gentle mobilization. Each position should be held at a point of mild tension, never pain. Instruct your users to breathe deeply—inhaling through the nose for 4 seconds, and exhaling slowly through the mouth for 6 seconds.',
    movements: [
      { sequenceOrder: 1, sequenceLabel: 'Grounding', movementName: "Child's Pose with Lateral Reach", targetArea: 'Lats, lower back, shoulders', timeLabel: '3 minutes' },
      { sequenceOrder: 2, sequenceLabel: 'Hips & Spine', movementName: '90/90 Hip Complex', targetArea: 'Hips, glutes, thoracic mobility', timeLabel: '4 minutes (2 min per side)' },
      { sequenceOrder: 3, sequenceLabel: 'Lower Body', movementName: 'Half-Kneeling Hip Flexor & Hamstring', targetArea: 'Hip flexors, psoas, hamstrings', timeLabel: '4 minutes (2 min per side)' },
      { sequenceOrder: 4, sequenceLabel: 'Upper Body', movementName: 'Sphinx to Thread the Needle', targetArea: 'Chest, thoracic spine, shoulders', timeLabel: '4 minutes' },
      { sequenceOrder: 5, sequenceLabel: 'Posterior Chain', movementName: 'Seated Straddle & Forward Fold', targetArea: 'Adductors, hamstrings, lower back', timeLabel: '3 minutes' },
      { sequenceOrder: 6, sequenceLabel: 'Release', movementName: 'Supine Twist', targetArea: 'Spine, chest, nervous system settling', timeLabel: '2 minutes (1 min per side)' },
    ],
  },
  {
    title: 'Post-Workout Recover',
    description: 'Release tension in legs and hips after strength training',
    category: 'Recover',
    durationMinutes: 10,
    level: 'Intermediate',
    sortOrder: 2,
    intro:
      'The focus here is fluid transition and efficiency. Instead of prolonged static holds, users will gently breathe through these foundational patterns to create space across the entire body in a short amount of time.',
    movements: [
      { sequenceOrder: 1, sequenceLabel: 'Mobilize', movementName: 'Deep Squat to Hamstring Fold', targetArea: 'Hips, glutes, hamstrings, lower back', timeLabel: '2 minutes' },
      { sequenceOrder: 2, sequenceLabel: 'Open', movementName: "World's Greatest Stretch", targetArea: 'Hip flexors, thoracic spine, chest, calves', timeLabel: '3 minutes (1.5 min per side)' },
      { sequenceOrder: 3, sequenceLabel: 'Length', movementName: 'Downward Dog to Cobra Wave', targetArea: 'Entire posterior chain, abdominals, chest', timeLabel: '2 minutes' },
      { sequenceOrder: 4, sequenceLabel: 'Release', movementName: "Thread the Needle with Child's Pose", targetArea: 'Shoulders, upper back, lats', timeLabel: '2 minutes (1 min per side)' },
      { sequenceOrder: 5, sequenceLabel: 'Center', movementName: 'Seated Neck & Shoulder Release', targetArea: 'Traps, neck, nervous system transition', timeLabel: '1 minute' },
    ],
  },
  {
    title: 'Evening Wind Down',
    description: 'Calming stretches to prepare your body for restful sleep',
    category: 'Recover',
    durationMinutes: 5,
    level: 'Beginner',
    sortOrder: 3,
    intro:
      'Because this follows a training session, we want to prioritize deep diaphragmatic breathing to signal to the brain that the work is done. Advise users to perform these movements gently, focusing on release rather than forcing flexibility.',
    movements: [
      { sequenceOrder: 1, sequenceLabel: 'Decompress', movementName: 'Bench or Wall Supported Lat Stretch', targetArea: 'Lats, triceps, thoracic spine', timeLabel: '1 minute' },
      { sequenceOrder: 2, sequenceLabel: 'Open', movementName: 'Clasp-Behind-Back Chest Opener', targetArea: 'Anterior delts, chest, biceps', timeLabel: '1 minute' },
      { sequenceOrder: 3, sequenceLabel: 'Mobilize', movementName: 'Quadruped Cat-Cow', targetArea: 'Entire spine, shoulder blades', timeLabel: '1 minute' },
      { sequenceOrder: 4, sequenceLabel: 'Release', movementName: 'Crossed-Arm Scapular Stretch', targetArea: 'Upper back, rhomboids, rear delts', timeLabel: '1 minute (30 sec per side)' },
      { sequenceOrder: 5, sequenceLabel: 'Reset', movementName: 'Standing Eagle Arms or Hug and Breathe', targetArea: 'Traps, rotator cuff, nervous system', timeLabel: '1 minute' },
    ],
  },
];

module.exports = {
  STRETCH_PROGRAM_SEED_ID,
  LEGACY_STRETCH_PROGRAM_SEED_IDS,
  STRETCH_PROGRAM_DEFAULT_ROWS,
};
