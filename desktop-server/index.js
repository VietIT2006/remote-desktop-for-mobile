const { createClient } = require('@supabase/supabase-js');
const os = require('os');
require('dotenv').config();

// Khởi tạo Supabase (Sử dụng URL và Key từ file .env)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Lỗi: Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY trong file .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Hàm tạo mã PIN ngẫu nhiên 6 số
function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hàm lấy địa chỉ IP của máy tính (trong mạng LAN)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

async function startServer() {
  const pinCode = generatePIN();
  const localIp = getLocalIP();

  console.log('Đang khởi tạo mã PIN...');

  // Xóa tất cả các phiên bản (session) cũ của cái máy tính này (theo IP) để tránh bị rác database
  await supabase.from('sessions').delete().eq('desktop_ip', localIp);

  // Lưu PIN code mới lên Supabase
  const { data, error } = await supabase
    .from('sessions')
    .insert([
      { pin_code: pinCode, desktop_ip: localIp, status: 'waiting' }
    ]);

  if (error) {
    console.error('Lỗi khi lưu mã PIN lên Supabase:', error);
    return;
  }

  console.log('\n=====================================');
  console.log('🖥️  MÁY TÍNH ĐÃ SẴN SÀNG KẾT NỐI');
  console.log(`📡 Địa chỉ IP: ${localIp}`);
  console.log('=====================================');
  console.log(`\n🔑 MÃ PIN CỦA BẠN LÀ:  [ ${pinCode} ] \n`);
  console.log('Hãy mở app trên iPhone, nhập mã 6 số này vào để bắt đầu điều khiển.');
  console.log('=====================================\n');
  
  startStreamingServer();
}

const WebSocket = require('ws');
const { screen, mouse, Point } = require('@nut-tree-fork/nut-js');
const sharp = require('sharp');

// Tắt độ trễ của chuột để di chuyển mượt mà (real-time)
mouse.config.mouseSpeed = 0; 
mouse.config.autoDelayMs = 0;

function startStreamingServer() {
  const wss = new WebSocket.Server({ port: 8080 });

  wss.on('connection', (ws) => {
    console.log('📱 CÓ THIẾT BỊ ĐÃ KẾT NỐI (Bắt đầu stream màn hình...)');

    let isCapturing = false;

    const streamInterval = setInterval(async () => {
      if (isCapturing) return;
      isCapturing = true;

      try {
        const image = await screen.grab();
        const currentPos = await mouse.getPosition();
        
        // Lấy kích thước thật của màn hình (DPI Logical)
        const sWidth = await screen.width();
        const sHeight = await screen.height();

        // Tính toán tỷ lệ phần trăm (để bù đắp sự sai lệch do màn hình bị zoom 125%, 150% trên Windows)
        const percentX = currentPos.x / sWidth;
        const percentY = currentPos.y / sHeight;

        // Nội suy ra vị trí điểm ảnh chính xác trên khung hình Video
        let cX = Math.round(percentX * image.width);
        let cY = Math.round(percentY * image.height);

        // Tránh vẽ tràn viền
        cX = Math.min(Math.max(0, cX), image.width - 16);
        cY = Math.min(Math.max(0, cY), image.height - 16);

        // Tạo một con trỏ chuột giả bằng SVG
        const svgCursor = Buffer.from(
          `<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="8" fill="red" stroke="white" stroke-width="2"/></svg>`
        );

        const imgBuffer = await sharp(image.data, {
          raw: {
            width: image.width,
            height: image.height,
            channels: image.channels,
          }
        })
        .composite([{ input: svgCursor, top: cY, left: cX }])
        .jpeg({ quality: 60 })
        .toBuffer();

        const base64Img = 'data:image/jpeg;base64,' + imgBuffer.toString('base64');
        ws.send(base64Img);
      } catch (err) {
        console.error('Lỗi khi chụp màn hình (nut-js):', err.message);
      } finally {
        isCapturing = false;
      }
    }, 100); // Tăng tốc lên 10fps vì dùng RAM (chụp siêu nhanh)

    ws.on('close', () => {
      console.log('📱 THIẾT BỊ ĐÃ NGẮT KẾT NỐI');
      clearInterval(streamInterval);
    });

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'mousemove') {
          // Tính toán vị trí chuột mới
          const currentPos = await mouse.getPosition();
          // TĂNG HỆ SỐ NHẠY (x2.5) để chuột chạy nhanh hơn
          const newX = Math.max(0, currentPos.x + data.dx * 2.5);
          const newY = Math.max(0, currentPos.y + data.dy * 2.5);
          // Không dùng await ở đây để tránh bị nghẽn (lag) do WebSocket gửi quá nhanh
          mouse.setPosition(new Point(newX, newY)).catch(()=>{});
        } else if (data.type === 'click') {
          mouse.leftClick().catch(()=>{});
        }
      } catch (err) {
        // Bỏ qua lỗi parse JSON
      }
    });
  });

  console.log('🔌 WebSocket Server đang chạy ở port 8080');
}

startServer();
