UPDATE settings
SET value = JSON_REMOVE(
  value, '$.primary', '$.secondary', '$.section',
  '$.feature0', '$.feature1', '$.feature2', '$.feature3',
  '$.step0', '$.step1', '$.step2', '$.step3', '$.step4', '$.step5', '$.step6'
)
WHERE id IN (
  'appearance:home-hero', 'appearance:about-hero', 'appearance:telecom-hero',
  'appearance:rental-hero', 'appearance:moving-hero', 'appearance:space-hero',
  'appearance:mobility-hero', 'appearance:business-hero', 'appearance:franchise-hero',
  'appearance:support-hero', 'appearance:insurance-hero'
)
AND JSON_VALID(value) = 1;
