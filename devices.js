const UA17  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
const UA18  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const UA_IP = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const UA_AN = (m) => `Mozilla/5.0 (Linux; Android 15; ${m}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36`;

const DEVICES = [
  { name:'iPhone 17 Air',     w:390, h:844,  ua:UA17,  cat:'iPhone' },
  { name:'iPhone 17',         w:393, h:852,  ua:UA17,  cat:'iPhone' },
  { name:'iPhone 17 Pro',     w:402, h:874,  ua:UA17,  cat:'iPhone' },
  { name:'iPhone 17 Pro Max', w:440, h:956,  ua:UA17,  cat:'iPhone' },
  { name:'iPhone 16',         w:393, h:852,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 16 Plus',    w:430, h:932,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 16 Pro',     w:402, h:874,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 16 Pro Max', w:440, h:956,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 15',         w:393, h:852,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 15 Plus',    w:430, h:932,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 15 Pro',     w:393, h:852,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 15 Pro Max', w:430, h:932,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 14',         w:390, h:844,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 14 Plus',    w:428, h:926,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 14 Pro',     w:393, h:852,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 14 Pro Max', w:430, h:932,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 13 mini',    w:375, h:812,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 13',         w:390, h:844,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone SE (3rd)',   w:375, h:667,  ua:UA18,  cat:'iPhone' },
  { name:'iPhone 12',         w:390, h:844,  ua:UA18,  cat:'iPhone' },
  { name:'iPad mini 6',       w:744,  h:1133, ua:UA_IP, cat:'iPad' },
  { name:'iPad (10th gen)',   w:820,  h:1180, ua:UA_IP, cat:'iPad' },
  { name:'iPad Air 5',        w:820,  h:1180, ua:UA_IP, cat:'iPad' },
  { name:'iPad Pro 11"',      w:834,  h:1194, ua:UA_IP, cat:'iPad' },
  { name:'iPad Pro 12.9"',    w:1024, h:1366, ua:UA_IP, cat:'iPad' },
  { name:'Samsung S25',       w:384, h:832,  ua:UA_AN('SM-S931B'), cat:'Android' },
  { name:'Samsung S25 Ultra', w:412, h:915,  ua:UA_AN('SM-S938B'), cat:'Android' },
  { name:'Google Pixel 9',    w:412, h:892,  ua:UA_AN('Pixel 9'),  cat:'Android' },
  { name:'OnePlus 13',        w:412, h:919,  ua:UA_AN('CPH2687'),  cat:'Android' },
];

if (typeof module !== 'undefined') module.exports = DEVICES;
