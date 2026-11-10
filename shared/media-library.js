export const mediaCategories = {
  banner: '배너 이미지',
  phone: '휴대폰 이미지',
  car: '자동차 이미지',
  other: '기타 이미지'
};

export const mediaAccept = {
  picture: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/webm'
};

export const isVideoUrl = url => /\.(mp4|webm)(?:[?#]|$)/i.test(url);
